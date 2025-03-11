const app = getApp();

Page({
  data: {
    messages: [],
    isRecording: false,
    scrollToMessage: '',
    recorderManager: null,
    inputText: '',  // 文本输入内容
    conversationId: null,  // 当前对话ID
    slides: [],
    currentIndex: 0,
    currentSlide: '',
    isLoading: true,
    wordCoordinates: {},  // 改为空对象，等待加载
    highlightedWords: [],  // 添加数组来存储需要高亮的单词
    lessonTitle: '',
    isFullscreenTriggered: false,
    showChat: true,
    showTrophy: false,
    moveTrophy: false,
    trophyPosition: { x: 0, y: 0 }
  },

  onLoad: function() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager();
    this.initRecorderManager();
    
    // 生成新的对话ID
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 添加欢迎消息
    const course = app.globalData.selectedCourse;
    const welcomeMessage = {
      type: 'ai',
      content: `欢迎来到${course?.name || '基础英语会话'}课程，我是你的AI英语老师，让我们开始对话吧！`,
      messageId: Date.now(),
      id: 1
    };
    
    // 设置初始状态
    this.setData({
      messages: [welcomeMessage],
      conversationId,
      scrollToMessage: 'msg-1'
    });

    console.log('初始化完成，会话ID:', conversationId);

    // 初始化PPT
    this.initSlides();

    // 加载坐标信息
    this.loadCoordinates();

    // 初始化屏幕方向为竖屏
    wx.setPageOrientation({
      orientation: 'portrait'
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
    if (!this.data.inputText.trim()) {
      return;
    }

    const userText = this.data.inputText;
    const messages = this.data.messages;
    const newMessageId = messages.length + 1;

    // 立即添加用户消息并清空输入框
    messages.push({
      type: 'user',
      content: userText,
      messageId: Date.now(),
      id: newMessageId
    });

    this.setData({
      messages,
      inputText: '',  // 清空输入框
      scrollToMessage: `msg-${newMessageId}`
    });

    // 显示AI正在输入的提示
    wx.showNavigationBarLoading();

    // 调用云函数获取AI回复
    wx.cloud.callFunction({
      name: 'chat',
      data: {
        text: userText,
        userId: app.globalData.userId,
        conversationId: this.data.conversationId
      },
      success: (res) => {
        if (res.result.error) {
          wx.showToast({
            title: res.result.message || '发送失败',
            icon: 'none'
          });
          return;
        }

        // 添加AI回复
        if (res.result.aiReply) {
          messages.push({
            type: 'ai',
            content: res.result.aiReply,
            messageId: res.result.messageId,
            id: newMessageId + 1
          });

          this.setData({
            messages,
            scrollToMessage: `msg-${newMessageId + 1}`
          });

          // 检查回复中的关键词
          const lowerReply = res.result.aiReply.toLowerCase();
          Object.keys(this.data.wordCoordinates).forEach(word => {
            if (lowerReply.includes(word.toLowerCase())) {
              this.highlightWord(word);
            }
          });
        }
      },
      fail: (error) => {
        console.error('发送失败:', error);
        wx.showToast({
          title: '发送失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideNavigationBarLoading();
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
  sendVoiceToServer: async function(filePath) {
    const messageId = Date.now();
    const messages = this.data.messages;
    const newMessageId = messages.length + 1;

    try {
      // 1. 先将录音文件上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `audio/${this.data.conversationId}/${messageId}.mp3`,
        filePath: filePath
      });

      if (!uploadRes.fileID) {
        throw new Error('上传录音失败');
      }

      // 2. 调用云函数处理语音
      const res = await wx.cloud.callFunction({
        name: 'chat',
        data: {
          audioFileId: uploadRes.fileID,
          userId: app.globalData.userId,
          conversationId: this.data.conversationId,
          isAudio: true
        }
      });

      if (res.result.error) {
        throw new Error(res.result.message || '处理失败');
      }

      // 3. 添加用户消息
      if (res.result.userText) {
        messages.push({
          type: 'user',
          content: res.result.userText,
          messageId: messageId,
          id: newMessageId
        });
      }

      // 4. 添加AI回复
      if (res.result.aiReply) {
        messages.push({
          type: 'ai',
          content: res.result.aiReply,
          messageId: res.result.messageId,
          id: newMessageId + 1,
          hasAudio: res.result.hasAudio,
          audioUrl: res.result.audioUrl
        });
      }

      // 5. 更新界面
      this.setData({
        messages,
        scrollToMessage: `msg-${newMessageId + 1}`
      });

      // 6. 如果有音频回复，播放
      if (res.result.hasAudio && res.result.audioUrl) {
        this.playCloudAudio(res.result.audioUrl);
      }

    } catch (error) {
      console.error('发送语音失败:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
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
  },

  // 开始新对话
  startNewConversation() {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.setData({
      conversationId,
      messages: []  // 清空消息列表
    });
    console.log('开始新对话:', conversationId);
  },

  // 发送消息
  async sendMessage(text) {
    if (!text.trim()) return;
    
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'chat',
        data: {
          text,
          userId: 'default',  // 这里可以根据实际需求设置userId
          conversationId: this.data.conversationId
        }
      });
      
      if (res.result.success) {
        // 处理成功响应
        const messages = this.data.messages;
        messages.push({
          type: 'user',
          content: text
        });
        messages.push({
          type: 'ai',
          content: res.result.aiReply,
          hasAudio: res.result.hasAudio,
          audioUrl: res.result.audioUrl
        });
        this.setData({ messages });
      } else {
        wx.showToast({
          title: res.result.message || '发送失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('发送消息失败:', err);
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 结束当前对话
  endConversation() {
    this.startNewConversation();
  },

  // 初始化PPT
  initSlides: async function() {
    try {
      wx.showLoading({
        title: '加载课件中...'
      });
      
      const slides = [
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lesson1/Slide1.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lesson1/Slide2.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lesson1/Slide3.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lesson1/Slide4.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lesson1/Slide5.JPG'
      ];
      
      this.setData({
        slides,
        currentSlide: slides[0],
        isLoading: false
      });
    } catch (error) {
      console.error('加载PPT失败:', error);
      wx.showToast({
        title: '加载课件失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 下一页
  nextSlide: function() {
    const { currentIndex, slides } = this.data;
    if (currentIndex < slides.length - 1) {
      this.setData({
        currentIndex: currentIndex + 1,
        currentSlide: slides[currentIndex + 1]
      });
    }
  },

  // 上一页
  prevSlide: function() {
    const { currentIndex, slides } = this.data;
    if (currentIndex > 0) {
      this.setData({
        currentIndex: currentIndex - 1,
        currentSlide: slides[currentIndex - 1]
      });
    }
  },

  // 切换全屏
  toggleFullscreen: function() {
    wx.setPageOrientation({
      orientation: 'landscape',
      success: () => {
        this.isFullscreenTriggered = true;
        setTimeout(() => {
          // 重新绘制当前高亮的单词
          if (this.data.highlightedWords && this.data.highlightedWords.length > 0) {
            const word = this.data.highlightedWords[0].word;
            this.highlightWord(word);
          }
        }, 300);
      }
    });
  },

  // 添加高亮单词的函数
  highlightWord: function(word) {
    // 转换为小写以进行不区分大小写的匹配
    const wordLower = word.toLowerCase();
    const coordinates = this.data.wordCoordinates[wordLower];
    if (!coordinates) {
      console.log('未找到坐标信息:', word);
      return;
    }

    this.setData({
      highlightedWords: [{
        word: wordLower,
        coordinates: coordinates
      }]
    });

    // 使用 nextTick 确保在下一帧绘制
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('#pptCanvas')
        .fields({ node: true, size: true })
        .select('.ppt-slide')
        .boundingClientRect()
        .select('.ppt-container')
        .boundingClientRect()
        .exec((res) => {
          if (!res[0] || !res[1] || !res[2]) {
            console.error('未找到元素');
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // 先清除画布
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const imageRect = res[1];
          const containerRect = res[2];

          // 检查是否横屏
          const isLandscape = containerRect.width > containerRect.height;

          const containerWidth = containerRect.width;
          const containerHeight = containerRect.height;
          const imageRatio = 1280 / 720;

          let scaledWidth, scaledHeight, offsetX = 0, offsetY = 0;

          if (isLandscape) {
            // 横屏模式下的计算
            // 始终以高度为基准计算，确保完整显示
            scaledHeight = containerHeight;
            scaledWidth = containerHeight * imageRatio;
            // 确保水平居中
            offsetX = Math.max(0, (containerWidth - scaledWidth) / 2);
            offsetY = 0;
          } else {
            // 竖屏模式下的计算
            if (containerWidth / containerHeight > imageRatio) {
              scaledHeight = containerHeight;
              scaledWidth = containerHeight * imageRatio;
              offsetX = (containerWidth - scaledWidth) / 2;
            } else {
              scaledWidth = containerWidth;
              scaledHeight = containerWidth / imageRatio;
              offsetY = (containerHeight - scaledHeight) / 2;
            }
          }

          const scaleX = scaledWidth / 1280;
          const scaleY = scaledHeight / 720;

          canvas.width = containerWidth;
          canvas.height = containerHeight;

          // 绘制当前高亮框
          const padding = isLandscape ? 20 : 10;
          const scaledX1 = coordinates.x1 * scaleX + offsetX - padding;
          const scaledY1 = coordinates.y1 * scaleY + offsetY - padding;
          const scaledX2 = coordinates.x2 * scaleX + offsetX + padding;
          const scaledY2 = coordinates.y2 * scaleY + offsetY + padding;

          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = isLandscape ? 4 : 3;
          ctx.strokeRect(
            scaledX1,
            scaledY1,
            scaledX2 - scaledX1,
            scaledY2 - scaledY1
          );

          console.log('绘制高亮框:', {
            isLandscape,
            containerSize: { width: containerWidth, height: containerHeight },
            scaledSize: { width: scaledWidth, height: scaledHeight },
            offset: { x: offsetX, y: offsetY },
            coordinates: { x1: scaledX1, y1: scaledY1, x2: scaledX2, y2: scaledY2 }
          });
        });
    });
  },

  // 加载坐标信息
  loadCoordinates: async function() {
    try {
      console.log('开始下载坐标文件...');
      const result = await wx.cloud.downloadFile({
        fileID: 'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/coordinates.json'
      });
      console.log('文件下载结果:', result);

      const fs = wx.getFileSystemManager();
      let fileContent;
      try {
        fileContent = fs.readFileSync(result.tempFilePath, 'utf8');
        console.log('读取到的文件内容:', fileContent);
      } catch (readError) {
        console.error('读取文件失败:', readError);
        throw readError;
      }

      let coordinates;
      try {
        coordinates = JSON.parse(fileContent);
        console.log('JSON解析结果:', coordinates);
      } catch (parseError) {
        console.error('JSON解析失败:', parseError);
        throw parseError;
      }

      if (!coordinates || !coordinates.Lesson1 || !coordinates.Lesson1.Slide1) {
        throw new Error('坐标文件格式不正确，缺少必要的数据结构');
      }

      this.setData({
        wordCoordinates: coordinates['Lesson1']['Slide1']
      });

    } catch (error) {
      console.error('加载坐标信息失败:', error);
      wx.showToast({
        title: '加载坐标失败: ' + error.message,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 监听返回按钮事件
  onBackPress: function() {
    // 如果是横屏状态，切换回竖屏并继续播放PPT
    if (this.isFullscreenTriggered) {
      wx.setPageOrientation({
        orientation: 'portrait',
        success: () => {
          this.isFullscreenTriggered = false;
          // 重新绘制当前高亮的单词
          if (this.data.highlightedWords && this.data.highlightedWords.length > 0) {
            const word = this.data.highlightedWords[0].word;
            this.highlightWord(word);
          }
        }
      });
      return true;  // 阻止返回到首页
    }

    // 只有在竖屏状态下点击返回才返回到首页
    return false;
  },

  // 处理返回按钮点击
  handleBack: function() {
    if (this.isFullscreenTriggered) {
      // 如果是横屏状态，切换回竖屏
      wx.setPageOrientation({
        orientation: 'portrait',
        success: () => {
          this.isFullscreenTriggered = false;
          // 重新绘制当前高亮的单词
          if (this.data.highlightedWords && this.data.highlightedWords.length > 0) {
            const word = this.data.highlightedWords[0].word;
            this.highlightWord(word);
          }
        }
      });
    } else {
      // 如果是竖屏状态，返回上一页
      wx.navigateBack();
    }
  },

  handleCanvasClick: function(e) {
    // 检查点击的是否是其他按钮
    if (e && e.target) {
      const className = e.target.className || '';
      // 如果点击的是按钮或控制元素，直接返回
      if (className.includes('back-btn') || 
          className.includes('back-icon') ||
          className.includes('arrow-btn') ||
          className.includes('fullscreen-btn') ||
          className.includes('ppt-controls')) {
        return;
      }
    }

    console.log('Canvas clicked');
    // 如果没有高亮的单词，直接返回
    if (!this.data.highlightedWords || !this.data.highlightedWords[0]) {
      console.log('No highlighted words:', this.data.highlightedWords);
      return;
    }
    
    const query = wx.createSelectorQuery();
    query.select('#pptCanvas')
      .boundingClientRect()
      .exec((res) => {
        if (!res[0]) {
          console.log('Canvas not found');
          return;
        }
        
        const canvas = res[0];
        const x = e.touches[0].clientX - canvas.left;
        const y = e.touches[0].clientY - canvas.top;
        console.log('Click coordinates:', {x, y});
        
        const coordinates = this.data.highlightedWords[0].coordinates;
        console.log('Word coordinates:', coordinates);

        const tolerance = 20;
        
        const containerWidth = canvas.width;
        const containerHeight = canvas.height;
        
        let scaledWidth, scaledHeight, offsetX = 0, offsetY = 0;
        
        if (containerWidth > containerHeight) {
          scaledHeight = containerHeight;
          scaledWidth = containerHeight * 1280 / 720;
          offsetX = Math.max(0, (containerWidth - scaledWidth) / 2);
          offsetY = 0;
        } else {
          if (containerWidth / containerHeight > 1280 / 720) {
            scaledHeight = containerHeight;
            scaledWidth = containerHeight * 1280 / 720;
            offsetX = (containerWidth - scaledWidth) / 2;
          } else {
            scaledWidth = containerWidth;
            scaledHeight = containerWidth * 720 / 1280;
            offsetY = (containerHeight - scaledHeight) / 2;
          }
        }
        
        const scaleX = scaledWidth / 1280;
        const scaleY = scaledHeight / 720;
        
        const scaledX1 = coordinates.x1 * scaleX + offsetX;
        const scaledY1 = coordinates.y1 * scaleY + offsetY;
        const scaledX2 = coordinates.x2 * scaleX + offsetX;
        const scaledY2 = coordinates.y2 * scaleY + offsetY;
        
        if (x >= (scaledX1 - tolerance) && 
            x <= (scaledX2 + tolerance) && 
            y >= (scaledY1 - tolerance) && 
            y <= (scaledY2 + tolerance)) {
          
          const trophyX = (scaledX1 + scaledX2) / 2 - 40;
          const trophyY = (scaledY1 + scaledY2) / 2 - 40;
          console.log('Trophy position:', {trophyX, trophyY});
          
          // 显示奖杯
          this.setData({
            trophyPosition: { x: trophyX, y: trophyY },
            showTrophy: true,
            moveTrophy: false
          }, () => {
            console.log('Trophy state updated:', this.data);
          });
          
          // 等待奖杯显示后再开始移动
          setTimeout(() => {
            this.setData({ moveTrophy: true });
          }, 500);
          
          // 动画结束后隐藏奖杯
          setTimeout(() => {
            this.setData({ 
              showTrophy: false,
              moveTrophy: false
            });
          }, 1700);
        }
      });
  }
}); 