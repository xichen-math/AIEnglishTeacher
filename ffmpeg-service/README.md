# ffmpeg-service 云托管部署服务

这是一个用于将上传音频（.aac/.m4a）转码为 16KHz PCM WAV 格式的微信云托管服务。

## 接口说明

### POST /convert

- 接收字段：`audio`（音频文件，.aac/.m4a）
- 返回值：WAV 格式音频（audio/wav）

### GET /

- 用于测试服务是否正常运行，返回 "ffmpeg 服务运行正常！"

## 部署方法

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)，进入云开发 > 云托管
2. 创建服务（Dockerfile 模式）
3. 上传本目录所有文件
4. 点击部署，构建完成后即可访问
