// api/predict.js
const nodemailer = require('nodemailer');

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  // 设置 CORS 头
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
    console.log('🚀 [API] Received request');
    const { email, answers, photo } = req.body;

    if (!answers || !email) {
      throw new Error('Missing email or answers');
    }

    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;

    console.log('🔑 [API] API Key exists:', !!NVIDIA_API_KEY);
    console.log('📧 [API] Email Config exists:', !!EMAIL_USER && !!EMAIL_PASS);

    let aiReport = null;
    let reportText = "";

    // 1. 调用 NVIDIA AI (如果有 Key)
    if (NVIDIA_API_KEY) {
      try {
        console.log('🤖 [API] Calling NVIDIA AI...');
        const prompt = `
          用户进行了职业性格测试，结果如下：
          - 活动偏好: ${answers.q1}
          - 工作环境: ${answers.q2}
          - 挑战应对: ${answers.q3}
          - 职业价值: ${answers.q4}
          - 信息处理: ${answers.q5}
          
          请根据以上结果，用中文生成一个简短的职业预测报告，包含：
          1. 推荐职业 (一个具体的职位)
          2. 理由 (一句话解释为什么适合)
          3. 三个发展建议 (短句)
          
          请直接返回 JSON 格式，不要有其他文字：
          {
            "career": "职位名",
            "reason": "理由",
            "steps": ["建议1", "建议2", "建议3"]
          }
        `;

        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "meta/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 200
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('❌ [NVIDIA] API Error:', response.status, errText);
          throw new Error(`NVIDIA API failed: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // 尝试解析 AI 返回的 JSON
        try {
          // 清理可能的 markdown 标记
          const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
          aiReport = JSON.parse(cleanContent);
          console.log('✅ [AI] Report generated:', aiReport);
        } catch (e) {
          console.warn('⚠️ [AI] Parse failed, using fallback', e);
          aiReport = null;
        }
      } catch (aiError) {
        console.error('❌ [AI] Execution failed:', aiError.message);
        aiReport = null;
      }
    } else {
      console.warn('⚠️ [API] No NVIDIA Key provided');
    }

    // 2. 如果没有 AI 报告，使用默认 fallback
    if (!aiReport) {
      const careerMap = {
        'analytical': '数据分析师 / 软件工程师',
        'creative': 'UI/UX 设计师 / 创意总监',
        'social': '人力资源经理 / 心理咨询师',
        'practical': '机械工程师 / 建筑师',
        'leadership': '产品经理 / 项目总监'
      };
      const type = answers.q1 || 'analytical';
      aiReport = {
        career: careerMap[type] || '综合管理人才',
        reason: `基于您选择的${type}倾向，这是最适合您的起步方向。`,
        steps: ['学习核心硬技能', '参与实战项目', '建立行业人脉']
      };
      reportText = `【演示模式】推荐职业：${aiReport.career}\n理由：${aiReport.reason}`;
    } else {
      reportText = `【AI 预测】推荐职业：${aiReport.career}\n理由：${aiReport.reason}\n建议：${aiReport.steps.join(', ')}`;
    }

    // 3. 发送邮件 (如果配置了)
    let emailSent = false;
    if (EMAIL_USER && EMAIL_PASS) {
      try {
        console.log('📧 [Email] Sending to:', email);
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: EMAIL_USER, pass: EMAIL_PASS }
        });

        await transporter.sendMail({
          from: `"AI Career Predictor" <${EMAIL_USER}>`,
          to: email,
          subject: '🎉 您的 AI 职业预测报告已生成',
          text: `您好！\n\n${reportText}\n\n祝您职业发展顺利！\n\n-- AI Career Predictor`,
          html: `
            <h2>🎉 您的职业预测报告</h2>
            <p><strong>🎯 推荐职业:</strong> ${aiReport.career}</p>
            <p><strong>💡 理由:</strong> ${aiReport.reason}</p>
            <h3>🛣️ 发展建议:</h3>
            <ul>${aiReport.steps.map(s => `<li>${s}</li>`).join('')}</ul>
            <hr/>
            <p style="font-size:12px;color:#666;">由 AI Career Predictor 生成</p>
          `
        });
        emailSent = true;
        console.log('✅ [Email] Sent successfully');
      } catch (emailErr) {
        console.error('❌ [Email] Failed:', emailErr.message);
        // 邮件失败不阻断主流程
      }
    }

    // 4. 返回成功 JSON
    return res.status(200).json({
      success: true,
      report: aiReport,
      emailSent: emailSent
    });

  } catch (error) {
    // 全局错误捕获：确保永远返回 JSON
    console.error('💥 [API] CRITICAL ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Server internal error',
      details: error.message
    });
  }
}
