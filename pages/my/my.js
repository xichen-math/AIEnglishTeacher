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
    wx.switchTab({
      url: '/pages/course/course'
    });
  }
}); 