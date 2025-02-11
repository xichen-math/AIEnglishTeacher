// app.js
App({
  globalData: {
    userInfo: null,
    selectedCourse: null,
    userId: null,
    isConnected: true,
    systemInfo: null
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'test-6g0nfnc7f85f8936',  // 修正环境ID
        traceUser: true
      })
    }

    // 初始化或获取 userId
    const userId = wx.getStorageSync('userId');
    if (!userId) {
      // 生成新的 userId
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      wx.setStorageSync('userId', newUserId);
      this.globalData.userId = newUserId;
      console.log('生成新的 userId:', newUserId);
    } else {
      this.globalData.userId = userId;
      console.log('使用已存在的 userId:', userId);
    }

    // 初始化网络状态监听
    this.initNetworkListener();

    // 获取系统信息
    try {
      const systemInfo = {
        ...wx.getDeviceInfo(),
        ...wx.getWindowInfo(),
        ...wx.getAppBaseInfo()
      };
      this.globalData.systemInfo = systemInfo;
    } catch (e) {
      console.error('获取系统信息失败:', e);
    }
  },

  initNetworkListener() {
    // 获取当前网络状态
    wx.getNetworkType({
      success: (res) => {
        this.globalData.isConnected = res.networkType !== 'none';
        console.log('当前网络状态:', res.networkType);
      }
    });

    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      this.globalData.isConnected = res.isConnected;
      console.log('网络状态变化:', res.networkType, '是否有网络:', res.isConnected);
      
      if (!res.isConnected) {
        wx.showToast({
          title: '网络连接已断开',
          icon: 'none'
        });
      }
    });
  }
}) 