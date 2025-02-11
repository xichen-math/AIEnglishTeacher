// 云函数入口文件
const cloud = require('wx-server-sdk')
const openai = require('./openai')

// 确保在所有操作之前初始化
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const chatsCollection = db.collection('chats')

const MAX_MESSAGE_LENGTH = 1000; // 限制每条消息的长度
const MAX_MESSAGES = 20; // 限制保留的消息数量

// 云函数入口函数
exports.main = async (event, context) => {
  const { text, audioFileID, userId, conversationId } = event
  const wxContext = cloud.getWXContext()

  console.log('云函数开始执行，输入参数:', { text, audioFileID, userId, conversationId });

  try {
    let processedText = text;

    // 如果有音频文件，先进行语音识别
    if (audioFileID && !text) {
      console.log('开始语音识别，音频文件ID:', audioFileID);
      try {
        processedText = await openai.recognizeSpeech(audioFileID);
        console.log('语音识别结果:', processedText);
      } catch (error) {
        console.error('语音识别失败:', error);
        return {
          success: false,
          error: true,
          message: '语音识别失败',
          detail: error.message
        };
      }
    }

    // 如果没有有效的输入
    if (!processedText) {
      console.log('没有有效的输入');
      return {
        success: false,
        error: true,
        message: '没有有效的输入'
      };
    }

    // 限制输入文本长度
    processedText = processedText.length > MAX_MESSAGE_LENGTH 
      ? processedText.substring(0, MAX_MESSAGE_LENGTH) 
      : processedText;

    console.log('开始获取历史对话');
    // 获取历史对话记录
    const historyRes = await chatsCollection
      .where({
        userId: userId || 'default',  // 如果没有userId，使用default
        _openid: wxContext.OPENID,
        conversationId: conversationId  // 使用conversationId来区分对话轮次
      })
      .orderBy('timestamp', 'desc')
      .limit(MAX_MESSAGES)
      .get()

    const history = historyRes.data.reverse()
    console.log('获取到历史对话条数:', history.length);

    // 调用 OpenAI API
    console.log('开始调用OpenAI API');
    const result = await openai.chat(processedText, history)
    console.log('OpenAI API 调用成功:', result);

    // 保存对话记录
    console.log('开始保存对话记录');
    await chatsCollection.add({
      data: {
        messageId: result.messageId,
        userId: userId,
        conversationId: conversationId,  // 保存conversationId
        _openid: wxContext.OPENID,
        userText: processedText,
        aiReply: result.text,
        timestamp: result.messageId,
        hasAudio: result.hasAudio,
        audioUrl: result.audioUrl,
        inputType: audioFileID ? 'voice' : 'text'
      }
    })
    console.log('对话记录保存成功');

    return {
      success: true,
      messageId: result.messageId,
      aiReply: result.text,
      hasAudio: result.hasAudio,
      audioUrl: result.audioUrl,
      recognizedText: audioFileID ? processedText : undefined
    }
  } catch (error) {
    console.error('处理对话失败:', error);
    console.error('错误堆栈:', error.stack);
    
    // 如果是环境变量配置错误
    if (error.message.includes('环境变量')) {
      return {
        success: false,
        error: true,
        message: '系统配置错误，请联系管理员',
        detail: error.message
      };
    }
    
    // 如果是空响应，返回默认回复
    if (!error.response || !error.response.data) {
      return {
        success: true,
        messageId: Date.now(),
        aiReply: "Great, can you say it again?",
        hasAudio: false,
        audioUrl: null
      };
    }
    
    return {
      success: false,
      error: true,
      message: error.message || '处理对话失败',
      detail: error.response?.data || error.stack
    };
  }
}