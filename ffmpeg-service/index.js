const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: '/tmp' });

app.post('/convert', upload.single('audio'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join('/tmp', `${Date.now()}.wav`);

  const command = `ffmpeg -y -i ${inputPath} -ar 16000 -ac 1 -f wav ${outputPath}`;
  console.log('执行命令:', command);

  exec(command, (err) => {
    if (err) {
      console.error('转码失败:', err);
      return res.status(500).send('转码失败');
    }

    const result = fs.readFileSync(outputPath);
    res.set('Content-Type', 'audio/wav');
    res.send(result);
  });
});

app.get('/', (req, res) => {
  res.send('ffmpeg 服务运行正常！');
});

const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`服务运行在端口 ${port}`);
});
