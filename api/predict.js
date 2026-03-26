const nodemailer = require('nodemailer');

// 禁用 Vercel 的自动身体解析，我们手动处理
export const config = {
  api: {
    bodyParser: true,
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
    console.log('🚀 [API] 收到请求...');
    
    const { email, answers, photo } = req.body;

    if (!answers || !email) {
      throw new Error('缺少必要参数：email 或 answers');
    }

    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;

    console.log('🔑 [API] API Key 存在:', !!NVIDIA_API_KEY);
    console.log('📧 [API] 邮箱配置存在:', !!EMAIL_USER && !!EMAIL_PASS);

    let aiReport = null;
    let reportText = "";

    // 1. 调用 NVIDIA AI
    if (NVIDIA_API_KEY) {
      try {
        console.log('🤖 [API] 正在调用 NVIDIA AI...');
        const prompt = `
          用户职业性格测试回答：
          - 活动偏好: ${answers.q1}
          - 工作环境: ${answers.q2}
          - 挑战应对: ${answers.q3}
          - 职业价值: ${answers.q4}
          - 信息处理: ${answers.q5}
          
          请根据以上回答，用 JSON 格式推荐一个最适合的职业方向。
          格式要求：
          {
            "career": "职业名称",
            "reason": "简短的匹配理由 (50字以内)",
            "steps": ["建议1", "建议2", "建议3"]
          }
          只返回 JSON，不要包含 markdown 标记或其他文字。
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
            temperature: 0.2,
            max_tokens: 500
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('❌ [NVIDIA] HTTP Error:', response.status, errText);
          throw new Error(`NVIDIA API 错误: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // 清理可能存在的 markdown 标记
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        aiReport = JSON.parse(cleanJson);
        console.log('✅ [AI] 成功获取报告:', aiReport);
        
        reportText = `
          推荐职业：${aiReport.career}
          理由：${aiReport.reason}
          建议步骤：${aiReport.steps.join(', ')}
        `;

      } catch (aiError) {
        console.error('⚠️ [AI] AI 调用失败，使用降级方案:', aiError.message);
        // 降级方案
        aiReport = getFallbackReport(answers);
      }
    } else {
      console.warn('⚠️ [API] 未配置 NVIDIA_API_KEY，使用降级方案');
      aiReport = getFallbackReport(answers);
    }

    // 2. 发送邮件 (如果配置了)
    let emailSent = false;
    if (EMAIL_USER && EMAIL_PASS) {
      try {
        console.log('📧 [API] 正在发送邮件...');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: EMAIL_USER, pass: EMAIL_PASS }
        });

        await transporter.sendMail({
          from: `"AI Career Predictor" <${EMAIL_USER}>`,
          to: email,
          subject: '🎉 你的 AI 职业预测报告已生成',
          text: `你好！\n\n基于你的测试，AI 为你推荐：\n\n${reportText}\n\n祝你前程似锦！`,
          html: `
            <h2>🎉 你的 AI 职业预测报告</h2>
            <p><strong>推荐职业：</strong> ${aiReport.career}</p>
            <p><strong>匹配理由：</strong> ${aiReport.reason}</p>
            <h3>🛣️ 发展建议：</h3>
            <ul>${aiReport.steps.map(s => `<li>${s}</li>`).join('')}</ul>
            <hr/>
            <p style="color:#666; font-size:12px;">此邮件由 AI 自动生成</p>
          `
        });
        emailSent = true;
        console.log('✅ [Email] 邮件发送成功');
      } catch (emailError) {
        console.error('❌ [Email] 邮件发送失败:', emailError.message);
        // 邮件失败不阻断主流程
      }
    }

    // 3. 返回成功 JSON
    return res.status(200).json({
      success: true,
      report: aiReport,
      emailSent: emailSent
    });

  } catch (error) {
    // ⚠️ 关键：捕获所有未处理的错误，并返回合法的 JSON，防止前端报 "Unexpected token"
    console.error('💥 [API] 严重崩溃:', error);
    return res.status(500).json({
      error: '服务器内部错误',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// 降级方案函数
function getFallbackReport(answers) {
  const map = {
    'analytical': { career: '数据科学家 / 后端工程师', reason: '你擅长逻辑分析', steps: ['学习 Python/SQL', '做数据分析项目', '考取相关证书'] },
    'creative': { career: 'UI/UX 设计师', reason: '你富有创造力', steps: ['学习 Figma', '建立作品集', '实习积累经验'] },
    'social': { career: '人力资源专家', reason: '你善于与人沟通', steps: ['学习心理学', '考取 HR 证书', '参与社团管理'] },
    'practical': { career: '硬件工程师', reason: '你喜欢动手操作', steps: ['学习电路知识', '参加机器人大赛', '工厂实习'] },
    'leadership': { career: '产品经理', reason: '你有领导潜质', steps: ['学习项目管理', '理解商业模式', '主导校园项目'] }
  };
  return map[answers.q1] || { career: '综合管理人才', reason: '你的能力很全面', steps: ['广泛涉猎', '寻找导师', '多尝试不同领域'] };
}
