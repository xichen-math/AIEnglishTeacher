const fs = require('fs');
const path = require('path');
const libre = require('libreoffice-convert');
const cloud = require('wx-server-sdk');

cloud.init({
  env: 'prod-2gzhco766f1f0192'
});

async function convertPPTToImages() {
  try {
    const inputPath = 'D:\\PPT\\MLM.pptx';
    const outputDir = path.join(__dirname, 'temp');
    
    // 创建临时目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // 读取PPT文件
    const pptxBuffer = fs.readFileSync(inputPath);
    
    // 转换为PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      libre.convert(pptxBuffer, '.pdf', undefined, (err, done) => {
        if (err) {
          reject(err);
        } else {
          resolve(done);
        }
      });
    });

    // 保存PDF
    const pdfPath = path.join(outputDir, 'temp.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);

    // 使用pdf2pic将PDF转换为图片
    const { fromPath } = require('pdf2pic');
    const options = {
      density: 300,
      saveFilename: "slide",
      savePath: outputDir,
      format: "jpg",
      width: 1024,
      height: 768
    };

    const convert = fromPath(pdfPath, options);
    const pageCount = await convert.getPageCount();
    
    // 转换每一页
    const imagePromises = [];
    for (let i = 1; i <= pageCount; i++) {
      imagePromises.push(convert.convert(i));
    }
    await Promise.all(imagePromises);

    // 上传到云存储
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.jpg'));
    const uploadTasks = files.map((file, index) => {
      const filePath = path.join(outputDir, file);
      const fileContent = fs.readFileSync(filePath);
      
      return cloud.uploadFile({
        cloudPath: `ppt/MLM/幻灯片${index + 1}.jpg`,
        fileContent: fileContent
      });
    });

    const results = await Promise.all(uploadTasks);
    console.log('上传成功:', results);

    // 清理临时文件
    fs.rmSync(outputDir, { recursive: true });

    return results.map(result => result.fileID);
  } catch (error) {
    console.error('转换失败:', error);
    throw error;
  }
}

// 运行转换
convertPPTToImages()
  .then(fileIDs => {
    console.log('文件ID列表:', fileIDs);
  })
  .catch(error => {
    console.error('处理失败:', error);
  }); 