# AI英语教师小程序

## 项目简介
这是一个基于AI的英语学习微信小程序，通过与AI助手的对话来帮助用户提升英语水平。

## 功能模块
1.  **首页 (`pages/index/`)**
    *   可能包含推荐课程、活动入口等。
2.  **课程页 (`pages/course/`)**
    *   展示和选择课程。
3.  **对话页 (`pages/chat/`)**
    *   核心功能，与 AI 进行英语对话。
    *   可能包含语音输入、文本输入、历史记录等。
4.  **个人中心 (`pages/my/`)**
    *   用户相关信息，如学习记录、设置等。
*   (存在 `pages/test/` 页面，但未在 `app.json` 中注册，可能用于测试。)

## 技术架构
*   **前端**: 微信小程序原生开发 (WXML, WXSS, JavaScript)
*   **UI**: 使用微信小程序原生组件或自定义组件 (未确认使用特定UI库如WeUI)。
*   **后端**:
    *   **主要**: 微信小程序云开发 (Cloud Functions) - 用于处理核心逻辑如 `chat`, `ocr`, `voiceRecognition`。
    *   **可能**: C# API 服务 (存在 `appsettings.json`，具体用途需进一步确认)。
*   **AI 对话**: 调用大语言模型 (通过云函数或后端API)。
*   **其他**:
    *   使用了 `ffmpeg` 依赖，可能用于音频处理。

## 目录结构 (主要)
```
├── cloudfunctions/       // 云函数目录
│   ├── chat/
│   ├── ocr/
│   ├── voiceRecognition/
│   └── ...               // 其他云函数
├── pages/                // 小程序页面
│   ├── index/            // 首页
│   ├── course/           // 课程页
│   ├── chat/             // 对话页面
│   ├── my/               // 个人中心
│   └── test/             // 测试页面 (未注册)
├── app.js                // 小程序逻辑
├── app.json              // 全局配置 (页面、窗口、tabBar等)
├── app.wxss              // 全局样式
├── project.config.json   // 项目配置 (appid, 云函数根目录等)
├── package.json          // npm 依赖 (如 ffmpeg)
└── ...                   // 其他配置文件、资源文件等
```

## 开发注意事项 (保持不变，仍需注意)
1.  语音输入需要获取用户授权 (`requiredPrivateInfos` 中已声明 `createInnerAudioContext`)。
2.  AI响应需要做超时处理。
3.  本地存储需要定期清理。
4.  注意控制对话上下文大小。
5.  云函数和潜在的外部API调用需要处理网络错误和异常。
6.  文件系统操作需授权 (`requiredPrivateInfos` 中已声明 `getFileSystemManager`)。