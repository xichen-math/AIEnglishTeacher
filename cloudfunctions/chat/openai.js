const axios = require('axios');

async function chat(text, history) {
  try {
    console.log('环境变量:', {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      key: process.env.AZURE_OPENAI_KEY ? '已设置' : '未设置',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT
    });

    // 构建对话历史
    const messages = [
      { role: 'system', content: '你是一个英语教师，帮助学生学习英语。' }
    ];

    // 添加历史消息
    history.forEach(msg => {
      messages.push(
        { role: 'user', content: msg.userText },
        { role: 'assistant', content: msg.aiReply }
      );
    });

    // 添加当前消息
    messages.push({ role: 'user', content: text });

    const url = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-05-15`;
    
    console.log('正在调用 Azure OpenAI API，URL:', url);

    const response = await axios.post(
      url,
      {
        messages: messages,
        temperature: 0.7,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        max_tokens: 100,
        top_p: 0.95
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_KEY
        }
      }
    );

    console.log('API 响应状态:', response.status);
    console.log('API 响应数据:', response.data);

    const aiReply = response.data.choices[0].message.content;

    // 暂时注释掉语音生成部分，先测试文本对话
    /*
    // 生成语音
    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: aiReply
    });

    // 获取音频数据
    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    const audioData = audioBuffer.toString('base64');
    */

    return {
      text: aiReply,
      hasAudio: false,
      audioData: null
    };
  } catch (error) {
    console.error('Azure OpenAI API 调用失败:', error.response ? {
      status: error.response.status,
      data: error.response.data
    } : error.message);
    throw error;
  }
}

module.exports = {
  chat
}; 