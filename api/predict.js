// api/predict.js
const nodemailer = require('nodemailer');

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  // 设置 CORS 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, answers, photo } = req.body;

    console.log('📩 Received request from:', email);
    console.log('🔑 NVIDIA_KEY exists:', !!process.env.NVIDIA_API_KEY);
    
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY is missing in Vercel Environment Variables');
    }

    // 1. 构造给 AI 的提示词
    const prompt = `
      基于以下用户数据，预测其未来职业方向。请用 JSON 格式返回，不要包含 markdown 格式。
      格式要求：{ "career": "职业名称", "reason": "简短理由", "steps": ["建议1", "建议2", "建议3"] }
      
      用户数据：
      - 活动偏好: ${answers.q1}
      - 工作环境: ${answers.q2}
      - 挑战应对: ${answers.q3}
      - 职业价值: ${answers.q4}
      - 信息处理: ${answers.q5}
      - 照片分析: (用户已上传人脸照片，假设其形象专业且有亲和力)
      
      请用中文回答。
    `;

    // 2. 调用 NVIDIA API
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct', // 使用免费且快速的模型
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ NVIDIA API Error:', response.status, errText);
      throw new Error(`NVIDIA API failed: ${response.status}`);
    }

    const aiData = await response.json();
    let content = aiData.choices[0].message.content;

    // 清理可能存在的 markdown 标记
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let report;
    try {
      report = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse JSON, using fallback', e);
      report = {
        career: "AI 分析师",
        reason: "基于您的回答，您具备优秀的分析能力。",
        steps: ["学习数据分析工具", "参与实际项目", "考取相关证书"]
      };
    }

    // 3. 发送邮件 (如果配置了邮箱)
    let emailSent = false;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        await transporter.sendMail({
          from: `"AI Career Predictor" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: '🎉 您的 AI 职业预测报告已生成',
          html: `
            <h2>🎉 您的职业预测报告</h2>
            <p><strong>🎯 推荐职业:</strong> ${report.career}</p>
            <p><strong>💡 理由:</strong> ${report.reason}</p>
            <h3>🛣️ 发展建议:</h3>
            <ul>${report.steps.map(s => `<li>${s}</li>`).join('')}</ul>
            <hr/>
            <p style="font-size:12px;color:gray;">此邮件由 AI 自动生成</p>
          `
        });
        emailSent = true;
        console.log('✅ Email sent successfully');
      } catch (emailErr) {
        console.error('Email failed:', emailErr);
        // 邮件失败不阻断主流程
      }
    } else {
      console.log('⚠️ Email config missing, skipping send');
    }

    // 4. 返回成功结果
    return res.status(200).json({ 
      success: true, 
      report, 
      emailSent 
    });

  } catch (error) {
    console.error('💥 Server Error:', error.message);
    // 返回详细错误信息给前端调试
    return res.status(500).json({ 
      error: 'API Processing Failed', 
      details: error.message 
    });
  }
}
