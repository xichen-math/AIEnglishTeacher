const cloud = require('wx-server-sdk');

cloud.init({
  env: 'test-6g0nfnc7f85f8936'
});

exports.main = async (event, context) => {
  try {
    // 尝试下载一个已知存在的小文件
    const result = await cloud.downloadFile({
      fileID: 'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/test.txt',
    });
    
    return {
      success: true,
      content: result.fileContent.toString('utf8'),
      size: result.fileContent.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}; 