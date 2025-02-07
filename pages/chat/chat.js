const app = getApp();

Page({
  data: {
    messages: [],
    isRecording: false,
    scrollToMessage: '',
    recorderManager: null,
    inputText: ''  // 文本输入内容
  },

  onLoad: function() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager();
    this.initRecorderManager();
    
    // 添加欢迎消息
    const course = app.globalData.selectedCourse;
    this.addMessage({
      type: 'ai',
      content: `欢迎来到${course?.name || '基础英语会话'}课程，我是你的AI英语老师，让我们开始对话吧！`
    });
  },

  /**
   * 初始化录音管理器
   */
  initRecorderManager: function() {
    // 监听录音结束事件
    this.recorderManager.onStop((res) => {
      const { tempFilePath } = res;
      // 发送录音文件到服务器进行语音识别
      this.sendVoiceToServer(tempFilePath);
    });
  },

  /**
   * 开始录音
   */
  startRecording: function() {
    // 请求录音权限
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({ isRecording: true });
        this.recorderManager.start({
          duration: 60000, // 最长录音时间，单位ms
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: 'mp3'
        });
      },
      fail: () => {
        wx.showToast({
          title: '请授权录音权限',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 结束录音
   */
  stopRecording: function() {
    this.setData({ isRecording: false });
    this.recorderManager.stop();
  },

  /**
   * 处理输入框内容变化
   */
  onInputChange: function(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  /**
   * 处理AI回复消息
   */
  handleAIResponse: function(aiReply, audioData, messageId) {
    console.log('开始处理AI回复');
    
    // 准备新消息
    const aiMessage = {
      type: 'ai',
      content: aiReply,
      messageId: messageId
    };

    // 添加消息到列表
    console.log('准备添加消息到列表');
    this.addMessage(aiMessage);
  },

  /**
   * 发送文本消息
   */
  sendTextMessage: function() {
    if (!this.data.inputText.trim()) return;

    // 检查网络状态
    if (!app.globalData.isConnected) {
      wx.showToast({
        title: '网络未连接',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const userText = this.data.inputText.trim();
    const messageId = Date.now();

    // 添加用户消息到界面
    this.addMessage({
      type: 'user',
      content: userText,
      messageId: messageId
    });

    // 清空输入框
    this.setData({ inputText: '' });

    // 准备请求数据
    const requestData = `text=${encodeURIComponent(userText)}`;
    console.log('发送的数据:', requestData);

    // 显示加载提示
    wx.showLoading({ 
      title: '正在处理...',
      mask: true
    });

    // 发送请求
    wx.request({
      url: `${app.globalData.baseUrl}/api/chat`,
      method: 'POST',
      timeout: 30000,
      header: {
        'content-type': 'application/x-www-form-urlencoded',
        'X-User-Id': app.globalData.userId || 'default-user'
      },
      data: requestData,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          try {
            let responseData = res.data;
            if (typeof responseData === 'string') {
              responseData = JSON.parse(responseData);
            }
            
            if (responseData.error) {
              this.handleError(responseData.message || '服务器返回错误');
              return;
            }
            
            if (responseData.aiReply) {
              this.handleAIResponse(responseData.aiReply, responseData.audioData, messageId + 1);
            }
          } catch (error) {
            this.handleError('响应数据解析失败');
          }
        } else {
          this.handleError(`请求失败: ${res.statusCode}`);
        }
      },
      fail: (error) => {
        this.handleError(error.errMsg.includes('timeout') ? '请求超时' : '网络请求失败');
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  handleError: function(message) {
    console.error('错误:', message);
    wx.hideLoading();
    wx.showToast({
      title: typeof message === 'string' ? message : '发生错误',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 发送语音到服务器
   */
  sendVoiceToServer: function(filePath) {
    const messageId = Date.now();
    wx.showLoading({ title: '正在处理...' });

    wx.uploadFile({
      url: `${app.globalData.baseUrl}/api/chat`,
      filePath: filePath,
      name: 'audio',
      formData: {},
      header: {
        'X-User-Id': app.globalData.userId || 'default-user'
      },
      success: (res) => {
        try {
          const response = JSON.parse(res.data);
          
          if (response.userText) {
            this.addMessage({
              type: 'user',
              content: response.userText,
              messageId: messageId
            });
          }
          
          if (response.aiReply) {
            this.handleAIResponse(response.aiReply, response.audioData, messageId + 1);
          }
        } catch (e) {
          console.error('解析响应失败:', e);
          wx.showToast({
            title: '响应格式错误',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('发送语音失败:', error);
        wx.showToast({
          title: '发送失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  /**
   * 添加消息到列表
   */
  addMessage: function(message) {
    if (!message) {
      console.log('消息对象为空');
      return;
    }

    try {
      const messages = this.data.messages.concat();
      
      // 为消息添加ID和时间戳
      message.id = messages.length + 1;
      message.messageId = message.messageId || Date.now();
      
      console.log('准备添加的消息:', message);

      // 检查消息是否已存在
      const existingMessage = messages.find(m => 
        m.type === message.type && 
        m.content === message.content && 
        m.messageId === message.messageId
      );
      
      if (existingMessage) {
        console.log('消息已存在，跳过添加');
        return;
      }

      messages.push(message);
      
      // 立即更新消息列表
      this.setData({
        messages: messages,
        scrollToMessage: `msg-${message.id}`
      });
    } catch (error) {
      console.error('添加消息失败:', error);
      wx.showToast({
        title: '添加消息失败',
        icon: 'none'
      });
    }
  },

  /**
   * 结束对话
   */
  endChat: function() {
    // 保存对话记录
    const chatHistory = {
      courseId: app.globalData.selectedCourse.id,
      courseName: app.globalData.selectedCourse.name,
      messages: this.data.messages,
      timestamp: new Date().getTime()
    };

    // 获取现有历史记录
    let histories = wx.getStorageSync('chatHistories') || [];
    histories.unshift(chatHistory);
    // 最多保存50条记录
    if (histories.length > 50) {
      histories = histories.slice(0, 50);
    }
    wx.setStorageSync('chatHistories', histories);

    // 返回首页
    wx.navigateBack();
  }
}); 