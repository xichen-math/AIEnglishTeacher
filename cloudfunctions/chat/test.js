const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');

// 存储对话历史的内存数据库
let chatHistory = [];

// 模拟云开发环境
cloud.init = () => {};
cloud.database = () => ({
  collection: (name) => ({
    where: (query) => ({
      get: async () => {
        // 根据查询条件过滤历史记录
        const filtered = chatHistory.filter(record => 
          record.userId === query.userId && 
          record.conversationId === query.conversationId
        );
        console.log('查询条件:', query);
        console.log('查询结果:', filtered);
        return { data: filtered };
      },
      orderBy: (field, order) => ({
        limit: (count) => ({
          get: async () => {
            // 根据查询条件过滤并排序
            const filtered = chatHistory.filter(record => 
              record.userId === query.userId && 
              record.conversationId === query.conversationId
            );
            const sorted = filtered.sort((a, b) => 
              order === 'desc' ? b[field] - a[field] : a[field] - b[field]
            );
            const limited = sorted.slice(0, count);
            console.log('排序后的查询结果:', limited);
            return { data: limited };
          }
        })
      })
    }),
    add: async ({ data }) => {
      // 添加新记录到历史数组
      const record = { _id: `test_id_${chatHistory.length + 1}`, ...data };
      chatHistory.push(record);
      console.log('添加新记录:', record);
      return { _id: record._id };
    }
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
  {
    name: '多轮对话测试',
    event: [
      {
        text: "Hi.",
        userId: "test_user",
        conversationId: "test_conv_2"
      },
      {
        text: "great.",
        userId: "test_user",
        conversationId: "test_conv_2"
      },
      {
        text: "sure.",
        userId: "test_user",
        conversationId: "test_conv_2"
      }
    ]
  }
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
  // {
  //   name: '空输入测试',
  //   event: {
  //     userId: "test_user"
  //   }
  // },
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
  
  // 清空历史记录
  chatHistory = [];
  
  for (const testCase of testCases) {
    try {
      console.log(`=== 开始测试: ${testCase.name} ===`);
      
      if (Array.isArray(testCase.event)) {
        // 多轮对话测试
        console.log('开始多轮对话测试...');
        for (const event of testCase.event) {
          console.log('\n--- 对话轮次 ---');
          console.log('用户输入:', event.text);
          const result = await main(event, {});
          console.log('AI回复:', result.aiReply);
          
          // 打印当前历史记录
          console.log('当前对话历史:', chatHistory);
        }
      } else {
        // 单轮对话测试
        console.log('测试输入:', JSON.stringify(testCase.event, null, 2));
        const result = await main(testCase.event, {});
        console.log('测试结果:', JSON.stringify(result, null, 2));
        
        // 打印当前历史记录
        console.log('当前对话历史:', chatHistory);
      }
      
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