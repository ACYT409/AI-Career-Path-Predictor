# AI 职业方向预测网站

使用 Vite + React 构建的 AI 职业预测应用，利用 NVIDIA AI API 分析用户照片和问卷回答，生成个性化职业方向建议。

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
创建 `.env` 文件：
```env
NVIDIA_API_KEY=nvapi-your-key-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. 启动服务

**前端开发服务器：**
```bash
npm run dev
```
访问 http://localhost:5173

**后端 API 服务器（新终端窗口）：**
```bash
npm run server
```
API 运行在 http://localhost:3001

## 📦 部署说明

### Vercel 部署
1. 连接 GitHub 仓库到 Vercel
2. Vercel 会自动检测 Vite 项目
3. 添加环境变量：`NVIDIA_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`

### 后端部署选项
由于 Vercel 主要托管静态站点，后端 API 需要单独部署：

**选项 A：使用 Railway/Render**
```bash
# 部署到 Railway
railway up

# 或部署到 Render
render deploy
```

**选项 B：Vercel Serverless Functions**
将 `api/server.js` 改为 Vercel Function 格式。

## 🔑 获取 API Key

### NVIDIA API Key
1. 访问 https://build.nvidia.com/
2. 注册并创建 API Key（免费 40 RPM）

### Gmail App Password
1. Google Account → 安全性
2. 启用两步验证
3. 生成 "App Password"

## 🛠️ 技术栈

- **Frontend**: Vite + React 18
- **Backend**: Express.js
- **AI**: NVIDIA NIM (Llama 3.1 70B)
- **Email**: Nodemailer
