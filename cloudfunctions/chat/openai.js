const axios = require('axios');
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// Prompt缓存管理
const promptCache = new Map();

/**
 * 从云存储读取Prompt文件
 * @param {string} userId - 用户ID
 * @param {string} conversationId - 会话ID
 * @returns {Promise<string>}
 */
async function getPromptFromCloud(userId, conversationId) {
  const cacheKey = `${userId}_${conversationId}`;
  
  // 检查缓存
  if (promptCache.has(cacheKey)) {
    console.log('使用缓存的Prompt，cacheKey:', cacheKey);
    return promptCache.get(cacheKey);
  }

  try {
    console.log('开始获取Prompt...');
    const promptPath = 'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/prompts/Prompt1.txt';
    console.log('使用的Prompt路径:', promptPath);

    const result = await cloud.downloadFile({
      fileID: promptPath,
    });
    console.log('Prompt文件下载成功');

    const buffer = result.fileContent;
    const prompt = buffer.toString('utf8');
    
    // 更新缓存
    promptCache.set(cacheKey, prompt);
    console.log('Prompt已缓存，cacheKey:', cacheKey);
    
    return prompt;
  } catch (error) {
    console.error('读取Prompt文件失败:', error);
    console.error('错误详情:', error.stack);
    throw error;
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
 * @param {string} userId - 用户ID
 * @param {string} conversationId - 会话ID
 * @returns {Promise<Object>} 聊天结果
 */
async function chat(text, history = [], userId = 'default', conversationId = 'default') {
  try {
    // 检查环境变量
    const envCheck = {
      AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY || "2d20693670634f3db62e0b89f3a91028",
      AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || "https://tinyao.openai.azure.com/",
      AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || "TestGPT"
    };

    // 获取系统提示词
    let systemPrompt = await getPromptFromCloud(userId, conversationId);
    
    // 构建消息列表
    const messages = [];
    
    // 添加系统消息
    messages.push({ role: 'system', content: systemPrompt });
    
    // 添加初始助手消息作为固定欢迎语
    messages.push({ role: 'assistant', content: "Hello, I am Ravi." });
    
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
    
    // 添加当前用户消息
    messages.push({ role: 'user', content: text });
    
    // 准备请求参数
    const requestUrl = `${envCheck.AZURE_OPENAI_ENDPOINT}openai/deployments/${envCheck.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-07-01-preview`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'api-key': envCheck.AZURE_OPENAI_KEY
    };
    
    // 发送请求到Azure OpenAI
    const response = await axios.post(
      requestUrl,
      {
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
      },
      { headers: requestHeaders }
    );
    
    // 处理响应
    const aiReply = response.data.choices[0].message.content;
    const messageId = `msg_${Date.now()}`;
    
    // 获取语音配置
    const speechConfig = {
      region: "eastus",
      key: "bd5f339e632b4544a1c9a300f80c1b0a",
      voice: "en-US-AriaNeural"
    };
    
    return {
      messageId: messageId,
      text: aiReply,
      systemPrompt: systemPrompt,
      speechConfig: speechConfig
    };
  } catch (error) {
    console.error('聊天过程出错:', error);
    if (error.response) {
      console.error('API响应:', error.response.data);
    }
    throw error;
  }
}

module.exports = {
  chat,
}; 