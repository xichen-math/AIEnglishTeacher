console.log('==== 脚本开始执行 ====');

const fs = require('fs');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

console.log('==== 模块加载完成 ====');

// 指定 ffmpeg 路径（如果需要）
// 如果你知道 ffmpeg 的确切安装路径，可以取消下面这行的注释并修改为正确路径
// ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');

/**
 * 使用 ffmpeg 将音频文件转换为 WAV 格式
 * @param {string} inputPath 输入音频文件路径
 * @param {string} outputPath 输出 WAV 文件路径
 * @returns {Promise<void>}
 */
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000)
      .audioChannels(1)
      .on('end', () => {
        console.log(`转换完成，文件已保存为: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('转换过程中出错:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * 使用 Azure 语音服务识别本地 WAV 音频
 */
async function recognizeWavFile(wavPath) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(wavPath)) {
        return reject(new Error(`找不到文件: ${wavPath}`));
      }

      // 先转换为标准 WAV 格式
      const outputWavPath = path.join(path.dirname(wavPath), `converted_${path.basename(wavPath)}`);
      await convertToWav(wavPath, outputWavPath);
      console.log('文件准备就绪，开始识别');

      const speechKey = process.env.AZURE_SPEECH_KEY || 'bd5f339e632b4544a1c9a300f80c1b0a';
      const speechRegion = process.env.AZURE_SPEECH_REGION || 'eastus';

      if (!speechKey) {
        return reject(new Error('缺少 Azure Speech Key'));
      }

      const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';

      const audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(outputWavPath));
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognizeOnceAsync(result => {
        recognizer.close();
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          resolve(result.text);
        } else if (result.reason === sdk.ResultReason.NoMatch) {
          reject(new Error('无法识别语音'));
        } else if (result.reason === sdk.ResultReason.Canceled) {
          const cancellation = sdk.CancellationDetails.fromResult(result);
          reject(new Error(`识别取消：${cancellation.reason} - ${cancellation.errorDetails}`));
        }
      }, error => {
        recognizer.close();
        reject(error);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// 🧪 本地测试
if (require.main === module) {
  try {
    console.log('==== 开始测试音频识别 ====');
    const filePath = path.join(__dirname, 'test1.wav'); 
    console.log(`==== 音频文件路径: ${filePath} ====`);
    
    recognizeWavFile(filePath)
      .then(text => console.log('✅ 识别结果:', text))
      .catch(err => {
        console.error('❌ 捕获到的错误:', err);
      });
  } catch (globalError) {
    console.error('🔴 全局错误:', globalError);
  }
}

module.exports = { recognizeWavFile, convertToWav };
