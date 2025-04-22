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
    console.log('开始获取历史对话，查询条件:', {
      userId: userId || 'default',
      conversationId: conversationId
    });

    // 先获取系统消息
    const systemRes = await chatsCollection
      .where({
        userId: userId || 'default',
        conversationId: conversationId,
        role: 'system'
      })
      .get();

    // 再获取对话消息
    const chatRes = await chatsCollection
      .where({
        userId: userId || 'default',
        conversationId: conversationId,
        role: db.command.exists(false)  // 不包含 role 字段的记录
      })
      .orderBy('timestamp', 'asc')
      .limit(MAX_MESSAGES)
      .get();

    // 合并系统消息和对话消息
    const history = [...systemRes.data, ...chatRes.data];
    console.log('获取到历史对话条数:', history.length);
    console.log('历史对话内容:', JSON.stringify(history, null, 2));

    // 调用 OpenAI API
    console.log('开始调用OpenAI API');
    const result = await openai.chat(processedText, history, userId || 'default', conversationId);
    console.log('OpenAI API 调用成功:', result);

    // 保存对话记录
    console.log('开始保存对话记录');
    const newRecord = {
      messageId: result.messageId,
      userId: userId,
      conversationId: conversationId,
      userText: processedText,
      aiReply: result.text,
      timestamp: Date.now(),
      inputType: audioFileID ? 'voice' : 'text'
    };
    console.log('准备保存的记录:', newRecord);

    await chatsCollection.add({
      data: newRecord
    });
    console.log('对话记录保存成功');

    // 如果这是新对话的第一条消息，保存系统消息
    if (history.length === 0) {
      console.log('保存系统消息到历史记录');
      const systemRecord = {
        messageId: Date.now() - 1000,  // 确保系统消息在最前面
        userId: userId,
        conversationId: conversationId,
        role: 'system',
        content: result.systemPrompt,
        timestamp: Date.now() - 1000  // 确保系统消息在最前面
      };
      await chatsCollection.add({
        data: systemRecord
      });
      console.log('系统消息保存成功');
    }

    return {
      success: true,
      messageId: result.messageId,
      aiReply: result.text,
      speechConfig: result.speechConfig,
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
        speechConfig: null
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