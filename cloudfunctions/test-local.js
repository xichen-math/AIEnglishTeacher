const fs = require('fs');
const path = require('path');
const sdk = require('microsoft-cognitiveservices-speech-sdk');

async function testRecognition() {
  try {
    console.log('准备读取本地文件...');
    const audioData = fs.readFileSync('D:/src/AIEnglishTeacher/1742121743201.mp3');
    console.log('文件读取成功，大小:', audioData.length);
    
    // 创建语音配置
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      "bd5f339e632b4544a1c9a300f80c1b0a",
      "eastus"
    );
    
    // 创建音频配置
    const pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    
    // 创建语音识别器
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    
    // 写入音频数据
    pushStream.write(audioData);
    pushStream.close();
    
    // 进行语音识别
    recognizer.recognizeOnceAsync(
      result => {
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          console.log(`识别结果: ${result.text}`);
        } else {
          console.log('无法识别语音，原因:', result.reason);
        }
        recognizer.close();
      },
      error => {
        console.error('语音识别错误:', error);
        recognizer.close();
      }
    );
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testRecognition(); 