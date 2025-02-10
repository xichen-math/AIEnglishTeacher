// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const openai = require('./openai')
const chatsCollection = db.collection('chats')

// 云函数入口函数
exports.main = async (event, context) => {
  const { text, userId } = event
  const wxContext = cloud.getWXContext()

  // 测试环境变量是否设置成功
  console.log('OPENAI_API_KEY 是否存在:', !!process.env.OPENAI_API_KEY)

  try {
    // 获取历史对话记录
    const historyRes = await chatsCollection
      .where({
        userId: userId,
        _openid: wxContext.OPENID
      })
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get()

    const history = historyRes.data.reverse()

    // 调用 OpenAI 处理对话
    const aiResponse = await openai.chat(text, history)

    // 保存对话记录
    const timestamp = Date.now()
    const messageId = `msg_${timestamp}`

    await chatsCollection.add({
      data: {
        messageId,
        userId,
        userText: text,
        aiReply: aiResponse.text,
        hasAudio: aiResponse.hasAudio,
        audioData: aiResponse.audioData,
        timestamp,
        _openid: wxContext.OPENID
      }
    })

    return {
      success: true,
      messageId,
      aiReply: aiResponse.text,
      hasAudio: aiResponse.hasAudio,
      audioData: aiResponse.audioData
    }
  } catch (error) {
    console.error('处理对话失败:', error)
    return {
      success: false,
      error: true,
      message: '处理对话失败'
    }
  }
}