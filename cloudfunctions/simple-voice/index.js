const cloud = require('wx-server-sdk');
const sdk = require('microsoft-cognitiveservices-speech-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { fileID } = event;
  
  if (!fileID) {
    return { success: false, error: '未提供文件ID' };
  }
  
  try {
    // 下载文件
    const fileResult = await cloud.downloadFile({ fileID });
    
    if (!fileResult.fileContent || fileResult.fileContent.length < 100) {
      return { success: false, error: '文件无效或太小' };
    }
    
    // 设置Azure语音配置
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      "bd5f339e632b4544a1c9a300f80c1b0a", "eastus"
    );
    
    // 创建音频流
    const pushStream = sdk.AudioInputStream.createPushStream();
    pushStream.write(fileResult.fileContent);
    pushStream.close();
    
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    
    // 执行识别
    return new Promise((resolve) => {
      recognizer.recognizeOnceAsync(result => {
        recognizer.close();
        
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          resolve({ 
            success: true, 
            text: result.text,
            size: fileResult.fileContent.length
          });
        } else {
          resolve({ 
            success: false, 
            error: `识别失败: ${result.reason}`,
            errorDetail: result.reason
          });
        }
      });
    });
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      stack: error.stack 
    };
  }
} 