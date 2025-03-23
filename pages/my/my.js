Page({
  data: {
    currentTab: 'ongoing'
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 跳转到课程列表
  goCourseList() {
    wx.navigateTo({
      url: '/pages/chat/chat?courseId=1&title=趣味动物教程'
    });
  }
}); 