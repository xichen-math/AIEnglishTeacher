const app = getApp();

Page({
  data: {
    messages: [],
    isRecording: false,
    scrollToMessage: '',
    recorderManager: null,
    inputText: ''  // 新增：文本输入内容
  },

  onLoad: function() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager();
    this.initRecorderManager();
    
    // 添加欢迎消息
    const course = app.globalData.selectedCourse;
    this.addMessage({
      type: 'ai',
      content: `欢迎来到${course.name}课程，我是你的AI英语老师，让我们开始对话吧！`
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
   * 发送文本消息
   */
  sendTextMessage: function() {
    if (!this.data.inputText.trim()) return;

    console.log('开始发送文本消息:', this.data.inputText);
    console.log('请求URL:', `${app.globalData.baseUrl}/api/chat`);

    // 显示加载提示
    wx.showLoading({ 
      title: '正在处理...',
      mask: true  // 防止用户重复点击
    });

    // 添加用户消息到界面
    this.addMessage({
      type: 'user',
      content: this.data.inputText
    });

    // 直接使用 request 发送文本消息
    wx.request({
      url: `${app.globalData.baseUrl}/api/chat`,
      method: 'POST',
      timeout: 30000,  // 30秒超时
      header: {
        'content-type': 'application/x-www-form-urlencoded',
        'X-User-Id': app.globalData.userId || 'default-user'
      },
      data: {
        text: this.data.inputText
      },
      success: (res) => {
        console.log('请求成功，状态码:', res.statusCode);
        console.log('响应头:', res.header);
        console.log('响应数据:', res.data);
        
        if (res.statusCode === 200 && res.data) {
          if (res.data.aiReply) {
            console.log('收到AI回复:', res.data.aiReply);
            this.addMessage({
              type: 'ai',
              content: res.data.aiReply
            });
            this.setData({ inputText: '' });
            wx.hideLoading();
          } else {
            this.handleError('服务器响应缺少AI回复');
          }
        } else {
          this.handleError(`请求失败: ${res.statusCode}`);
        }
      },
      fail: (error) => {
        console.error('请求失败详情:', error);
        console.error('错误类型:', typeof error);
        console.error('错误信息:', error.errMsg);
        this.handleError(error.errMsg);
      },
      complete: () => {
        console.log('请求完成');
        wx.hideLoading();
      }
    });
  },

  // 处理错误的辅助函数
  handleError: function(message) {
    console.error('错误:', message);
    wx.hideLoading();
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 发送语音到服务器
   */
  sendVoiceToServer: function(filePath) {
    // 显示加载提示
    wx.showLoading({ title: '正在处理...' });

    // 上传录音文件
    wx.uploadFile({
      url: `${app.globalData.baseUrl}/api/chat`,  // 使用全局配置的baseUrl
      filePath: filePath,
      name: 'audio',
      formData: {},
      header: {
        'X-User-Id': app.globalData.userId || 'default-user'
      },
      success: (res) => {
        console.log('语音上传响应:', res.data);  // 调试日志
        let response;
        try {
          response = JSON.parse(res.data);
          // 添加用户消息
          if (response.userText) {
            this.addMessage({
              type: 'user',
              content: response.userText
            });
          }
          // 添加AI回复
          if (response.aiReply) {
            this.addMessage({
              type: 'ai',
              content: response.aiReply
            });
          }
        } catch (e) {
          console.error('解析响应失败:', e);  // 调试日志
          wx.showToast({
            title: '响应格式错误',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('发送语音失败:', error);  // 调试日志
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
   * 播放AI回复的语音
   */
  playAIResponse: function(text) {
    // 使用小程序的文字转语音接口
    wx.showLoading({ title: '正在生成语音...' });
    
    const innerAudioContext = wx.createInnerAudioContext();
    
    // 使用微信小程序的文字转语音
    wx.request({
      url: 'https://tts.weixin.qq.com/gettts',
      method: 'GET',
      responseType: 'arraybuffer',
      data: {
        text: text,
        lang: 'en_US',
        speed: 0.8,
        volume: 1
      },
      success: (res) => {
        // 将音频数据转换为临时文件
    const fsm = wx.getFileSystemManager();
        const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_audio.mp3`;
    
    try {
      fsm.writeFileSync(
        tempFilePath,
            res.data,
        'binary'
      );
      
      // 播放音频
      innerAudioContext.src = tempFilePath;
      innerAudioContext.play();
      
      // 监听播放完成
      innerAudioContext.onEnded(() => {
        // 删除临时文件
        try {
          fsm.unlinkSync(tempFilePath);
        } catch (e) {
          console.error('删除临时音频文件失败:', e);
        }
      });
        } catch (e) {
          console.error('创建临时音频文件失败:', e);
        wx.showToast({
          title: '语音播放失败',
          icon: 'none'
        });
        }
      },
      fail: (error) => {
        console.error('获取语音失败:', error);
      wx.showToast({
          title: '语音生成失败',
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
   * @param {Object} message - 消息对象
   */
  addMessage: function(message) {
    const messages = this.data.messages;
    message.id = messages.length + 1;
    messages.push(message);
    this.setData({
      messages,
      scrollToMessage: `msg-${message.id}`
    });

    // 如果是AI的回复，播放语音
    if (message.type === 'ai') {
      this.playAIResponse(message.content);
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