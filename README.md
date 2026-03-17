# 🎯 AI 职业方向预测网站

使用 NVIDIA AI API 技术，通过面部分析和职业问卷预测用户未来职业方向的网站。

## ✨ 功能特点

- **📸  webcam 拍照**: 打开摄像头拍摄用户照片
- **📝 职业问卷**: 收集用户兴趣、性格和工作偏好
- **🤖 AI 分析**: 使用 NVIDIA AI API (40 RPM 免费额度) 进行职业预测
- **📧 邮件发送**: 将预测结果发送到用户邮箱
- **⚡ 速率限制**: 内置 40 次/分钟的请求限制

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# NVIDIA AI API 密钥 (从 https://build.nvidia.com/ 获取)
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx

# 邮箱配置 (用于发送预测结果)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# 服务器端口
PORT=3000
```

### 3. 启动服务

```bash
npm start
```

访问 http://localhost:3000 即可使用。

## 📁 项目结构

```
/workspace
├── public/
│   └── index.html          # 前端页面
├── server.js               # Node.js 后端服务
├── package.json            # 项目配置
├── .env.example            # 环境变量示例
└── README.md               # 说明文档
```

## 🔑 获取 NVIDIA API Key

1. 访问 [NVIDIA Build](https://build.nvidia.com/)
2. 注册/登录账号
3. 创建 API Key
4. 免费额度：40 RPM (Requests Per Minute)

## 📧 邮箱配置

### Gmail
1. 启用两步验证
2. 生成应用专用密码
3. 使用应用密码作为 `EMAIL_PASS`

### 其他邮箱服务商
修改 `server.js` 中的 transporter 配置即可。

## 🌐 使用说明

1. **打开摄像头**: 点击"打开摄像头"按钮
2. **拍摄照片**: 调整位置后点击"拍照"
3. **填写邮箱**: 输入接收结果的邮箱地址
4. **回答问题**: 完成 5 个职业相关问题
5. **提交预测**: 点击提交，等待 AI 分析
6. **查收邮件**: 查看详细的职业预测报告

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (原生)
- **后端**: Node.js, Express
- **AI**: NVIDIA AI API (Llama 3.1 405B)
- **邮件**: Nodemailer

## ⚠️ 注意事项

- 需要现代浏览器支持 webcam API
- 首次使用需要允许摄像头权限
- 没有配置 NVIDIA API Key 时会使用模拟预测
- 没有配置邮箱时不会发送邮件（但预测仍会进行）

## 📄 License

MIT
