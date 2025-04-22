const app = getApp();
// 引入微信同声传译插件
const plugin = requirePlugin('WechatSI');
const manager = plugin.getRecordRecognitionManager();

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
    trophyPosition: { x: 0, y: 0 },
    waitingForWordClick: false,  // 是否等待用户点击单词
    wordToClick: '',  // 需要点击的单词
    allSlideCoordinates: {},
    recognizedText: '',  // 存储识别后的文本
  },

  onLoad: function() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager();
    // 初始化原有的录音管理器（保留以防需要）
    this.initRecorderManager();
    // 初始化微信同声传译插件的录音识别管理器
    this.initPluginRecordManager();
    
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

    // 初始化默认语音配置，以防云函数未返回配置
    this.initDefaultSpeechConfig();

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
   * 初始化微信同声传译插件的录音识别管理器
   */
  initPluginRecordManager: function() {
    // 识别中（实时返回识别结果）
    manager.onRecognize = (res) => {
      console.log('识别中 onRecognize:', res.result);
      this.setData({
        recognizedText: res.result || '正在识别...'
      });
    };

    // 识别结束（最终结果）
    manager.onStop = (res) => {
      console.log('识别结束 onStop:', res);
      this.setData({ isRecording: false });
      
      const text = res.result;
      if (text && text.trim()) {
        console.log('识别结果:', text);
        // 发送识别后的文本
        this.sendRecognizedText(text);
      } else {
        wx.showToast({
          title: '未能识别，请重试',
          icon: 'none'
        });
      }
    };

    // 识别开始
    manager.onStart = () => {
      console.log('识别开始 onStart');
      this.setData({ 
        isRecording: true,
        recognizedText: '正在识别...' 
      });
    };

    // 识别错误
    manager.onError = (res) => {
      console.error('识别错误 onError:', res);
      this.setData({ isRecording: false });
      wx.showToast({
        title: '识别失败: ' + (res.msg || '未知错误'),
        icon: 'none'
      });
    };
  },

  /**
   * 初始化录音管理器（保留原有功能，但不再使用）
   */
  initRecorderManager: function() {
    // 监听录音开始事件
    this.recorderManager.onStart(() => {
      console.log('===== 录音已开始 =====');
    });
    
    // 监听录音结束事件
    this.recorderManager.onStop((res) => {
      console.log('===== 录音已结束，文件路径:', res.tempFilePath);
      // 不再使用旧的处理方式
      // const { tempFilePath } = res;
      // this.sendVoiceToServer(tempFilePath);
    });
    
    // 监听录音错误事件
    this.recorderManager.onError((err) => {
      console.error('===== 录音发生错误:', err);
      wx.showToast({
        title: '录音失败: ' + err.errMsg,
        icon: 'none'
      });
    });
  },

  /**
   * 开始录音 - 使用微信同声传译插件
   */
  startRecording: function() {
    console.log('===== 开始录音 =====');
    // 请求录音权限
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({ isRecording: true });
        console.log('录音权限获取成功，开始录音');
        
        // 启动微信同声传译插件的语音识别
        manager.start({
          lang: 'en_US',  // 英语识别，可根据需要改为 'zh_CN'
          duration: 60000,  // 最长录音时间，单位ms
          vadEos: 5000  // 语音后断点，即用户停止说话多长时间后自动停止识别
        });
      },
      fail: () => {
        console.error('录音权限获取失败');
        wx.showToast({
          title: '请授权录音权限',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 结束录音 - 使用微信同声传译插件
   */
  stopRecording: function() {
    console.log('===== 结束录音 =====');
    this.setData({ isRecording: false });
    manager.stop();  // 停止微信同声传译的语音识别
  },

  /**
   * 发送识别后的文本
   */
  sendRecognizedText: function(text) {
    if (!text.trim()) return;
    
    const messages = this.data.messages;
    const newMessageId = messages.length + 1;

    // 立即添加用户消息
    messages.push({
      type: 'user',
      content: text,
      messageId: Date.now(),
      id: newMessageId
    });

    this.setData({
      messages,
      scrollToMessage: `msg-${newMessageId}`
    });

    // 显示AI正在输入的提示
    wx.showNavigationBarLoading();

    // 调用云函数获取AI回复
    wx.cloud.callFunction({
      name: 'chat',
      data: {
        text: text,  // 直接发送识别后的文本
        userId: app.globalData.userId || 'default',
        conversationId: this.data.conversationId,
        needSpeechConfig: true
      },
      success: (res) => {
        // 检查返回结果的结构
        if (!res.result) {
          console.error('云函数返回结果为空');
          return;
        }

        // 检查错误
        if (res.result.error) {
          console.error('云函数返回错误:', res.result.error);
          wx.showToast({
            title: res.result.message || '发送失败',
            icon: 'none'
          });
          return;
        }

        // 获取AI回复文本
        const aiReply = res.result.aiReply || res.result.text || res.result.reply;
        if (!aiReply) {
          console.error('未获取到AI回复文本');
          return;
        }

        // 创建AI消息对象
        const aiMessage = {
          type: 'ai',
          content: aiReply,
          messageId: Date.now(),
          id: newMessageId + 1
        };

        // 更新消息列表
        messages.push(aiMessage);
        this.setData({
          messages,
          scrollToMessage: `msg-${newMessageId + 1}`
        });

        // 更新语音配置
        if (res.result.speechConfig) {
          this.speechConfig = {
            key: res.result.speechConfig.key || this.speechConfig?.key,
            region: res.result.speechConfig.region || this.speechConfig?.region || 'eastus',
            voice: res.result.speechConfig.voice || this.speechConfig?.voice || 'en-US-AriaNeural'
          };
        }

        // 使用前端语音合成
        this.synthesizeAndPlay(aiReply);
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
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
   * 处理输入框内容变化
   */
  onInputChange: function(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  /**
   * 初始化语音合成
   * @param {Object} config - Azure语音服务配置
   */
  initSpeechSynthesis: function(config) {
    if (!config) {
      console.error('语音配置为空');
      return;
    }
    this.speechConfig = config;
  },

  /**
   * 合成并播放语音
   * @param {string} text - 要转换为语音的文本
   * @returns {Promise<void>}
   */
  synthesizeAndPlay: function(text) {
    if (!this.speechConfig) {
      console.error('语音配置未初始化');
      this.initDefaultSpeechConfig();
      if (!this.speechConfig) {
        return Promise.reject(new Error('语音配置未初始化'));
      }
    }

    return new Promise((resolve, reject) => {
      // 构建Azure TTS REST API的URL
      const endpoint = `https://${this.speechConfig.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      
      // 转义可能在XML中引起问题的特殊字符
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${this.speechConfig.voice}">
          <prosody rate="1.1" pitch="+0%">
            ${escapedText}
          </prosody>
        </voice>
      </speak>`;

      // 创建临时变量，避免this的问题
      const speechConfig = this.speechConfig;
      
      wx.request({
        url: endpoint,
        method: 'POST',
        header: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
          'Ocp-Apim-Subscription-Key': speechConfig.key
        },
        data: ssml,
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.byteLength > 0) {
            // 将音频数据写入临时文件
            const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_audio_${Date.now()}.mp3`;
            
            const fs = wx.getFileSystemManager();
            try {
              fs.writeFileSync(tempFilePath, res.data, 'binary');
              
              // 创建音频实例并播放
              const innerAudioContext = wx.createInnerAudioContext();
              innerAudioContext.src = tempFilePath;

              // 监听音频加载事件
              innerAudioContext.onCanplay(() => {
                console.log('音频已加载，可以播放');
              });
              
              innerAudioContext.onPlay(() => {
                // 可以在这里添加播放开始的UI反馈
              });
              
              innerAudioContext.onError((err) => {
                console.error('音频播放错误:', err);
                
                // 显示播放错误
                wx.showToast({
                  title: '播放错误',
                  icon: 'none'
                });
                
                reject(err);
                // 清理临时文件
                try {
                  fs.unlinkSync(tempFilePath);
                } catch (e) {}
              });
              
              innerAudioContext.onEnded(() => {
                resolve();
                // 清理临时文件
                try {
                  fs.unlinkSync(tempFilePath);
                } catch (e) {}
                innerAudioContext.destroy();
              });
              
              // 检查文件是否存在并播放
              try {
                fs.accessSync(tempFilePath);
                innerAudioContext.play();
              } catch (e) {
                console.error('临时文件无法访问');
                reject(e);
              }
            } catch (error) {
              console.error('处理音频数据失败:', error);
              reject(error);
            }
          } else {
            console.error('TTS服务请求失败:', res.statusCode);
            reject(new Error(`语音合成请求失败: ${res.statusCode}`));
          }
        },
        fail: (error) => {
          console.error('TTS服务调用失败:', error);
          
          // 检查是否为域名问题
          if (error.errMsg && error.errMsg.includes('request:fail')) {
            wx.showModal({
              title: '请求失败',
              content: '请确保已在小程序管理后台添加相应域名到request合法域名',
              showCancel: false
            });
          }
          
          reject(error);
        }
      });
    }).catch(error => {
      console.error('语音合成失败:', error);
      wx.showToast({
        title: '语音播放失败',
        icon: 'none'
      });
      return Promise.reject(error);
    });
  },

  /**
   * 处理AI回复消息
   */
  handleAIResponse: function(aiReply, speechConfig, messageId) {
    // 准备新消息
    const aiMessage = {
      type: 'ai',
      content: aiReply,
      messageId: messageId
    };

    // 添加消息到列表
    this.addMessage(aiMessage);
    
    // 初始化语音合成（如果需要）
    if (speechConfig && !this.speechConfig) {
      this.initSpeechSynthesis(speechConfig);
    } else if (!this.speechConfig && speechConfig) {
      this.speechConfig = speechConfig;
    }

    // 合成并播放语音
    if (this.speechConfig) {
      this.synthesizeAndPlay(aiReply).then(() => {
        console.log('语音播放完成');
      }).catch(err => {
        console.error('语音播放异常');
      });
    } else {
      console.warn('语音配置不存在，跳过语音合成');
    }
    
    // 检查单词高亮和点击指令
    const lowerReply = aiReply.toLowerCase();
    if (lowerReply.includes('point to the') || lowerReply.includes('can you point to')) {
      for (const word in this.data.wordCoordinates) {
        if (lowerReply.includes(word.toLowerCase())) {
          this.highlightWord(word);
          this.setData({
            waitingForWordClick: true,
            wordToClick: word.toLowerCase()
          });
          break;
        }
      }
    }
  },

  /**
   * 发送文本消息
   */
  sendTextMessage: function() {
    if (!this.data.inputText.trim()) {
      return;
    }

    const userText = this.data.inputText;
    
    // 检查是否为语音识别模拟文本 (以 "/" 开头)
    if (userText.startsWith('/')) {
      // 提取实际文本内容 (去掉斜杠)
      const simulatedVoiceText = userText.substring(1).trim();
      
      // 清空输入框
      this.setData({
        inputText: ''
      });
      
      // 调用语音识别处理函数
      console.log('模拟语音识别:', simulatedVoiceText);
      this.sendRecognizedText(simulatedVoiceText);
      return;
    }
    
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
        userId: app.globalData.userId || 'default',
        conversationId: this.data.conversationId,
        needSpeechConfig: true  // 只需要语音配置，不需要音频文件
      },
      success: (res) => {
        // 检查返回结果的结构
        if (!res.result) {
          console.error('云函数返回结果为空');
          return;
        }

        // 检查错误
        if (res.result.error) {
          console.error('云函数返回错误:', res.result.error);
          wx.showToast({
            title: res.result.message || '发送失败',
            icon: 'none'
          });
          return;
        }

        // 获取AI回复文本
        const aiReply = res.result.aiReply || res.result.text || res.result.reply;
        if (!aiReply) {
          console.error('未获取到AI回复文本');
          return;
        }

        // 创建AI消息对象
        const aiMessage = {
          type: 'ai',
          content: aiReply,
          messageId: Date.now(),
          id: newMessageId + 1
        };

        // 更新消息列表
        messages.push(aiMessage);
        this.setData({
          messages,
          scrollToMessage: `msg-${newMessageId + 1}`
        });

        // 更新语音配置
        if (res.result.speechConfig) {
          this.speechConfig = {
            key: res.result.speechConfig.key || this.speechConfig?.key,
            region: res.result.speechConfig.region || this.speechConfig?.region || 'eastus',
            voice: res.result.speechConfig.voice || this.speechConfig?.voice || 'en-US-AriaNeural'
          };
        }

        // 使用前端语音合成
        this.synthesizeAndPlay(aiReply);
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
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
    console.log('===== 开始播放云存储音频 =====');
    console.log('音频文件ID:', fileID);
    
    // 显示加载提示
    wx.showLoading({
      title: '加载音频...'
    });

    // 确保销毁之前的音频实例
    if (this.audioContext) {
      console.log('销毁之前的音频实例');
      this.audioContext.destroy();
    }
    
    // 获取音频文件临时链接
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: res => {
        console.log('获取临时链接结果:', res);
        
        if (!res.fileList || res.fileList.length === 0) {
          console.error('未获取到临时链接');
          wx.hideLoading();
          wx.showToast({
            title: '音频加载失败',
            icon: 'none'
          });
          return;
        }
        
        const tempFileURL = res.fileList[0].tempFileURL;
        console.log('音频临时链接:', tempFileURL);
        
        // 创建新的音频实例
        this.audioContext = wx.createInnerAudioContext();
        
        // 设置音频源
        this.audioContext.src = tempFileURL;
        
        // 监听加载完成
        this.audioContext.onCanplay(() => {
          console.log('音频已准备好播放');
          wx.hideLoading();
          
          // 设置音量并自动播放
          this.audioContext.volume = 1.0;
          console.log('开始播放音频');
          this.audioContext.play();
        });
        
        // 监听播放开始
        this.audioContext.onPlay(() => {
          console.log('音频开始播放');
          wx.showToast({
            title: '正在播放',
            icon: 'none',
            duration: 1500
          });
        });
        
        // 监听播放进度
        this.audioContext.onTimeUpdate(() => {
          const currentTime = this.audioContext.currentTime;
          const duration = this.audioContext.duration;
          console.log(`播放进度: ${currentTime}/${duration}`);
        });
        
        // 监听播放结束
        this.audioContext.onEnded(() => {
          console.log('音频播放完成');
          if (this.audioContext) {
            this.audioContext.destroy();
            this.audioContext = null;
          }
        });
        
        // 监听错误
        this.audioContext.onError((err) => {
          console.error('音频播放错误:', err);
          wx.hideLoading();
          wx.showToast({
            title: '播放失败: ' + err.errMsg,
            icon: 'none'
          });
          if (this.audioContext) {
            this.audioContext.destroy();
            this.audioContext = null;
          }
        });
      },
      fail: error => {
        console.error('获取音频文件链接失败:', error);
        wx.hideLoading();
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
          audioFileID: uploadRes.fileID,
          userId: app.globalData.userId || 'default',
          conversationId: this.data.conversationId,
          needSpeechConfig: true  // 只需要语音配置，不需要音频文件
        }
      });
      
      if (res.result.error) {
        throw new Error(res.result.message || '处理失败');
      }

      // 3. 添加用户消息
      if (res.result.recognizedText) {
        messages.push({
          type: 'user',
          content: res.result.recognizedText,
          messageId: messageId,
          id: newMessageId
        });
      }

      // 4. 添加AI回复
      if (res.result.aiReply) {
        const aiMessage = {
          type: 'ai',
          content: res.result.aiReply,
          messageId: res.result.messageId,
          id: newMessageId + 1
        };
        
        messages.push(aiMessage);
      }

      // 5. 更新界面
      this.setData({
        messages,
        scrollToMessage: `msg-${newMessageId + 1}`
      });

      // 6. 更新语音配置
      if (res.result.speechConfig) {
        this.speechConfig = {
          key: res.result.speechConfig.key || this.speechConfig?.key,
          region: res.result.speechConfig.region || this.speechConfig?.region || 'eastus',
          voice: res.result.speechConfig.voice || this.speechConfig?.voice || 'en-US-AriaNeural'
        };
      }

      // 7. 使用前端语音合成播放AI回复
      if (res.result.aiReply) {
        this.synthesizeAndPlay(res.result.aiReply);
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
          userId: app.globalData.userId || 'default',
          conversationId: this.data.conversationId
        }
      });
      
      if (res.result.success) {
        // 处理成功响应
        const messages = this.data.messages;
        messages.push({
          type: 'user',
          content: text,
          messageId: Date.now()
        });
        
        // 处理AI回复
        this.handleAIResponse(
          res.result.aiReply,
          res.result.speechConfig,
          res.result.messageId
        );
      } else {
        wx.showToast({
          title: res.result.message || '发送失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('发送消息失败:', error);
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
      
      console.log('加载PPT幻灯片...');
      
      // 直接使用云存储路径作为幻灯片源
      const slides = [
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Slide1.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Slide2.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Slide3.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Slide4.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Slide5.JPG',
        'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Slide6.JPG'
      ];
      
      console.log('使用幻灯片数量:', slides.length);

      this.setData({
        slides: slides,               // 直接使用云存储路径
        currentSlide: slides[0],      // 第一张幻灯片
        currentIndex: 0,
        isLoading: false
      });
      
      console.log('设置的幻灯片列表:', slides);
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
      const newIndex = currentIndex + 1;
      this.setData({
        currentIndex: newIndex,
        currentSlide: slides[newIndex]
      });
      // 更新当前幻灯片的坐标
      this.updateSlideCoordinates(newIndex);
    }
  },

  // 上一页
  prevSlide: function() {
    const { currentIndex, slides } = this.data;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      this.setData({
        currentIndex: newIndex,
        currentSlide: slides[newIndex]
      });
      // 更新当前幻灯片的坐标
      this.updateSlideCoordinates(newIndex);
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
        fileID: 'cloud://test-6g0nfnc7f85f8936.7465-test-6g0nfnc7f85f8936-1340789122/Lets-Go-beign-1-lesson-3/Lets-Go-beign-1-coordinates.tsv'
      });
      console.log('文件下载结果:', result);

      const fs = wx.getFileSystemManager();
      let fileContent;
      try {
        fileContent = fs.readFileSync(result.tempFilePath, 'utf8');
        console.log('读取到的文件内容前100个字符:', fileContent.substring(0, 100));
      } catch (readError) {
        console.error('读取文件失败:', readError);
        throw readError;
      }

      // 解析TSV格式的坐标文件
      const allSlideCoordinates = {};
      const lines = fileContent.split('\n');
      
      // 跳过标题行
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // 跳过空行
        
        // 分割每行数据
        const parts = line.split(',').map(part => part.trim());
        if (parts.length < 6) {
          console.warn('无效的坐标行:', line);
          continue;
        }
        
        // 解析数据
        const slideNum = parts[1]; // 如 'Slide1'
        const word = parts[2].toLowerCase(); // 单词转小写存储
        
        // 解析坐标 (x1=506, y1=431, x2=566, y2=450)
        const x1 = parseInt(parts[3].split('=')[1]);
        const y1 = parseInt(parts[4].split('=')[1]);
        const x2 = parseInt(parts[5].split('=')[1]);
        const y2 = parts.length > 6 ? parseInt(parts[6].split('=')[1]) : y1 + 20;
        
        // 初始化slide对象
        if (!allSlideCoordinates[slideNum]) {
          allSlideCoordinates[slideNum] = {};
        }
        
        // 存储单词坐标
        allSlideCoordinates[slideNum][word] = {
          x1, y1, x2, y2
        };
      }
      
      console.log('解析到的坐标数据:', allSlideCoordinates);
      
      // 获取当前幻灯片的坐标
      const currentSlideNum = 'Slide' + (this.data.currentIndex + 1);
      const currentCoordinates = allSlideCoordinates[currentSlideNum] || {};

      this.setData({
        wordCoordinates: currentCoordinates,
        allSlideCoordinates: allSlideCoordinates
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
      console.log('No highlighted words');
      return;
    }
    
    // 如果不是在等待点击单词状态，直接返回
    if (!this.data.waitingForWordClick) {
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
        console.log('Click position:', {x, y});
        
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
          
          // 检查点击的是否是要求的单词
          if (this.data.highlightedWords[0].word.toLowerCase() === this.data.wordToClick) {
            const trophyX = (scaledX1 + scaledX2) / 2 - 40;
            const trophyY = (scaledY1 + scaledY2) / 2 - 40;
            
            console.log('显示奖杯，位置:', {trophyX, trophyY});
            
            // 显示奖杯
            this.setData({
              trophyPosition: { x: trophyX, y: trophyY },
              showTrophy: true,
              moveTrophy: false,
              waitingForWordClick: false, // 重置等待状态
              wordToClick: '' // 清除单词
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
        }
      });
  },

  // 更新幻灯片坐标
  updateSlideCoordinates: function(slideIndex) {
    if (!this.data.allSlideCoordinates) return;
    
    // 获取当前幻灯片号对应的坐标
    const slideNum = 'Slide' + (slideIndex + 1);
    const coordinates = this.data.allSlideCoordinates[slideNum] || {};
    
    console.log('更新为幻灯片坐标:', slideNum, coordinates);
    
    this.setData({
      wordCoordinates: coordinates,
      highlightedWords: [] // 清除当前高亮状态
    });
    
    // 清除画布上的高亮
    this.clearCanvas();
  },
  
  // 清除画布
  clearCanvas: function() {
    const query = wx.createSelectorQuery();
    query.select('#pptCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0] && res[0].node) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      });
  },

  /**
   * 初始化默认语音配置
   */
  initDefaultSpeechConfig: function() {
    // 如果没有语音配置，添加默认配置
    if (!this.speechConfig) {
      this.speechConfig = {
        region: 'eastus',
        key: 'bd5f339e632b4544a1c9a300f80c1b0a', // 这里是示例，应替换为真实的key
        voice: 'en-US-AriaNeural'
      };
    }
  },
  
  // 测试语音合成
  testSpeechSynthesis: function(text) {
    if (!text) {
      text = "This is a test of speech synthesis.";
    }
    
    this.synthesizeAndPlay(text).then(() => {
      wx.showToast({
        title: '语音测试成功',
        icon: 'success'
      });
    }).catch(err => {
      console.error('语音测试失败:', err);
      wx.showToast({
        title: '语音测试失败',
        icon: 'none'
      });
    });
  },
}); 