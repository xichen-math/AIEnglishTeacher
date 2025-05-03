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
    isAudioPlaying: false,  // 添加标志位，表示是否正在播放音频
    userAvatarUrl: '', // 用户头像URL
    hasUserInfo: false, // 是否有用户信息
    charlotteImageLoaded: false // Charlotte图片是否加载成功
  },

  // 全局音频上下文
  audioContext: null,

  onLoad: function() {
    // 初始化微信同声传译插件的录音识别管理器
    this.initPluginRecordManager();
    
    // 检查并请求录音权限
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        console.log('✅ 已获取录音权限');
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中允许小程序使用录音功能',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
    
    // 获取用户信息
    this.getUserInfoFromStorage();
    
    // 生成新的对话ID
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建固定的欢迎消息
    const welcomeMessage = {
      type: 'ai',
      content: "Hello, I am Ravi.",
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

    // 播放欢迎消息，完成后才会开始录音
    this.playWelcomeMessage();
  },

  onShow: function() {
    // 页面显示时，如果之前是自动重启模式，则开始录音
    if (this.autoRestart && !this.data.isRecording) {
      this.startRecording();
    }
  },

  onHide: function() {
    // 页面隐藏时停止录音，但保持自动重启状态
    if (this.data.isRecording) {
      const currentAutoRestart = this.autoRestart;  // 保存当前的自动重启状态
      this.stopRecording();
      this.autoRestart = currentAutoRestart;  // 恢复自动重启状态
    }
  },

  onUnload: function() {
    // 页面卸载时完全停止录音和音频播放
    this.autoRestart = false;
    if (this.data.isRecording) {
      this.stopRecording();
    }
    
    // 停止并销毁音频实例
    this.stopCurrentAudio();
  },

  /**
   * 初始化微信同声传译插件的录音识别管理器
   */
  initPluginRecordManager: function() {
    if (!plugin || !plugin.getRecordRecognitionManager) {
      console.error('❌ 语音识别插件未正确加载');
      wx.showModal({
        title: '初始化失败',
        content: '语音识别插件加载失败，请检查插件配置',
        showCancel: false
      });
      return;
    }

    // 添加静音检测相关的数据
    this.lastVoiceTime = Date.now();
    this.lastRecordingEndTime = null;  // 添加记录上次录音结束时间
    this.silenceTimer = null;
    this.isListening = false;
    this.lastRecognizedText = '';
    this.autoRestart = true;
    this.errorCount = 0;
    this.maxErrors = 3;
    
    // 识别中（实时返回识别结果）
    manager.onRecognize = (res) => {
      console.log('🎤 识别中...', res);
      
      // 重置错误计数
      this.errorCount = 0;
      
      // 更新最后一次检测到声音的时间
      this.lastVoiceTime = Date.now();
      
      // 只有当识别结果不为空且与上一次不同时才更新
      if (res && res.result && res.result !== this.lastRecognizedText) {
        this.lastRecognizedText = res.result;
        
        // 美化识别文本显示：如果太长，只显示后半部分
        let displayText = res.result;
        if (displayText.length > 30) {
          displayText = '...' + displayText.substring(displayText.length - 30);
        }
        
        this.setData({
          recognizedText: displayText
        });
      }
    };

    // 监听音量变化
    manager.onVolumeChange = (res) => {
      console.log('音量变化：', res.data);
      // 只要有音量变化就更新最后检测时间，不管音量大小
      this.lastVoiceTime = Date.now();
    };

    // 识别结束（最终结果）
    manager.onStop = (res) => {
      console.log('🛑 识别结束:', res);
      
      // 记录停止时间
      this.lastRecordingEndTime = Date.now();
      
      // 清除静音检测定时器
      if (this.silenceTimer) {
        clearInterval(this.silenceTimer);
        this.silenceTimer = null;
      }

      this.setData({ 
        isRecording: false,
        recognizedText: ''
      });
      this.isListening = false;
      
      // 处理识别结果
      if (res && res.result) {
        const recognizedText = res.result.trim();
        console.log('✨ 识别结果:', recognizedText);
        
        if (recognizedText) {
          // 显示识别结果提示，使用更符合微信风格的提示
          wx.showToast({
            title: '识别成功',
            icon: 'success',
            duration: 1000
          });
          
          // 发送识别后的文本到云函数
          wx.showLoading({
            title: '正在思考...'
          });
          
          // 暂时禁用自动重启，等待 AI 回复后再决定是否重启
          const currentAutoRestart = this.autoRestart;
          this.autoRestart = false;
          
          console.log('📤 发送识别文本到云函数:', recognizedText);
          wx.cloud.callFunction({
            name: 'chat',
            data: {
              text: recognizedText,
              userId: app.globalData.userId || 'default',
              conversationId: this.data.conversationId,
              needSpeechConfig: true
            },
            success: (res) => {
              wx.hideLoading();
              console.log('📥 云函数返回结果:', res.result);
              
              if (!res.result) {
                console.error('云函数返回结果为空');
                this.autoRestart = currentAutoRestart; // 恢复自动重启状态
                setTimeout(() => { this.startRecording(); }, 1000);
                return;
              }

              if (res.result.error) {
                console.error('云函数返回错误:', res.result.error);
                wx.showToast({
                  title: res.result.message || '发送失败',
                  icon: 'none'
                });
                this.autoRestart = currentAutoRestart; // 恢复自动重启状态
                setTimeout(() => { this.startRecording(); }, 1000);
                return;
              }

              // 添加用户消息
              const messages = this.data.messages;
              const newMessageId = messages.length + 1;
              
              messages.push({
                type: 'user',
                content: recognizedText,
                messageId: Date.now(),
                id: newMessageId
              });

              // 获取AI回复文本
              const aiReply = res.result.aiReply || res.result.text || res.result.reply;
              console.log('🤖 AI回复:', aiReply);
              
              if (aiReply) {
                messages.push({
                  type: 'ai',
                  content: aiReply,
                  messageId: Date.now(),
                  id: newMessageId + 1
                });

                // 更新消息列表
                this.setData({
                  messages,
                  scrollToMessage: `msg-${newMessageId + 1}`
                });

                // 更新语音配置
                if (res.result.speechConfig) {
                  console.log('🔄 更新语音配置:', res.result.speechConfig);
                  this.speechConfig = {
                    key: res.result.speechConfig.key || this.speechConfig?.key,
                    region: res.result.speechConfig.region || this.speechConfig?.region || 'eastus',
                    voice: res.result.speechConfig.voice || this.speechConfig?.voice || 'en-US-AriaNeural'
                  };
                }

                // 使用前端语音合成播放回复，播放完成后再开始录音
                this.synthesizeAndPlay(aiReply)
                  .then(() => {
                    console.log('🎵 AI语音播放完成，立即开始新录音');
                    // 恢复自动重启状态
                    this.autoRestart = currentAutoRestart;
                    // 重置错误计数
                    this.errorCount = 0;
                    // 直接开始新录音，去掉等待延迟
                    this.startRecording();
                  })
                  .catch(err => {
                    console.error('❌ AI语音播放失败:', err);
                    // 即使播放失败也要继续录音
                    this.autoRestart = currentAutoRestart;
                    this.startRecording(); // 直接开始，去掉延迟
                  });
              } else {
                // 没有AI回复，也要继续录音
                console.log('⚠️ 没有获取到AI回复文本');
                this.autoRestart = currentAutoRestart;
                setTimeout(() => { this.startRecording(); }, 1000);
              }
            },
            fail: (error) => {
              wx.hideLoading();
              console.error('❌ 调用云函数失败:', error);
              wx.showToast({
                title: '发送失败',
                icon: 'none'
              });
              
              // 即使请求失败也要继续录音
              this.autoRestart = currentAutoRestart;
              setTimeout(() => { this.startRecording(); }, 1000);
            }
          });
        } else {
          // 空白识别结果，继续重新开始录音
          console.log('⚠️ 识别结果为空，重新开始录音');
          setTimeout(() => { this.startRecording(); }, 1000);
        }
      } else {
        // 没有识别结果，继续重新开始录音
        console.log('⚠️ 没有识别结果，重新开始录音');
        setTimeout(() => { this.startRecording(); }, 1000);
      }
    };

    // 识别开始
    manager.onStart = () => {
      console.log('🎯 开始语音识别');
      this.setData({ 
        isRecording: true,
        recognizedText: '正在聆听...' 
      });
      this.isListening = true;
      this.lastVoiceTime = Date.now();
      
      // 启动静音检测
      this.startSilenceDetection();
    };

    // 识别错误
    manager.onError = (res) => {
      console.error('❌ 识别错误:', res);
      
      // 记录停止时间
      this.lastRecordingEndTime = Date.now();
      
      this.setData({ 
        isRecording: false,
        recognizedText: ''
      });
      this.isListening = false;
      this.errorCount++;
      
      // 清除静音检测定时器
      if (this.silenceTimer) {
        clearInterval(this.silenceTimer);
        this.silenceTimer = null;
      }

      // 如果是权限错误，提示用户并停止自动重启
      if (res.errMsg && (res.errMsg.includes('auth') || res.errMsg.includes('permission'))) {
        this.autoRestart = false;
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中允许小程序使用录音功能',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
        return;
      }

      // 如果是重叠识别错误，增加重试延迟
      if (res.retcode === -30011) {
        const retryDelay = 2000;  // 固定2秒延迟
        setTimeout(() => {
          console.log('🔄 重新开始录音 (重叠识别错误后)');
          this.startRecording();
        }, retryDelay);
        return;
      }

      // 其他错误，如果在自动重启模式下，延迟后重试
      if (this.autoRestart) {
        const retryDelay = Math.min(2000 + (this.errorCount * 1000), 5000);
        setTimeout(() => {
          console.log(`🔄 第${this.errorCount}次重试录音`);
          this.startRecording();
        }, retryDelay);
      }
    };
  },

  /**
   * 开始静音检测
   */
  startSilenceDetection: function() {
    // 清除可能存在的旧定时器
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
    }
    
    // 每秒检查一次是否静音超过8秒
    this.silenceTimer = setInterval(() => {
      if (!this.isListening) {
        clearInterval(this.silenceTimer);
        this.silenceTimer = null;
        return;
      }
      
      const now = Date.now();
      const silenceDuration = now - this.lastVoiceTime;
      console.log('⏱️ 静音持续时间:', Math.floor(silenceDuration/1000), '秒');
      
      // 如果静音超过8秒，停止录音
      if (silenceDuration > 3000) {
        console.log('🔇 检测到8秒静音，自动停止录音');
        wx.showToast({
          title: '检测到静音，停止录音',
          icon: 'none',
          duration: 1500
        });
        this.stopRecording();
      }
    }, 1000);
  },

  /**
   * 开始录音 - 使用微信同声传译插件
   */
  startRecording: function() {
    if (this.data.isRecording) {
      console.log('已经在录音中，跳过');
      return;
    }

    // 减少间隔检查时间，从1秒改为300毫秒
    if (this.lastRecordingEndTime) {
      const timeSinceLastRecording = Date.now() - this.lastRecordingEndTime;
      if (timeSinceLastRecording < 300) {  // 确保至少间隔300毫秒
        console.log('距离上次录音结束时间太短，等待后重试...');
        setTimeout(() => {
          this.startRecording();
        }, 300 - timeSinceLastRecording);
        return;
      }
    }

    console.log('🎙️ 准备开始录音...');
    
    // 使用缓存的网络和权限状态，而不是每次都检查
    if (this.cachedNetworkOK === false) {
      wx.showToast({
        title: '请检查网络连接',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (this.cachedRecordPermission === false) {
      this.handleRecordingPermissionDenied();
      return;
    }
    
    // 如果已经确认过权限，直接开始录音
    if (this.cachedRecordPermission === true) {
      this.startRecordingWithPermission();
      return;
    }
    
    // 首次检查网络和权限
    wx.getNetworkType({
      success: (res) => {
        this.cachedNetworkOK = (res.networkType !== 'none');
        if (!this.cachedNetworkOK) {
          wx.showToast({
            title: '请检查网络连接',
            icon: 'none',
            duration: 2000
          });
          return;
        }
        
        // 检查录音权限
        wx.getSetting({
          success: (res) => {
            if (!res.authSetting['scope.record']) {
              wx.authorize({
                scope: 'scope.record',
                success: () => {
                  this.cachedRecordPermission = true;
                  this.startRecordingWithPermission();
                },
                fail: () => {
                  this.cachedRecordPermission = false;
                  this.handleRecordingPermissionDenied();
                }
              });
            } else {
              this.cachedRecordPermission = true;
              this.startRecordingWithPermission();
            }
          },
          fail: () => {
            this.cachedRecordPermission = false;
            this.handleRecordingPermissionDenied();
          }
        });
      }
    });
  },

  /**
   * 在获得权限后开始录音
   */
  startRecordingWithPermission: function() {
    console.log('✅ 开始录音，配置参数...');
    
    try {
      // 启动微信同声传译插件的语音识别
      manager.start({
        duration: 60000,        // 最长录音时间，设置为60秒
        lang: "en_US",         // 识别的语言，英语
        complete: function(res) {
          console.log('语音识别完成：', res)
        },
        volume: 0.1,          // 声音阈值，调低以提高灵敏度
        rate: 16000,          // 采样率提高到16k
        engine: 'mixed',      // 使用混合引擎
        vadEos: 5000,         // 静音检测时间，增加到5秒
        vadSos: 100,          // 开始检测静音时间，降低以提高响应速度
        vadMute: 300,         // 静音时间
        needByte: true,       // 需要字节数据
        audioSource: "auto"   // 自动选择音频源
      });

      // 显示录音状态
      wx.showToast({
        title: '开始录音',
        icon: 'none',
        duration: 1000
      });

    } catch (error) {
      console.error('❌ 启动录音失败:', error);
      wx.showToast({
        title: '启动录音失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 处理录音权限被拒绝的情况
   */
  handleRecordingPermissionDenied: function() {
    console.error('❌ 录音权限获取失败');
    this.autoRestart = false;  // 权限失败时禁用自动重启
    wx.showModal({
      title: '需要录音权限',
      content: '请在设置中允许小程序使用录音功能',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting();
        }
      }
    });
  },

  /**
   * 结束录音 - 使用微信同声传译插件
   */
  stopRecording: function() {
    console.log('⏹️ 结束录音');
    this.autoRestart = false;  // 手动停止时禁用自动重启
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.isListening = false;
    this.setData({ isRecording: false });
    
    // 记录停止时间
    this.lastRecordingEndTime = Date.now();
    
    manager.stop();  // 停止微信同声传译的语音识别
  },

  /**
   * 延迟重新开始录音
   */
  restartRecordingAfterDelay: function(delay = 1) { // 将默认延迟改为1毫秒，几乎立即执行
    // 如果自动重启被禁用，则不重新开始录音
    if (!this.autoRestart) {
      console.log('自动重启被禁用，不重新开始录音');
      return;
    }
    
    // 清除可能存在的定时器
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }
    
    // 设置新的定时器
    this.restartTimer = setTimeout(() => {
      // 再次检查是否应该自动重启
      if (this.autoRestart && !this.data.isRecording) {
        console.log('开始新的录音');
        this.startRecordingWithPermission();
      } else {
        console.log('跳过录音重启，当前状态: autoRestart=', this.autoRestart, ', isRecording=', this.data.isRecording);
      }
    }, delay); // 使用极短延迟
  },

  /**
   * 发送识别的文本
   */
  sendRecognizedText: function (recognizedText) {
    // 检查文本是否为空
    if (!recognizedText || recognizedText.trim() === '') {
      console.log('识别文本为空，不发送到云函数');
      // 延迟重新开始录音
      this.restartRecordingAfterDelay();
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '思考中...',
    });
    
    const app = getApp();
    const userId = app.globalData.userId || 'default';
    
    console.log('发送识别文本到云函数:', recognizedText);
    console.log('用户ID:', userId);
    console.log('对话ID:', this.data.conversationId);
    
    // 向云函数发送请求
    wx.cloud.callFunction({
      name: 'chatWithAI',
      data: {
        text: recognizedText,
        userId: userId,
        conversationId: this.data.conversationId,
        needSpeechConfig: true
      },
      success: (res) => {
        wx.hideLoading();
        console.log('云函数返回结果:', res);
        
        if (res.result) {
          // 更新用户消息
          this.addMessageToList({
            role: 'user',
            content: recognizedText
          });
          
          // 获取AI回复
          const aiReply = res.result.reply || '';
          console.log('AI回复:', aiReply);
          
          // 更新会话ID
          if (res.result.conversationId) {
            this.setData({
              conversationId: res.result.conversationId
            });
            console.log('更新会话ID:', res.result.conversationId);
          }
          
          // 更新语音配置
          if (res.result.speechConfig) {
            this.speechConfig = res.result.speechConfig;
            console.log('更新语音配置:', this.speechConfig);
          }
          
          // 如果有AI回复，添加到消息列表并播放
          if (aiReply) {
            this.addMessageToList({
              role: 'assistant',
              content: aiReply
            });
            
            // 合成并播放AI回复
            this.synthesizeAndPlay(aiReply)
              .then(() => {
                console.log('AI回复播放完成');
                // 立即重新开始录音
                this.restartRecordingAfterDelay(1);
              })
              .catch((error) => {
                console.error('AI回复播放失败:', error);
                // 即使播放失败也立即重新开始录音
                this.restartRecordingAfterDelay(1);
              });
          } else {
            console.log('AI回复为空');
            wx.showToast({
              title: '未获得AI回复',
              icon: 'none'
            });
            // 延迟重新开始录音
            this.restartRecordingAfterDelay();
          }
        } else {
          console.error('云函数返回结果为空');
          wx.showToast({
            title: '获取回复失败',
            icon: 'none'
          });
          // 延迟重新开始录音
          this.restartRecordingAfterDelay();
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('调用云函数失败:', error);
        wx.showToast({
          title: '发送消息失败',
          icon: 'none'
        });
        // 延迟重新开始录音
        this.restartRecordingAfterDelay();
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
    if (!text || text.trim() === '') {
      console.error('❌ 语音合成文本为空');
      return Promise.reject(new Error('语音合成文本为空'));
    }

    console.log('🔊 开始合成并播放语音...', text);
    
    // 确保语音配置存在
    if (!this.speechConfig) {
      console.warn('⚠️ 语音配置未初始化，使用默认配置');
      this.initDefaultSpeechConfig();
      if (!this.speechConfig) {
        return Promise.reject(new Error('语音配置初始化失败'));
      }
    }

    // 如果有正在播放的音频，先停止它
    this.stopCurrentAudio();

    // 判断是否为欢迎语句
    const isWelcomeMessage = text === "Hello, I am Ravi.";
    console.log('是否为欢迎消息:', isWelcomeMessage);

    console.log('🎯 使用语音配置:', this.speechConfig);
    
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
          <prosody rate="0.9" pitch="+0%" volume="+30%">
            ${escapedText}
          </prosody>
        </voice>
      </speak>`;

      console.log('📡 正在发送 Azure TTS 请求...');
      console.log('🔧 请求配置:', {
        region: this.speechConfig.region,
        voice: this.speechConfig.voice,
        endpoint: endpoint,
        key: this.speechConfig.key ? '已设置' : '未设置'
      });
      
      wx.showLoading({
        title: '加载语音中...',
        mask: true
      });
      
      wx.request({
        url: endpoint,
        method: 'POST',
        header: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-64kbitrate-mono-mp3',
          'Ocp-Apim-Subscription-Key': this.speechConfig.key
        },
        data: ssml,
        responseType: 'arraybuffer',
        success: (res) => {
          wx.hideLoading();
          
          if (res.statusCode === 200 && res.data && res.data.byteLength > 0) {
            console.log('✅ Azure TTS 请求成功, 数据大小:', res.data.byteLength, '字节');
            
            // 将音频数据写入临时文件
            const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_audio_${Date.now()}.mp3`;
            
            const fs = wx.getFileSystemManager();
            try {
              fs.writeFileSync(tempFilePath, res.data, 'binary');
              console.log('✅ 音频数据写入临时文件成功:', tempFilePath);
              
              // 创建音频实例并播放
              this.audioContext = wx.createInnerAudioContext();
              this.audioContext.src = tempFilePath;
              this.audioContext.volume = 1.0; // 设置最大音量
              
              // 设置正在播放标志
              this.setData({ isAudioPlaying: true });

              // 监听音频加载事件
              this.audioContext.onCanplay(() => {
                console.log('🎵 音频已加载，可以播放');
                wx.showToast({
                  title: 'AI正在说话',
                  icon: 'none',
                  duration: 2000
                });
              });
              
              this.audioContext.onPlay(() => {
                console.log('▶️ 语音开始播放');
              });
              
              this.audioContext.onError((err) => {
                console.error('❌ 音频播放错误:', err);
                
                // 显示播放错误
                wx.showToast({
                  title: '播放错误: ' + err.errMsg,
                  icon: 'none'
                });
                
                // 重置播放标志
                this.setData({ isAudioPlaying: false });
                
                reject(err);
                // 清理临时文件
                try {
                  fs.unlinkSync(tempFilePath);
                } catch (e) {
                  console.error('❌ 删除临时文件失败:', e);
                }
              });
              
              // 优化：提前初始化下一次录音的准备，减少延迟
              const prepareNextRecording = () => {
                // 先设置自动重启状态为true
                if (!isWelcomeMessage) {
                  this.autoRestart = true;
                }
                
                // 提前记录录音结束时间，避免后续再赋值
                this.lastRecordingEndTime = Date.now() - 500; // 减去500ms使其能立即启动
              };
              
              this.audioContext.onEnded(() => {
                console.log('⏹️ AI语音播放完成');
                
                // 重置播放标志
                this.setData({ isAudioPlaying: false });
                
                // 准备下一次录音
                prepareNextRecording();
                
                // 异步处理临时文件删除，不阻塞录音启动
                setTimeout(() => {
                  try {
                    fs.unlinkSync(tempFilePath);
                    console.log('🧹 临时音频文件已删除');
                    this.audioContext?.destroy();
                    this.audioContext = null;
                  } catch (e) {
                    console.error('❌ 删除临时文件失败:', e);
                  }
                }, 100);
                
                // 优化处理：如果是欢迎消息，直接解析Promise让外部控制录音启动
                // 如果是普通AI回复，则自动开始录音，并优先解决Promise
                if (!isWelcomeMessage && !this.data.isRecording) {
                  console.log('🎙️ 普通AI回复播放完成，立即开始录音');
                  // 先解析Promise，让外部逻辑继续执行
                  resolve();
                  // 立即开始录音，不使用setTimeout
                  this.startRecording();
                } else if (isWelcomeMessage) {
                  console.log('👋 欢迎消息播放完成，立即开始录音');
                  // 欢迎消息不在这里启动录音，而是在playWelcomeMessage函数中控制
                  resolve();
                } else {
                  resolve();
                }
              });
              
              // 检查文件是否存在并播放
              try {
                fs.accessSync(tempFilePath);
                console.log('▶️ 开始播放语音');
                this.audioContext.play();
              } catch (e) {
                console.error('❌ 临时文件无法访问:', e);
                this.setData({ isAudioPlaying: false });
                reject(e);
              }
            } catch (error) {
              console.error('❌ 处理音频数据失败:', error);
              wx.hideLoading();
              wx.showToast({
                title: '音频处理失败',
                icon: 'none'
              });
              this.setData({ isAudioPlaying: false });
              reject(error);
            }
          } else {
            console.error('❌ TTS服务请求失败:', res.statusCode, res);
            wx.showToast({
              title: 'TTS服务请求失败: ' + res.statusCode,
              icon: 'none'
            });
            this.setData({ isAudioPlaying: false });
            reject(new Error(`语音合成请求失败: ${res.statusCode}`));
          }
        },
        fail: (error) => {
          wx.hideLoading();
          console.error('❌ TTS服务调用失败:', error);
          this.setData({ isAudioPlaying: false });
          
          // 检查是否为域名问题
          if (error.errMsg && error.errMsg.includes('request:fail')) {
            wx.showModal({
              title: '请求失败',
              content: '请确保已在小程序管理后台添加相应域名到request合法域名:' + error.errMsg,
              showCancel: false
            });
          } else {
            wx.showToast({
              title: 'TTS请求失败: ' + error.errMsg,
              icon: 'none'
            });
          }
          
          reject(error);
        }
      });
    }).catch(error => {
      wx.hideLoading();
      console.error('❌ 语音合成失败:', error);
      wx.showToast({
        title: '语音播放失败',
        icon: 'none'
      });
      
      // 确保标志被重置
      this.setData({ isAudioPlaying: false });
      
      // 如果不是欢迎消息播放失败，才尝试启动录音
      if (!text.includes("Hello, I am Ravi") && !this.data.isRecording) {
        console.log('🎙️ 语音播放失败，仍然尝试开始录音');
        this.startRecording();
      }
      
      return Promise.reject(error);
    });
  },

  /**
   * 停止当前正在播放的音频
   */
  stopCurrentAudio: function() {
    // 如果存在音频上下文，停止并销毁它
    if (this.audioContext) {
      console.log('🛑 停止现有音频播放');
      try {
        this.audioContext.stop();
        this.audioContext.destroy();
        this.audioContext = null;
      } catch (error) {
        console.error('停止音频失败:', error);
      }
    }
    
    // 重置播放标志
    if (this.data.isAudioPlaying) {
      this.setData({ isAudioPlaying: false });
    }
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

    // 暂时禁用自动重启，等待 AI 回复后再决定是否重启
    const currentAutoRestart = this.autoRestart;
    this.autoRestart = false;

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
        // 恢复自动重启状态
        this.autoRestart = true;
        // 重置错误计数
        this.errorCount = 0;
        // 在语音播放完成后立即开始新录音
        this.startRecording(); // 立即开始录音
      }).catch(err => {
        console.error('语音播放异常');
        // 即使播放失败也要恢复自动重启并继续录音
        this.autoRestart = true;
        this.startRecording(); // 立即开始录音
      });
    } else {
      console.warn('语音配置不存在，跳过语音合成');
      // 即使没有语音播放也要恢复自动重启并继续录音
      this.autoRestart = true;
      this.startRecording(); // 立即开始录音
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

    // 确保自动重启录音被启用
    this.autoRestart = true;
    
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
          // 即使失败也尝试自动开始录音
          if (!this.data.isRecording) {
            this.startRecording();
          }
          return;
        }

        // 检查错误
        if (res.result.error) {
          console.error('云函数返回错误:', res.result.error);
          wx.showToast({
            title: res.result.message || '发送失败',
            icon: 'none'
          });
          // 即使失败也尝试自动开始录音
          if (!this.data.isRecording) {
            this.startRecording();
          }
          return;
        }

        // 获取AI回复文本
        const aiReply = res.result.aiReply || res.result.text || res.result.reply;
        if (!aiReply) {
          console.error('未获取到AI回复文本');
          // 即使失败也尝试自动开始录音
          if (!this.data.isRecording) {
            this.startRecording();
          }
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

        // 使用前端语音合成播放回复，播放完成后会自动开始录音
        this.synthesizeAndPlay(aiReply);
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        wx.showToast({
          title: '发送失败',
          icon: 'none'
        });
        // 即使请求失败也尝试自动开始录音
        if (!this.data.isRecording) {
          this.startRecording();
        }
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
    this.stopCurrentAudio();
    
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
        
        // 设置正在播放标志
        this.setData({ isAudioPlaying: true });
        
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
          this.setData({ isAudioPlaying: false });
          if (this.audioContext) {
            this.audioContext.destroy();
            this.audioContext = null;
          }
        });
        
        // 监听错误
        this.audioContext.onError((err) => {
          console.error('音频播放错误:', err);
          this.setData({ isAudioPlaying: false });
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
        this.setData({ isAudioPlaying: false });
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
              // 停止可能正在播放的其他音频
              this.stopCurrentAudio();
              
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
                this.audioContext = wx.createInnerAudioContext();
                this.audioContext.src = tempFilePath;
                
                // 设置正在播放标志
                this.setData({ isAudioPlaying: true });
                
                // 监听错误
                this.audioContext.onError((err) => {
                  console.error('音频播放错误:', err);
                  this.setData({ isAudioPlaying: false });
                  wx.showToast({
                    title: '音频播放失败',
                    icon: 'none'
                  });
                });

                // 监听播放结束
                this.audioContext.onEnded(() => {
                  console.log('音频播放完成');
                  this.setData({ isAudioPlaying: false });
                  this.audioContext.destroy();
                  this.audioContext = null;
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
                this.audioContext.play();

              } catch (error) {
                console.error('处理音频数据失败:', error);
                this.setData({ isAudioPlaying: false });
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
      console.log('🛠️ 初始化默认语音配置');
      this.speechConfig = {
        region: 'eastus',
        key: 'bd5f339e632b4544a1c9a300f80c1b0a', // 请确保此key有效
        voice: 'en-US-GuyNeural' // 使用Guy的男声，更符合Ravi这个名字
      };
      console.log('✅ 默认语音配置已初始化:', this.speechConfig);
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

  /**
   * 播放欢迎消息，然后立即开始录音
   */
  playWelcomeMessage: function() {
    console.log('🎙️ 播放欢迎消息开始');
    // 固定的欢迎消息文本
    const welcomeText = "Hello, I am Ravi.";
    
    // 显示加载提示
    wx.showLoading({
      title: '正在准备语音...',
      mask: true
    });
    
    // 确保已停止任何可能正在进行的录音
    if (this.data.isRecording) {
      console.log('停止已有录音以确保语音播放质量');
      this.stopRecording();
    }
    
    // 设置自动重启为false，欢迎语音后才手动启动录音
    this.autoRestart = false;
    
    // 确保语音配置已初始化
    if (!this.speechConfig) {
      this.initDefaultSpeechConfig();
    }
    
    console.log('欢迎消息使用语音配置:', this.speechConfig);
    
    // 合成并播放欢迎消息，播放完成后立即开始录音（无延迟）
    this.synthesizeAndPlay(welcomeText)
      .then(() => {
        console.log('👋 欢迎消息播放完成，立即开始录音');
        wx.hideLoading();
        
        // 立即启用自动重启并开始录音，不添加任何延迟
        this.autoRestart = true; // 启用自动重启
        this.startRecording(); // 立即开始第一次录音
      })
      .catch(err => {
        console.error('❌ 欢迎消息播放失败:', err);
        wx.hideLoading();
        
        // 显示错误信息
        wx.showModal({
          title: '语音播放失败',
          content: '欢迎语音播放失败，但您仍可以继续对话。错误详情: ' + (err.message || err.errMsg || '未知错误'),
          showCancel: false,
          success: () => {
            // 即使播放失败也立即开始录音
            console.log('🎙️ 尽管欢迎消息失败，立即开始录音');
            this.autoRestart = true; // 启用自动重启
            this.startRecording();
          }
        });
      });
  },

  // 从存储中获取用户信息
  getUserInfoFromStorage: function() {
    console.log('获取用户信息...');
    
    // 尝试从全局数据中获取
    const userInfo = app.globalData.userInfo;
    if (userInfo && userInfo.avatarUrl) {
      console.log('从全局数据获取到用户头像:', userInfo.avatarUrl);
      this.setData({
        userAvatarUrl: userInfo.avatarUrl,
        hasUserInfo: true
      });
      return;
    }

    // 尝试从本地存储获取
    const storageUserInfo = wx.getStorageSync('userInfo');
    if (storageUserInfo && storageUserInfo.avatarUrl) {
      console.log('从本地存储获取到用户头像:', storageUserInfo.avatarUrl);
      this.setData({
        userAvatarUrl: storageUserInfo.avatarUrl,
        hasUserInfo: true
      });
      app.globalData.userInfo = storageUserInfo;
      return;
    }

    // 使用CSS样式的Charlotte头像，不需要设置图片URL
    console.log('未找到用户头像，使用CSS样式Charlotte头像');
    this.setData({
      hasUserInfo: true  // 设置为true因为我们使用CSS样式头像
    });
  },

  // 获取用户信息
  getUserProfile: function() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功:', res);
        const userInfo = res.userInfo;
        
        // 保存到全局数据和本地存储
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
        
        this.setData({
          userAvatarUrl: userInfo.avatarUrl,
          hasUserInfo: true
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      }
    });
  },

  // 处理头像加载错误
  handleAvatarError: function(e) {
    console.error('头像加载失败:', e);
    console.log('当前头像URL:', this.data.userAvatarUrl);
    
    // 如果当前头像不是Charlotte头像，则切换到Charlotte头像
    if (this.data.userAvatarUrl !== "https://dev-tinyao-cdn.vercel.app/charlotte-avatar.jpg") {
      console.log('切换到Charlotte默认头像');
      this.setData({
        userAvatarUrl: "https://dev-tinyao-cdn.vercel.app/charlotte-avatar.jpg"
      });
    }
  },
}); 