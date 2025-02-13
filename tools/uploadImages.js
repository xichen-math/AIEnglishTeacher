const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: '您的实际环境ID' // 替换这里的环境ID
});

async function uploadImages() {
  const imageDir = 'D:\\PPT\\MLM_JPG'; // 修改为实际的图片目录
  const files = fs.readdirSync(imageDir).filter(f => f.endsWith('.jpg'));
  
  const uploadTasks = files.map((file, index) => {
    const filePath = path.join(imageDir, file);
    return cloud.uploadFile({
      cloudPath: `ppt/MLM/幻灯片${index + 1}.jpg`,
      filePath: filePath
    });
  });

  try {
    const results = await Promise.all(uploadTasks);
    console.log('上传成功:', results);
    return results.map(res => res.fileID);
  } catch (error) {
    console.error('上传失败:', error);
    throw error;
  }
}

uploadImages()
  .then(fileIDs => {
    console.log('文件ID列表:', fileIDs);
  })
  .catch(console.error); 