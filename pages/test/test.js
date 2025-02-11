Page({
  data: {
    initResult: '',
    promptContent: '',
    loading: false
  },

  // 初始化Prompt
  async initPrompt() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'init'
      });
      console.log('初始化结果：', res);
      this.setData({
        initResult: JSON.stringify(res.result, null, 2)
      });
    } catch (err) {
      console.error('初始化失败：', err);
      wx.showToast({
        title: '初始化失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 验证Prompt内容
  async checkPrompt() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'prompt',
        data: {
          action: 'get'
        }
      });
      console.log('Prompt内容：', res);
      this.setData({
        promptContent: res.result.content
      });
    } catch (err) {
      console.error('获取Prompt失败：', err);
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 测试对话
  async testChat() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'chat',
        data: {
          text: 'hi',
          userId: 'test_user'
        }
      });
      console.log('对话测试结果：', res);
      wx.showModal({
        title: '对话测试结果',
        content: res.result.aiReply,
        showCancel: false
      });
    } catch (err) {
      console.error('对话测试失败：', err);
      wx.showToast({
        title: '测试失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
}) 