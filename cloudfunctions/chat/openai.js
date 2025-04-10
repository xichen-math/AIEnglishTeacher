const axios = require('axios');
const cloud = require('wx-server-sdk');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

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
 * 将音频转换为WAV格式
 * @param {Buffer} audioBuffer 音频数据
 * @param {string} inputFormat 输入格式，默认为mp3
 * @returns {Promise<Buffer>}
 */
async function convertToWav(audioBuffer, inputFormat = 'mp3') {
  return new Promise((resolve, reject) => {
    // 使用系统临时目录
    const tmpDir = process.env.TEMP || process.env.TMP || '/tmp';
    console.log('使用临时目录:', tmpDir);
    
    // 确保临时目录存在
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log('创建临时目录成功');
      }
    } catch (err) {
      console.error('创建临时目录失败:', err);
      reject(err);
      return;
    }

    const tempInputPath = path.join(tmpDir, `input_${Date.now()}.${inputFormat}`);
    const tempOutputPath = path.join(tmpDir, `output_${Date.now()}.wav`);
    
    console.log('临时输入文件路径:', tempInputPath);
    console.log('临时输出文件路径:', tempOutputPath);
    
    try {
      // 写入临时输入文件
      fs.writeFileSync(tempInputPath, audioBuffer);
      console.log('临时输入文件写入成功');
      
      // 使用ffmpeg命令行转换
      const command = `${ffmpegPath} -i "${tempInputPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${tempOutputPath}"`;
      console.log('执行FFmpeg命令:', command);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg转换错误:', error);
          console.error('FFmpeg stderr:', stderr);
          // 清理临时文件
          try {
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
          } catch (cleanupErr) {
            console.error('清理临时文件失败:', cleanupErr);
          }
          reject(error);
          return;
        }
        
        try {
          // 读取转换后的文件
          const wavBuffer = fs.readFileSync(tempOutputPath);
          console.log('WAV文件读取成功，大小:', wavBuffer.length, '字节');
          
          // 清理临时文件
          fs.unlinkSync(tempInputPath);
          fs.unlinkSync(tempOutputPath);
          console.log('临时文件清理完成');
          
          resolve(wavBuffer);
        } catch (readErr) {
          console.error('读取WAV文件失败:', readErr);
          reject(readErr);
        }
      });
    } catch (writeErr) {
      console.error('写入临时文件失败:', writeErr);
      reject(writeErr);
    }
  });
}

/**
 * 语音识别函数
 * @param {string} audioFileID - 音频文件的云存储ID
 * @returns {Promise<string>} 识别出的文本
 */
async function recognizeSpeech(audioFileID) {
  try {
    console.log('===== 开始语音识别 =====');
    console.log('音频文件ID:', audioFileID);
    
    // 检查语音识别配置
    const speechKey = process.env.SPEECH_KEY || "bd5f339e632b4544a1c9a300f80c1b0a";
    const speechRegion = process.env.SPEECH_REGION || "eastus";
    
    console.log('使用语音识别配置:', {
      key: speechKey.substring(0, 4) + '...', // 只显示前4位，保护密钥
      region: speechRegion
    });
    
    // 从云存储下载音频文件
    const audioFile = await cloud.downloadFile({
      fileID: audioFileID
    });
    
    console.log('音频文件下载完成');
    
    // 获取文件扩展名
    const fileExt = path.extname(audioFileID).substring(1).toLowerCase();
    console.log('文件扩展名:', fileExt);
    
    // 转换为WAV格式
    const wavBuffer = await convertToWav(audioFile.fileContent, fileExt);
    console.log('音频转换完成，大小:', wavBuffer.length, '字节');
    
    // 使用语音识别SDK
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      speechKey,
      speechRegion
    );
    speechConfig.speechRecognitionLanguage = "en-US";
    
    // 创建音频流
    const pushStream = sdk.AudioInputStream.createPushStream();
    
    // 将WAV buffer写入到流中
    pushStream.write(wavBuffer);
    pushStream.close();
    
    // 使用音频流创建音频配置
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    
    return new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        result => {
          console.log('识别结果:', result);
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject(new Error(`识别失败: ${result.reason}`));
          }
        },
        error => {
          console.error('识别错误:', error);
          reject(error);
        }
      );
    });
  } catch (error) {
    console.error('语音识别过程出错:', error);
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
    console.log('===== 开始语音合成 =====');
    console.log('文本内容:', text);
    console.log('消息ID:', messageId);
    
    // 创建语音配置，使用与Program.cs相同的key和region
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY || "bd5f339e632b4544a1c9a300f80c1b0a",
      "eastus"
    );

    // 设置语音合成参数，与Program.cs保持一致
    speechConfig.speechSynthesisVoiceName = "en-US-AriaNeural";
    
    // 使用系统临时目录存储临时文件
    const tmpDir = process.env.TEMP || process.env.TMP || '/tmp';
    console.log('使用临时目录:', tmpDir);
    
    // 确保临时目录存在
    try {
      await fs.promises.mkdir(tmpDir, { recursive: true });
      console.log('临时目录已确认存在');
    } catch (err) {
      console.warn('创建临时目录失败，尝试继续:', err);
    }
    
    // 创建临时文件路径
    const tempFilePath = path.join(tmpDir, `${messageId}.wav`);
    console.log('临时文件路径:', tempFilePath);
    
    // 创建音频输出流
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(tempFilePath);
    
    // 创建语音合成器
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
    
    // 生成SSML
    const ssml = generateSSML(text);
    console.log('生成的SSML:', ssml);
    
    // 合成语音
    console.log('开始合成语音...');
    await new Promise((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        result => {
          synthesizer.close();
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            console.log('语音合成成功');
            resolve();
          } else {
            console.error('语音合成失败:', result.errorDetails);
            reject(new Error(result.errorDetails));
          }
        },
        error => {
          console.error('语音合成错误:', error);
          synthesizer.close();
          reject(error);
        }
      );
    });
    
    // 检查文件是否存在
    try {
      const stats = await fs.promises.stat(tempFilePath);
      console.log('临时文件状态:', stats);
      if (!stats.isFile() || stats.size === 0) {
        throw new Error('生成的音频文件无效');
      }
    } catch (err) {
      console.error('检查临时文件失败:', err);
      throw new Error(`临时文件检查失败: ${err.message}`);
    }
    
    // 上传到云存储
    console.log('开始上传音频文件到云存储...');
    const cloudPath = `audio/ai/${messageId}.wav`;
    
    try {
      const fileContent = await fs.promises.readFile(tempFilePath);
      console.log('读取临时文件成功，大小:', fileContent.length, '字节');
      
      const uploadResult = await cloud.uploadFile({
        cloudPath,
        fileContent
      });
      
      console.log('上传结果:', uploadResult);
      
      // 删除临时文件
      try {
        await fs.promises.unlink(tempFilePath);
        console.log('临时文件已删除');
      } catch (unlinkErr) {
        console.error('删除临时文件失败:', unlinkErr);
      }
      
      return {
        audioUrl: uploadResult.fileID,
        hasAudio: true
      };
    } catch (uploadErr) {
      console.error('上传音频文件失败:', uploadErr);
      throw uploadErr;
    }
  } catch (error) {
    console.error('语音合成失败:', error);
    console.error('错误堆栈:', error.stack);
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
 * 与OpenAI聊天
 * @param {string} text - 用户输入的文本
 * @param {Array} history - 历史对话记录
 * @returns {Promise<Object>} 聊天结果
 */
async function chat(text, history = []) {
  try {
    // 检查环境变量
    const envCheck = {
      AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY || "2d20693670634f3db62e0b89f3a91028",
      AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || "https://tinyao.openai.azure.com/",
      AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || "TestGPT"
    };

    // 获取系统提示词
    let systemPrompt = await getPromptFromCloud();
    
    // 构建消息列表
    const messages = [];
    
    // 添加系统消息
    messages.push({ role: 'system', content: systemPrompt });
    
    // 添加历史消息
    for (const msg of history) {
      if (msg.role === 'system') {
        // 如果历史中已有系统消息，则跳过添加系统提示词
        systemPrompt = null;
        continue;
      }
      
      if (msg.userText) {
        messages.push({ role: 'user', content: msg.userText });
      }
      
      if (msg.aiReply) {
        messages.push({ role: 'assistant', content: msg.aiReply });
      }
    }
    
    // 添加当前消息
    console.log('添加当前消息:', text);
    messages.push({ role: 'user', content: text });

    // 打印完整的消息列表
    console.log('发送给 OpenAI 的完整消息列表:', JSON.stringify(messages, null, 2));

    // 使用与Program.cs完全相同的endpoint和参数
    const url = `${envCheck.AZURE_OPENAI_ENDPOINT}/openai/deployments/${envCheck.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-05-15`;

    const response = await axios.post(
      url,
      {
        messages: messages,
        temperature: 0.7,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        max_tokens: 100,
        top_p: 0.95,
        stop: ["(Pause for Emma's response)"]
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
      messageId,
      systemPrompt: systemPrompt  // 只在第一次对话时返回
    };

    // 异步处理语音合成
    synthesizeSpeech(aiReply, messageId)
      .then(async ({ audioUrl, hasAudio }) => {
        // 这里不需要更新数据库，因为数据库操作应该在云函数的主函数中处理
        console.log('语音合成完成，音频URL:', audioUrl);
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
  recognizeSpeech,
  getPromptFromCloud
}; 