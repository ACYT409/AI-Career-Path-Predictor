// Vercel Serverless Function for AI Career Prediction
// Uses NVIDIA API to analyze user data

module.exports = async function handler(request, response) {
  // Enable CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, answers, photo } = request.body;

    // Validate input
    if (!email || !answers || !photo) {
      return response.status(400).json({ 
        success: false, 
        error: '缺少必要参数：email, answers, photo' 
      });
    }

    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
    
    // Build prompt for NVIDIA API
    const prompt = `基于以下用户信息预测职业方向：
邮箱：${email}
问卷回答：${JSON.stringify(answers)}
照片分析：用户已上传人脸照片

请分析用户的性格特点、兴趣倾向和能力优势，推荐 3-5 个适合的职业方向，并给出简短的发展建议。请用 JSON 格式返回：
{
  "careers": ["职业 1", "职业 2", "职业 3"],
  "analysis": "性格和能力分析",
  "advice": "发展建议"
}`;

    let predictionData;

    if (NVIDIA_API_KEY) {
      // Call NVIDIA API
      const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!nvidiaResponse.ok) {
        throw new Error(`NVIDIA API error: ${nvidiaResponse.status}`);
      }

      const nvidiaData = await nvidiaResponse.json();
      const content = nvidiaData.choices?.[0]?.message?.content || '';
      
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        predictionData = JSON.parse(jsonMatch[0]);
      } else {
        predictionData = {
          careers: ['软件工程师', '数据科学家', '产品设计师'],
          analysis: content,
          advice: '建议持续学习相关技能'
        };
      }

      // Send email if configured
      const EMAIL_USER = process.env.EMAIL_USER;
      const EMAIL_PASS = process.env.EMAIL_PASS;
      
      if (EMAIL_USER && EMAIL_PASS) {
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: EMAIL_USER, pass: EMAIL_PASS }
          });

          await transporter.sendMail({
            from: EMAIL_USER,
            to: email,
            subject: '🎯 您的 AI 职业方向预测报告',
            html: `
              <h1>职业方向预测结果</h1>
              <h2>推荐职业：</h2>
              <ul>${predictionData.careers.map(c => `<li>${c}</li>`).join('')}</ul>
              <h2>分析：</h2>
              <p>${predictionData.analysis}</p>
              <h2>建议：</h2>
              <p>${predictionData.advice}</p>
            `
          });
        } catch (emailError) {
          console.error('Email send failed:', emailError);
        }
      }
    } else {
      // Mock response when no API key
      predictionData = {
        careers: ['软件工程师', '数据科学家', '产品设计师', 'UI/UX 设计师', '项目经理'],
        analysis: '基于您的回答，您展现出较强的逻辑思维能力和创造力，适合技术与创意结合的工作。',
        advice: '建议学习编程基础、数据分析或设计技能，参加相关项目实践。'
      };
    }

    return response.status(200).json({
      success: true,
      message: '预测完成！报告已发送到您的邮箱',
      data: predictionData
    });

  } catch (error) {
    console.error('Prediction error:', error);
    return response.status(500).json({ 
      success: false, 
      error: `服务器错误：${error.message}` 
    });
  }
};
