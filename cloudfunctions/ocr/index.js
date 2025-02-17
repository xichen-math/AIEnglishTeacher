const cloud = require('wx-server-sdk')
const Tesseract = require('tesseract.js')

cloud.init({
  env: 'test-6g0nfnc7f85f8936'  // 替换成您的云环境ID
})

exports.main = async (event, context) => {
  try {
    // 获取图片临时链接
    const result = await cloud.getTempFileURL({
      fileList: [event.fileID]
    })
    const imageUrl = result.fileList[0].tempFileURL

    // 使用Tesseract识别文字
    const { data: { text, words } } = await Tesseract.recognize(
      imageUrl,
      'eng',
      {
        logger: m => console.log(m)
      }
    )

    return {
      text,
      words
    }
  } catch (error) {
    console.error('OCR处理失败:', error)
    return {
      error: error.message
    }
  }
} 