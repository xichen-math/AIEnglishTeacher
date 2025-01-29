// app.js
App({
  globalData: {
    userInfo: null,
    selectedCourse: null,
    // 开发环境使用 HTTP
    baseUrl: 'http://10.32.80.123:5000',
    userId: null
  },
  onLaunch() {
    // 小程序启动时执行的逻辑
  }
}) 