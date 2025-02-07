const app = getApp();

Page({
  data: {
    messages: [],
    isRecording: false,
    scrollToMessage: '',
    recorderManager: null,
    inputText: '',  // 新增：文本输入内容
    hasPlayed: false,  // 新增：用于标记音频是否已播放
    isPlaying: false  // 新增：用于标记音频是否正在播放
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
              this.cleanupAudioFile();
              this.addMessage({
                type: 'ai',
                content: responseData.aiReply,
                audioData: responseData.audioData,
                messageId: messageId + 1
              });
              this.setData({ inputText: '' });
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

  /**
   * 清理音频文件
   */
  cleanupAudioFile: function() {
    const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_audio.wav`;
    try {
      const fsm = wx.getFileSystemManager();
      fsm.accessSync(tempFilePath);
      fsm.unlinkSync(tempFilePath);
    } catch (e) {
      // 文件不存在或删除失败，可以忽略
    }
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
            this.cleanupAudioFile();
            this.addMessage({
              type: 'ai',
              content: response.aiReply,
              audioData: response.audioData,
              messageId: messageId + 1
            });
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
   * 播放AI回复的语音
   */
  playAIResponse: function(text, audioData) {
    if (!text || !audioData) {
      console.log('没有文本内容或音频数据，跳过播放');
      this.setData({ isPlaying: false });
      return;
    }

    // 如果正在播放，直接返回
    if (this.data.isPlaying) {
      console.log('正在播放中，跳过重复播放');
      return;
    }

    // 创建一个新的音频上下文
    const innerAudioContext = wx.createInnerAudioContext();
    
    // 将音频数据转换为临时文件
    const fsm = wx.getFileSystemManager();
    const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_audio_${Date.now()}.wav`;
    
    try {
      // 将 base64 转换为二进制数据并写入文件
      fsm.writeFileSync(
        tempFilePath,
        wx.base64ToArrayBuffer(audioData),
        'binary'
      );
      
      wx.showLoading({ title: '正在播放语音...' });
      
      // 播放音频
      innerAudioContext.src = tempFilePath;
      innerAudioContext.play();
      
      // 监听播放完成
      innerAudioContext.onEnded(() => {
        this.setData({ isPlaying: false });
        // 删除临时文件
        try {
          fsm.unlinkSync(tempFilePath);
        } catch (e) {
          console.error('删除临时音频文件失败:', e);
        }
        wx.hideLoading();
        innerAudioContext.destroy();
      });

      // 监听播放错误
      innerAudioContext.onError((err) => {
        this.setData({ isPlaying: false });
        console.error('音频播放错误:', err);
        wx.showToast({
          title: '语音播放失败',
          icon: 'none'
        });
        wx.hideLoading();
        // 尝试删除临时文件
        try {
          fsm.unlinkSync(tempFilePath);
        } catch (e) {
          console.error('删除临时音频文件失败:', e);
        }
        innerAudioContext.destroy();
      });
    } catch (e) {
      this.setData({ isPlaying: false });
      console.error('处理音频数据失败:', e);
      wx.showToast({
        title: '语音处理失败',
        icon: 'none'
      });
      wx.hideLoading();
      // 确保清理临时文件
      try {
        fsm.unlinkSync(tempFilePath);
      } catch (error) {
        // 忽略删除失败的错误
      }
    }
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
      // 使用 concat 创建数组副本，而不是展开运算符
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

      // 在添加消息前标记音频状态
      if (message.type === 'ai' && message.audioData) {
        message.audioPlayed = false;
        // 将所有其他消息标记为已播放
        messages.forEach(m => {
          if (m.type === 'ai' && m.audioData) {
            m.audioPlayed = true;
          }
        });
      }

      messages.push(message);
      
      // 先更新消息列表
      this.setData({
        messages: messages,
        scrollToMessage: `msg-${message.id}`
      });

      // 使用 nextTick 确保状态已更新后再处理音频
      wx.nextTick(() => {
        // 只有是新的AI消息且未播放过才播放
        if (message.type === 'ai' && message.audioData && !message.audioPlayed && !this.data.isPlaying) {
          message.audioPlayed = true; // 立即标记为已播放
          this.setData({ 
            isPlaying: true,
            ['messages[' + (messages.length - 1) + '].audioPlayed']: true 
          }, () => {
            this.playAIResponse(message.content, message.audioData);
          });
        }
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