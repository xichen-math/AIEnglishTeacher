const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');

// 模拟云开发环境
cloud.init = () => {};
cloud.database = () => ({
  collection: (name) => ({
    where: () => ({
      get: async () => ({ data: [] }),
      orderBy: () => ({
        limit: () => ({
          get: async () => ({ data: [] })
        })
      }),
      update: async () => ({ stats: { updated: 1 } })
    }),
    add: async (data) => ({ _id: 'test_id' })
  })
});

// 模拟云存储操作
cloud.downloadFile = async ({ fileID }) => {
  if (fileID === 'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/prompts/Prompt1.txt') {
    // 从本地文件读取Prompt1.txt的内容
    const promptPath = path.join(__dirname, '../../openai/openai/Prompt1.txt');
    const content = fs.readFileSync(promptPath, 'utf8');
    return {
      fileContent: Buffer.from(content)
    };
  } else if (fileID.includes('/test.wav')) {
    // 模拟一个空的音频文件
    return {
      fileContent: Buffer.from(new Uint8Array(32))  // 创建一个32字节的空音频文件
    };
  }
  throw new Error(`File not found: ${fileID}`);
};

cloud.uploadFile = async ({ cloudPath, fileContent }) => ({
  fileID: `cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/${cloudPath}`
});

cloud.getWXContext = () => ({
  OPENID: 'test_openid',
  APPID: 'test_appid',
  UNIONID: 'test_unionid'
});

const main = require('./index.js').main;

// 模拟云函数环境变量
process.env.AZURE_SPEECH_KEY = "bd5f339e632b4544a1c9a300f80c1b0a";
process.env.AZURE_OPENAI_KEY = "2d20693670634f3db62e0b89f3a91028";
process.env.AZURE_OPENAI_ENDPOINT = "https://tinyao.openai.azure.com/";
process.env.AZURE_OPENAI_DEPLOYMENT = "TestGPT";

// 测试用例
const testCases = [
  // {
  //   name: '初始问候测试',
  //   event: {
  //     text: "hi",
  //     userId: "test_user",
  //     conversationId: "test_conv_1"
  //   }
  // },
  // {
  //   name: '学生回应测试',
  //   event: {
  //     text: "I'm happy",
  //     userId: "test_user",
  //     conversationId: "test_conv_1"
  //   }
  // }
  // {
  //   name: '单词学习测试',
  //   event: {
  //     text: "igloo",
  //     userId: "test_user",
  //     conversationId: "test_conv_1"
  //   }
  // },
  // {
  //   name: '句子练习测试',
  //   event: {
  //     text: "How are you?",
  //     userId: "test_user",
  //     conversationId: "test_conv_1"
  //   }
  // },
  // {
  //   name: '语音输入测试',
  //   event: {
  //     audioFileID: "cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/test.wav",
  //     userId: "test_user",
  //     conversationId: "test_conv_1"
  //   }
  // },
  {
    name: '空输入测试',
    event: {
      userId: "test_user"
    }
  },
  // {
  //   name: '超长文本测试',
  //   event: {
  //     text: "hello".repeat(300),  // 超过1000字符
  //     userId: "test_user"
  //   }
  // },
  // {
  //   name: '环境变量测试',
  //   event: {
  //     text: "test environment",
  //     userId: "test_user"
  //   },
  //   beforeTest: () => {
  //     const savedKey = process.env.AZURE_OPENAI_KEY;
  //     delete process.env.AZURE_OPENAI_KEY;
  //     return () => {
  //       process.env.AZURE_OPENAI_KEY = savedKey;
  //     };
  //   }
  // }
];

// 运行测试
async function runTest() {
  console.log('开始运行测试...\n');
  
  for (const testCase of testCases) {
    try {
      console.log(`=== 开始测试: ${testCase.name} ===`);
      console.log('测试输入:', JSON.stringify(testCase.event, null, 2));
      
      // 执行测试前的准备工作
      const cleanup = testCase.beforeTest ? testCase.beforeTest() : null;
      
      const result = await main(testCase.event, {});
      console.log('测试结果:', JSON.stringify(result, null, 2));
      
      // 执行清理工作
      if (cleanup) cleanup();
      
      console.log(`=== 测试 ${testCase.name} 完成 ===\n`);
    } catch (error) {
      console.error(`测试 ${testCase.name} 失败:`, error);
      console.error('错误堆栈:', error.stack);
      console.log(`=== 测试 ${testCase.name} 失败 ===\n`);
    }
  }
  
  console.log('所有测试执行完成');
}

// 执行测试
console.log('=== AI英语教师聊天功能测试 ===\n');
runTest(); 