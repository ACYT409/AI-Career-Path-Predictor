import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY
const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASS = process.env.EMAIL_PASS

// 职业预测 API
app.post('/api/predict', async (req, res) => {
  const { photo, email, answers } = req.body
  
  console.log('📥 Received prediction request')
  console.log('Email:', email)
  
  // 构建提示词
  const prompt = `基于以下用户信息，请进行详细的职业方向分析和预测：

【用户回答】
- 兴趣爱好：${answers.interests || '未提供'}
- 擅长技能：${answers.skills || '未提供'}
- 工作方式偏好：${answers.workStyle || '未提供'}
- 职业价值观：${answers.values || '未提供'}
- 相关经历：${answers.experience || '未提供'}

【照片分析】
用户已上传人脸照片（照片数据已接收）。

请根据以上信息，生成一份详细的职业预测报告，包括：
1. 推荐的 3-5 个职业方向及理由
2. 每个职业的发展前景
3. 需要提升的技能建议（分短期、中期、长期）
4. 个性化的职业发展建议

请用中文回复，语气鼓励且专业。`

  let aiResult = null
  
  // 调用 NVIDIA AI API
  if (NVIDIA_API_KEY) {
    try {
      console.log('🤖 Calling NVIDIA AI API...')
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [
            {
              role: 'system',
              content: '你是一位专业的职业规划师，擅长根据用户的兴趣、技能和性格特点提供精准的职业方向建议。请用中文回复，内容详细且具有可操作性。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })
      
      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status}`)
      }
      
      const data = await response.json()
      aiResult = data.choices?.[0]?.message?.content || '无法生成预测结果'
      console.log('✅ AI prediction generated successfully')
      
    } catch (error) {
      console.error('❌ NVIDIA API call failed:', error.message)
      aiResult = null
    }
  } else {
    console.log('⚠️ No NVIDIA API key configured, using mock prediction')
  }
  
  // 如果没有 API key 或调用失败，使用模拟结果
  if (!aiResult) {
    aiResult = `尊敬的求职者，

基于您提供的信息，我们为您分析了以下职业方向：

【推荐职业】
1. 软件工程师 - 适合喜欢逻辑思考和技术创新的人
2. 数据科学家 - 结合数学统计与编程技能
3. 产品经理 - 需要沟通协调和战略思维
4. UI/UX设计师 - 发挥创意和用户同理心
5. 技术顾问 - 运用专业知识解决复杂问题

【发展建议】
短期（1年内）：夯实基础技能，完成相关认证
中期（2-3年）：积累项目经验，建立专业人脉
长期（5年以上）：成为领域专家或转向管理岗位

【个性化建议】
持续学习新技术，保持对行业趋势的敏感度。建议参加行业会议、在线课程和开源项目来提升竞争力。

祝您职业发展顺利！`
  }
  
  // 发送邮件
  let emailSent = false
  if (EMAIL_USER && EMAIL_PASS && email) {
    try {
      console.log('📧 Sending email to:', email)
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS
        }
      })
      
      await transporter.sendMail({
        from: `"AI Career Predictor" <${EMAIL_USER}>`,
        to: email,
        subject: '🔮 您的 AI 职业方向预测报告',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">🔮 AI 职业方向预测报告</h1>
            <p>感谢您使用我们的 AI 职业预测服务！以下是为您生成的详细分析报告：</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
              ${aiResult.replace(/\n/g, '<br>')}
            </div>
            <p style="color: #666; font-size: 14px;">此报告由 AI 生成，仅供参考。实际职业选择请结合个人情况和专业建议。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">© 2024 AI Career Predictor. All rights reserved.</p>
          </div>
        `
      })
      
      emailSent = true
      console.log('✅ Email sent successfully')
      
    } catch (error) {
      console.error('❌ Email sending failed:', error.message)
    }
  }
  
  res.json({
    success: true,
    prediction: aiResult,
    emailSent,
    message: emailSent ? '预测完成，报告已发送至邮箱' : '预测完成（邮件未发送，可能未配置邮箱）'
  })
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📍 API endpoint: http://localhost:${PORT}/api/predict`)
})
