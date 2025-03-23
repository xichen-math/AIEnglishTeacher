Page({
  data: {
    recommendCourses: [
      {
        id: 1,
        name: '基础英语会话',
        description: '适合初学者的日常英语对话课程',
        image: '/assets/images/course1.png'
      },
      {
        id: 2,
        name: '商务英语进阶',
        description: '职场必备的商务英语交际能力',
        image: '/assets/images/course2.png'
      }
    ],
    showDialog: false,
    dialogTitle: '',
    progress: 60,
    currentTab: 'home',
    isRecording: false
  },

  onLoad: function() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager();
    this.initRecorderManager();
  },

  // 初始化录音管理器
  initRecorderManager: function() {
    this.recorderManager.onStop((res) => {
      const { tempFilePath } = res;
      console.log('录音文件：', tempFilePath);
      
      // 停止录音后跳转到对话页面
      wx.navigateTo({
        url: '/pages/chat/chat',
        success: function(res) {
          // 传递录音文件路径给聊天页面
          res.eventChannel.emit('acceptDataFromOpenerPage', { audioPath: tempFilePath })
        }
      });
    });
  },

  // 开始录音
  startRecording: function() {
    this.recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    });
    this.setData({ isRecording: true });
  },

  // 停止录音
  stopRecording: function() {
    this.recorderManager.stop();
    this.setData({ isRecording: false });
  },

  // 处理语音按钮点击
  handleVoiceBtn: function() {
    if (this.data.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  /**
   * 课程选择处理函数
   * @param {Object} e - 事件对象
   */
  onCourseSelect: function(e) {
    const course = e.currentTarget.dataset.course;
    // 将选中的课程信息存储到全局数据
    getApp().globalData.selectedCourse = course;
    // 跳转到对话页面
    wx.navigateTo({
      url: '/pages/chat/chat'
    });
  },

  showLessonDialog(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      showDialog: true,
      dialogTitle: type
    });
  },

  closeLessonDialog() {
    this.setData({
      showDialog: false
    });
  },

  selectLesson(e) {
    const level = e.currentTarget.dataset.level;
    const levelMap = {
      1: '初级',
      2: '中级',
      3: '高级'
    };
    
    wx.showToast({
      title: `已选择${levelMap[level]}${this.data.dialogTitle}课程`,
      icon: 'none'
    });
    
    this.closeLessonDialog();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    wx.switchTab({
      url: tab === 'home' ? '/pages/index/index' : 
           tab === 'review' ? '/pages/chat/chat' : 
           '/pages/my/my'
    });
  }
}); 