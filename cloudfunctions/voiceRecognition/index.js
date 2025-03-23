// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 引入request-promise用于发送HTTP请求
const rp = require('request-promise')

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取音频Base64数据和格式
    const { audioBase64, format } = event
    
    if (!audioBase64) {
      return { error: true, message: '缺少音频数据' }
    }
    
    // 调用腾讯云语音识别API (这里使用模拟响应)
    // 在实际开发中，您需要替换为实际的语音识别API调用
    const result = await rp({
      method: 'POST',
      uri: 'https://api.anthemistry.com/speech-to-text',
      body: {
        audio: audioBase64,
        format: format || 'mp3',
        lang: 'en-US'
      },
      json: true
    })
    
    // 返回识别结果
    return { 
      text: result.transcript || '', 
      success: !!result.transcript 
    }
    
  } catch (error) {
    console.error('语音识别错误:', error)
    // 至少返回空文本，而不是抛出错误
    return { text: '', success: false, error: error.message }
  }
} 