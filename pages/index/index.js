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
    ]
  },

  onLoad: function() {
    // 页面加载时的初始化逻辑
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
  }
}); 