// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const configCollection = db.collection('configs')

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, promptName } = event
  const wxContext = cloud.getWXContext()

  try {
    switch (action) {
      case 'list':
        // 获取所有prompt文件列表
        const { data: configs } = await configCollection
          .where({
            type: 'prompt_config'
          })
          .orderBy('uploadTime', 'desc')
          .get()
        
        return {
          success: true,
          configs
        }

      case 'use':
        // 使用指定的prompt文件
        if (!promptName) {
          throw new Error('promptName is required')
        }

        const fileID = `cloud://test-123.test/prompts/${promptName}`
        
        // 更新配置数据库
        await configCollection.where({
          type: 'prompt_config'
        }).remove()

        const configResult = await configCollection.add({
          data: {
            type: 'prompt_config',
            promptPath: fileID,
            uploadTime: Date.now(),
            name: promptName,
            _openid: wxContext.OPENID
          }
        })

        return {
          success: true,
          fileID,
          configId: configResult._id
        }

      case 'get':
        // 获取当前使用的prompt内容
        const { data: currentConfigs } = await configCollection
          .where({
            type: 'prompt_config'
          })
          .get()

        if (!currentConfigs || currentConfigs.length === 0) {
          return {
            success: false,
            error: '没有找到正在使用的prompt配置'
          }
        }

        const result = await cloud.downloadFile({
          fileID: currentConfigs[0].promptPath
        })

        return {
          success: true,
          content: result.fileContent.toString('utf8'),
          config: currentConfigs[0]
        }

      default:
        throw new Error('未知的操作类型')
    }
  } catch (error) {
    console.error('Prompt管理失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 