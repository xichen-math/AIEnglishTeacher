const axios = require('axios');
const cloud = require('wx-server-sdk');
const sdk = require('microsoft-cognitiveservices-speech-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 从云存储读取Prompt文件
 * @returns {Promise<string>}
 */
async function getPromptFromCloud() {
  try {
    console.log('开始获取Prompt...');
    // 直接使用云存储中的Prompt1.txt
    const promptPath = 'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/prompts/Prompt1.txt';
    console.log('使用的Prompt路径:', promptPath);

    // 从云存储下载文件
    console.log('开始下载Prompt文件...');
    const result = await cloud.downloadFile({
      fileID: promptPath,
    });
    console.log('Prompt文件下载成功');

    // 将文件内容转换为字符串
    const buffer = result.fileContent;
    const prompt = buffer.toString('utf8');
    console.log('Prompt内容前100个字符:', prompt.substring(0, 100));
    
    return prompt;
  } catch (error) {
    console.error('读取Prompt文件失败:', error);
    console.error('错误详情:', error.stack);
    throw error;
  }
}

/**
 * 语音识别，与Program.cs保持一致的实现
 * @param {string} audioFileID - 音频文件的云存储ID
 * @returns {Promise<string>}
 */
async function recognizeSpeech(audioFileID) {
  try {
    // 从云存储下载音频文件
    const audioFile = await cloud.downloadFile({
      fileID: audioFileID,
    });

    // 创建语音配置，使用与Program.cs相同的key和region
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY || "bd5f339e632b4544a1c9a300f80c1b0a",
      "eastus"
    );

    // 创建音频配置
    const pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    // 创建语音识别器
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 写入音频数据
    pushStream.write(audioFile.fileContent);
    pushStream.close();

    // 进行语音识别，与Program.cs使用相同的识别方式
    return new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        result => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            console.log(`识别结果: ${result.text}`);
            resolve(result.text);
          } else if (result.reason === sdk.ResultReason.NoMatch) {
            console.log('无法识别语音');
            reject(new Error('Speech could not be recognized.'));
          } else if (result.reason === sdk.ResultReason.Canceled) {
            const cancellation = sdk.CancellationDetails.fromResult(result);
            console.log(`识别取消: 原因=${cancellation.reason}`);
            
            if (cancellation.reason === sdk.CancellationReason.Error) {
              console.log(`错误代码: ${cancellation.ErrorCode}`);
              console.log(`错误详情: ${cancellation.errorDetails}`);
            }
            reject(new Error(`Recognition canceled: ${cancellation.reason}`));
          }
          recognizer.close();
        },
        error => {
          console.error('语音识别错误:', error);
          reject(error);
          recognizer.close();
        }
      );
    });
  } catch (error) {
    console.error('语音识别失败:', error);
    throw error;
  }
}

/**
 * 生成SSML
 * @param {string} text - 要转换的文本
 * @returns {string} SSML格式的文本
 */
function generateSSML(text) {
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="en-US-AriaNeural">
        <prosody rate="0.9" pitch="+0%">
          ${text}
        </prosody>
      </voice>
    </speak>
  `.trim();
}

/**
 * 语音合成，与Program.cs保持一致的实现
 * @param {string} text - 要转换为语音的文本
 * @param {string} messageId - 消息ID，用于生成音频文件名
 * @returns {Promise<{audioUrl: string, hasAudio: boolean}>}
 */
async function synthesizeSpeech(text, messageId) {
  try {
    // 创建语音配置，使用与Program.cs相同的key和region
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY || "bd5f339e632b4544a1c9a300f80c1b0a",
      "eastus"
    );

    // 设置语音合成参数，与Program.cs保持一致
    speechConfig.speechSynthesisVoiceName = "en-US-AriaNeural";
    
    // 使用/tmp目录存储临时文件
    const tempFilePath = `/tmp/${messageId}.wav`;
    console.log('临时文件路径:', tempFilePath);
    
    // 创建音频输出流
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(tempFilePath);
    
    // 创建语音合成器
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    // 构建SSML，与Program.cs使用相同的格式
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="en-US-AriaNeural">
          <prosody rate="+10%" pitch="+10%">
            ${text}
          </prosody>
        </voice>
      </speak>`;

    // 进行语音合成
    return new Promise((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        async result => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            try {
              // 读取生成的音频文件
              const audioData = await require('fs').promises.readFile(tempFilePath);
              
              // 上传到云存储
              const cloudPath = `audio/${messageId}.wav`;
              const uploadResult = await cloud.uploadFile({
                cloudPath,
                fileContent: audioData
              });
              
              // 删除临时文件
              await require('fs').promises.unlink(tempFilePath);
              
              console.log('语音合成完成，文件已上传:', cloudPath);
              resolve({
                audioUrl: uploadResult.fileID,
                hasAudio: true
              });
            } catch (error) {
              console.error('处理音频文件失败:', error);
              reject(error);
            }
          } else if (result.reason === sdk.ResultReason.Canceled) {
            const cancellation = sdk.CancellationDetails.fromResult(result);
            console.log(`语音合成取消: 原因=${cancellation.reason}`);
            
            if (cancellation.reason === sdk.CancellationReason.Error) {
              console.log(`错误代码: ${cancellation.ErrorCode}`);
              console.log(`错误详情: ${cancellation.errorDetails}`);
            }
            reject(new Error(`Synthesis canceled: ${cancellation.reason}`));
          }
          synthesizer.close();
        },
        error => {
          console.error('语音合成错误:', error);
          reject(error);
          synthesizer.close();
        }
      );
    });
  } catch (error) {
    console.error('语音合成失败:', error);
    return {
      audioUrl: null,
      hasAudio: false
    };
  }
}

/**
 * @typedef {Object} ChatMessage
 * @property {string} userText - 用户输入的文本
 * @property {string} aiReply - AI的回复
 */

/**
 * 处理聊天请求
 * @param {string} text - 用户输入的文本
 * @param {ChatMessage[]} history - 历史消息记录
 * @returns {Promise<{text: string, hasAudio: boolean, audioUrl: string, messageId: number}>}
 */
async function chat(text, history) {
  try {
    // 检查环境变量
    const envCheck = {
      AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || "https://tinyao.openai.azure.com/",
      AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY || "2d20693670634f3db62e0b89f3a91028",
      AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || "TestGPT"
    };
    console.log('环境变量检查:', envCheck);

    // 构建对话历史，格式与Program.cs保持一致
    const messages = [];
    
    // 只有在没有历史记录时（新的一轮对话）才添加系统消息
    if (history.length === 0) {
      console.log('新的一轮对话，开始获取Prompt...');
      const prompt = await getPromptFromCloud();
      messages.push({ role: 'system', content: prompt });
      console.log('已添加系统Prompt');
    } else {
      console.log('当前对话轮次中，使用已有的Prompt');
    }

    // 添加历史消息，与Program.cs保持一致的格式
    history.forEach(msg => {
      messages.push(
        { role: 'user', content: msg.userText },
        { role: 'assistant', content: msg.aiReply }
      );
    });

    // 添加当前消息
    messages.push({ role: 'user', content: text });

    // 使用与Program.cs完全相同的endpoint和参数
    const url = `${envCheck.AZURE_OPENAI_ENDPOINT}/openai/deployments/${envCheck.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-05-15`;

    const response = await axios.post(
      url,
      {
        messages: messages,
        temperature: 0.7,           // 与Program.cs保持一致
        frequency_penalty: 0.5,     // 与Program.cs保持一致
        presence_penalty: 0.5,      // 与Program.cs保持一致
        max_tokens: 100,           // 与Program.cs保持一致
        top_p: 0.95,               // 与Program.cs保持一致
        stop: ["(Pause for Emma's response)"]  // 与Program.cs保持一致
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': envCheck.AZURE_OPENAI_KEY
        }
      }
    );

    console.log('API 响应状态:', response.status);
    console.log('API 响应数据:', JSON.stringify(response.data, null, 2));

    let aiReply = response.data.choices[0].message.content;
    console.log('AI回复内容:', aiReply);

    // 处理停止序列，与Program.cs保持一致
    if (aiReply.includes("(Pause for Emma's response)")) {
      aiReply = aiReply.split("(Pause for Emma's response)")[0].trim();
    }

    // 生成消息ID，与Program.cs保持一致
    const messageId = Date.now();

    // 先返回文本响应，异步处理语音合成
    const aiResponse = {
      text: aiReply,
      hasAudio: false,
      audioUrl: null,
      messageId
    };

    // 异步处理语音合成
    synthesizeSpeech(aiReply, messageId)
      .then(async ({ audioUrl, hasAudio }) => {
        // 更新数据库中的音频信息
        if (hasAudio) {
          await chatsCollection.where({
            messageId: messageId
          }).update({
            data: {
              hasAudio: true,
              audioUrl: audioUrl
            }
          });
        }
      })
      .catch(error => {
        console.error('异步语音合成失败:', error);
      });

    return aiResponse;
  } catch (error) {
    console.error('Azure OpenAI API 调用失败:', error);
    
    // 实现与Program.cs相同的重试逻辑
    if (error.retryCount >= 3) {
      return {
        text: "Great, can you say it again?",
        hasAudio: false,
        audioUrl: null,
        messageId: Date.now()
      };
    }
    
    error.retryCount = (error.retryCount || 0) + 1;
    if (error.retryCount < 3) {
      console.log(`重试第 ${error.retryCount} 次`);
      return chat(text, history);
    }
    
    throw error;
  }
}

module.exports = {
  chat,
  recognizeSpeech
}; 