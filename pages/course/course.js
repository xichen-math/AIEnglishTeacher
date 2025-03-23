// pages/course/course.js
Page({

  /**
   * Page initial data
   */
  data: {
    currentTag: 'all',
    courses: [
      {
        id: 1,
        title: '趣味动物教程',
        image: 'https://public.readdy.ai/ai/img_res/ed22c5f23ea29528a6a4ac3553893c51.jpg',
        age: '4-6 岁',
        duration: '30分钟',
        stars: 3,
        level: '初级'
      },
      {
        id: 2,
        title: '水果认知课程',
        image: 'https://public.readdy.ai/ai/img_res/5a9dc6c1dc5092f37097a4683ba3ca8f.jpg',
        age: '3-5 岁',
        duration: '25分钟',
        stars: 2,
        level: '初级'
      },
      {
        id: 3,
        title: '交通工具教程',
        image: 'https://public.readdy.ai/ai/img_res/5ff09a9e958785c1212ce4dfdc3faa8c.jpg',
        age: '5-7 岁',
        duration: '35分钟',
        stars: 4,
        level: '中级'
      },
      {
        id: 4,
        title: '自然科学启蒙',
        image: 'https://public.readdy.ai/ai/img_res/d89b19675804dd7b7a3eee71a4704512.jpg',
        age: '6-8 岁',
        duration: '40分钟',
        stars: 5,
        level: '高级'
      }
    ]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },

  switchTag(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ currentTag: tag });
  }
})