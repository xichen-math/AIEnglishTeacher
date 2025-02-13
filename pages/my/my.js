Page({
  data: {
    myCourses: [],
    chatHistories: []
  },

  onShow: function() {
    // 获取我的课程列表
    this.getMyCourses();
    // 获取历史记录
    this.getChatHistories();
  },

  /**
   * 获取我的课程列表
   */
  getMyCourses: function() {
    // 从本地存储获取课程进度
    const courseProgress = wx.getStorageSync('courseProgress') || {};
    
    // 获取所有已学习过的课程
    const myCourses = Object.keys(courseProgress).map(courseId => {
      return {
        id: courseId,
        name: courseProgress[courseId].name,
        progress: courseProgress[courseId].progress
      };
    });

    this.setData({ myCourses });
  },

  /**
   * 获取历史记录
   */
  getChatHistories: function() {
    // 从本地存储获取聊天历史
    const histories = wx.getStorageSync('chatHistories') || [];
    
    // 格式化时间
    const chatHistories = histories.map(history => {
      return {
        ...history,
        timeStr: this.formatTime(history.timestamp)
      };
    });

    this.setData({ chatHistories });
  },

  /**
   * 格式化时间戳
   * @param {number} timestamp - 时间戳
   * @returns {string} 格式化后的时间字符串
   */
  formatTime: function(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}); 