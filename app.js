// app.js
App({
  globalData: {
    userInfo: null,
    selectedCourse: null,
    // 服务器配置
    baseUrl: '',
    userId: null,
    isConnected: false,
    serverConnected: false
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

    // 初始化网络状态监听
    this.initNetworkListener();
    // 初始化服务器地址
    this.initServerUrl();
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
  },

  initServerUrl() {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    console.log('系统信息:', systemInfo);
    
    // 设置服务器地址
    // 使用ngrok提供的公网地址
    this.globalData.baseUrl = 'https://e910-2404-f801-9000-18-abc7-1ab1-66fe-4462.ngrok-free.app';  // 请将此处替换为您在ngrok窗口看到的实际地址
    
    // 测试服务器连接
    this.testServerConnection();
  },

  testServerConnection() {
    console.log('测试服务器连接:', this.globalData.baseUrl);
    
    wx.request({
      url: `${this.globalData.baseUrl}/api/ping`,
      method: 'GET',
      timeout: 5000,
      success: (res) => {
        if (res.statusCode === 200) {
          console.log('服务器连接测试成功:', res.data);
          this.globalData.serverConnected = true;
        } else {
          this.handleServerError(res.statusCode);
        }
      },
      fail: (error) => {
        console.error('服务器连接测试失败:', error);
        this.globalData.serverConnected = false;
        
        // 检查具体错误类型
        if (error.errMsg.includes('timeout')) {
          wx.showToast({
            title: '服务器响应超时',
            icon: 'none',
            duration: 3000
          });
        } else if (error.errMsg.includes('fail')) {
          wx.showToast({
            title: '无法连接到服务器',
            icon: 'none',
            duration: 3000
          });
        }
      }
    });
  },

  handleServerError(statusCode) {
    let message = '服务器连接异常';
    switch (statusCode) {
      case 404:
        message = '服务器接口不存在';
        break;
      case 500:
        message = '服务器内部错误';
        break;
      case 503:
        message = '服务器暂时不可用';
        break;
    }
    
    console.error(`服务器错误: ${statusCode}`, message);
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
  }
}) 