const cloud = require('wx-server-sdk')

cloud.init({
  env: 'test-6g0nfnc7f85f8936'
})

exports.main = async (event, context) => {
  const testPath = event.path || 'audio/1739262614370.mp3'
  console.log('测试下载文件:', testPath)
  
  try {
    // 尝试直接下载文件
    const result = await cloud.downloadFile({
      fileID: testPath,
    })
    
    return {
      success: true,
      size: result.fileContent ? result.fileContent.length : 0,
      message: '文件下载成功'
    }
  } catch (error) {
    console.error('文件下载失败:', error)
    
    // 尝试列出目录内容
    try {
      const files = await cloud.getTempFileURL({
        fileList: [testPath]
      })
      
      return {
        success: false,
        error: error.message,
        fileInfo: files,
        message: '文件下载失败但获取到URL'
      }
    } catch (listError) {
      return {
        success: false,
        error: error.message,
        listError: listError.message,
        message: '文件下载和列表都失败'
      }
    }
  }
} 