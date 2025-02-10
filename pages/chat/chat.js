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
        icon: 'none'
      });
      return;
    }

    const userText = this.data.inputText.trim();
    const messageId = Date.now();
    const messages = this.data.messages;
    const newMessageId = messages.length + 1;

    // 直接更新消息列表，添加用户消息
    messages.push({
      type: 'user',
      content: userText,
      messageId: messageId,
      id: newMessageId
    });

    // 一次性更新状态
    this.setData({
      messages,
      inputText: '',
      scrollToMessage: `msg-${newMessageId}`
    });

    // 调用云函数
    wx.cloud.callFunction({
      name: 'chat',
      data: {
        text: userText,
        userId: app.globalData.userId
      },
      success: (res) => {
        console.log('云函数调用成功:', res.result);
        if (res.result.error) {
          console.error('云函数返回错误:', res.result);
          wx.showToast({
            title: res.result.message || '处理失败',
            icon: 'none'
          });
          return;
        }

        // 添加AI回复到消息列表
        messages.push({
          type: 'ai',
          content: res.result.aiReply,
          messageId: res.result.messageId,
          id: newMessageId + 1,
          hasAudio: res.result.hasAudio,
          audioFileID: res.result.audioFileID
        });

        // 更新界面
        this.setData({
          messages,
          scrollToMessage: `msg-${newMessageId + 1}`
        });

        // 如果有音频，自动播放
        if (res.result.hasAudio && res.result.audioFileID) {
          this.playCloudAudio(res.result.audioFileID);
        }
      },
      fail: (error) => {
        console.error('云函数调用失败:', error);
        // 显示具体错误信息
        let errorMsg = '发送失败';
        if (error.errMsg) {
          if (error.errMsg.includes('cloud function execute timeout')) {
            errorMsg = '请求超时，请重试';
          } else if (error.errMsg.includes('not exist')) {
            errorMsg = '云函数未找到，请检查部署';
          }
        }
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 播放云存储音频
   */
  playCloudAudio: function(fileID) {
    // 创建音频实例
    const innerAudioContext = wx.createInnerAudioContext();
    
    // 获取音频文件临时链接
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: res => {
        console.log('音频文件临时链接:', res.fileList[0].tempFileURL);
        innerAudioContext.src = res.fileList[0].tempFileURL;
        
        // 监听错误
        innerAudioContext.onError((err) => {
          console.error('音频播放错误:', err);
          wx.showToast({
            title: '音频播放失败',
            icon: 'none'
          });
        });

        // 监听播放开始
        innerAudioContext.onPlay(() => {
          console.log('音频开始播放');
        });

        // 监听播放结束
        innerAudioContext.onEnded(() => {
          console.log('音频播放完成');
          innerAudioContext.destroy();
        });

        // 开始播放
        console.log('触发音频播放');
        innerAudioContext.play();
      },
      fail: error => {
        console.error('获取音频文件链接失败:', error);
        wx.showToast({
          title: '音频加载失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 轮询获取音频数据
   */
  pollAudioData: function(messageId) {
    const maxRetries = 10;  // 最大重试次数
    const interval = 500;   // 轮询间隔（毫秒）
    let retryCount = 0;

    const poll = () => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/chat/audio/${messageId}`,
        method: 'GET',
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            if (res.data.audioData) {
              // 音频数据已就绪，创建临时文件并播放
              const fsm = wx.getFileSystemManager();
              const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_audio_${messageId}.mp3`;
              
              try {
                // 将Base64音频数据写入临时文件
                fsm.writeFileSync(
                  tempFilePath,
                  wx.base64ToArrayBuffer(res.data.audioData),
                  'binary'
                );

                // 创建音频实例
                const innerAudioContext = wx.createInnerAudioContext();
                innerAudioContext.src = tempFilePath;
                
                // 监听错误
                innerAudioContext.onError((err) => {
                  console.error('音频播放错误:', err);
                  wx.showToast({
                    title: '音频播放失败',
                    icon: 'none'
                  });
                });

                // 监听播放结束
                innerAudioContext.onEnded(() => {
                  console.log('音频播放完成');
                  innerAudioContext.destroy();
                  // 删除临时文件
                  fsm.unlink({
                    filePath: tempFilePath,
                    fail: (err) => {
                      console.error('删除临时文件失败:', err);
                    }
                  });
                });

                // 开始播放
                console.log('开始播放音频');
                innerAudioContext.play();

              } catch (error) {
                console.error('处理音频数据失败:', error);
                wx.showToast({
                  title: '音频处理失败',
                  icon: 'none'
                });
              }
              
              return;
            } else if (res.data.status === 'pending' && retryCount < maxRetries) {
              // 继续轮询
              retryCount++;
              setTimeout(poll, interval);
            } else if (retryCount >= maxRetries) {
              console.log('获取音频数据超时');
              wx.showToast({
                title: '获取音频超时',
                icon: 'none'
              });
            }
          }
        },
        fail: (error) => {
          console.error('获取音频数据失败:', error);
          wx.showToast({
            title: '获取音频失败',
            icon: 'none'
          });
        }
      });
    };

    // 开始轮询
    setTimeout(poll, interval);
  },

  /**
   * 发送语音到服务器
   */
  sendVoiceToServer: function(filePath) {
    const messageId = Date.now();
    const messages = this.data.messages;
    const newMessageId = messages.length + 1;

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
            // 添加用户消息
            messages.push({
              type: 'user',
              content: response.userText,
              messageId: messageId,
              id: newMessageId
            });

            if (response.aiReply) {
              // 添加AI回复
              messages.push({
                type: 'ai',
                content: response.aiReply,
                messageId: response.messageId,
                id: newMessageId + 1
              });

              // 立即更新界面
              this.setData({
                messages,
                scrollToMessage: `msg-${newMessageId + 1}`
              });

              // 如果有音频，开始轮询获取音频数据
              if (response.hasAudio) {
                this.pollAudioData(response.messageId);
              }
            }
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