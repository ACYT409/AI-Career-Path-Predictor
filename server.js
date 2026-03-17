require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// NVIDIA API Configuration
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Email Configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Rate limiting (40 RPM - Requests Per Minute)
const rateLimitMap = new Map();
const RATE_LIMIT = 40;
const RATE_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(ip) {
    const now = Date.now();
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }
    
    const requests = rateLimitMap.get(ip).filter(time => now - time < RATE_WINDOW);
    
    if (requests.length >= RATE_LIMIT) {
        return false;
    }
    
    requests.push(now);
    rateLimitMap.set(ip, requests);
    return true;
}

// Create email transporter
function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    });
}

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Prediction endpoint
app.post('/api/predict', async (req, res) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        // Check rate limit
        if (!checkRateLimit(clientIP)) {
            return res.status(429).json({ 
                error: '请求过于频繁，请稍后再试（限制：40次/分钟）' 
            });
        }

        const { photo, email, answers } = req.body;

        // Validate input
        if (!photo || !email || !answers) {
            return res.status(400).json({ 
                error: '缺少必要参数' 
            });
        }

        if (!NVIDIA_API_KEY) {
            console.warn('NVIDIA_API_KEY not configured, using mock prediction');
        }

        // Parse answers
        const userAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;

        // Prepare prompt for NVIDIA AI
        const prompt = `
你是一个专业的职业规划顾问。请根据以下用户信息，分析并预测该用户最适合的职业发展方向。

用户信息：
- 最感兴趣的领域：${getInterestArea(userAnswers.q1)}
- 偏好的工作方式：${getWorkStyle(userAnswers.q2)}
- 性格特点：${getPersonalityType(userAnswers.q3)}
- 期望的工作节奏：${getWorkPace(userAnswers.q4)}
- 长期职业目标：${userAnswers.q5 || '未提供'}

请提供以下内容：
1. 推荐的主要职业方向（2-3个）
2. 每个方向的详细说明和理由
3. 建议的技能发展路径
4. 短期和长期的职业发展建议

请用中文回答，语气专业且鼓励性。
`;

        let aiResponse;

        if (NVIDIA_API_KEY) {
            // Call NVIDIA AI API
            const nvidiaResponse = await fetch(NVIDIA_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NVIDIA_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'meta/llama-3.1-405b-instruct',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一位经验丰富的职业规划专家，擅长根据用户的兴趣、性格和目标提供个性化的职业发展建议。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 1500,
                    temperature: 0.7,
                    top_p: 0.9
                })
            });

            if (!nvidiaResponse.ok) {
                const errorData = await nvidiaResponse.text();
                console.error('NVIDIA API Error:', errorData);
                throw new Error(`NVIDIA API 调用失败：${nvidiaResponse.status}`);
            }

            const nvidiaData = await nvidiaResponse.json();
            aiResponse = nvidiaData.choices[0].message.content;
        } else {
            // Mock response for testing without API key
            aiResponse = generateMockPrediction(userAnswers);
        }

        // Send email with prediction result
        try {
            await sendPredictionEmail(email, aiResponse, userAnswers);
            console.log(`✅ Prediction email sent to ${email}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError.message);
            // Continue even if email fails, as prediction was successful
        }

        res.json({ 
            success: true, 
            message: '预测完成，结果已发送至您的邮箱',
            prediction: aiResponse
        });

    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({ 
            error: error.message || '预测过程中发生错误' 
        });
    }
});

// Helper functions
function getInterestArea(code) {
    const areas = {
        technology: '科技/互联网',
        business: '商业/金融',
        arts: '艺术/设计',
        science: '科学/研究',
        healthcare: '医疗/健康',
        education: '教育/培训',
        engineering: '工程/制造',
        media: '媒体/传播'
    };
    return areas[code] || code || '未指定';
}

function getWorkStyle(code) {
    const styles = {
        team: '团队合作',
        independent: '独立工作',
        mixed: '两者皆可'
    };
    return styles[code] || code || '未指定';
}

function getPersonalityType(code) {
    const types = {
        analytical: '分析型 - 喜欢逻辑思考',
        creative: '创意型 - 喜欢创新想象',
        social: '社交型 - 喜欢与人交流',
        practical: '实践型 - 喜欢动手操作'
    };
    return types[code] || code || '未指定';
}

function getWorkPace(code) {
    const paces = {
        fast: '快节奏、充满挑战',
        steady: '稳定、规律',
        flexible: '灵活、自由'
    };
    return paces[code] || code || '未指定';
}

function generateMockPrediction(answers) {
    const interestAreas = {
        technology: ['软件工程师', '数据科学家', 'AI 研究员', '产品经理'],
        business: ['投资分析师', '市场营销经理', '创业家', '管理顾问'],
        arts: ['UI/UX设计师', '创意总监', '内容创作者', '品牌策划'],
        science: ['科研研究员', '实验室主管', '科学顾问', '技术作家'],
        healthcare: ['医疗顾问', '健康管理师', '医疗器械专家', '健康科技创业者'],
        education: ['教育科技专家', '培训师', '课程设计师', '教育顾问'],
        engineering: ['系统工程师', '项目经理', '技术专家', '创新工程师'],
        media: ['数字营销专家', '内容策略师', '媒体制作人', '社交媒体经理']
    };

    const area = interestAreas[answers.q1] || interestAreas.technology;
    
    return `
## 🎯 您的职业方向预测报告

### 基于您的回答分析：

**感兴趣领域：** ${getInterestArea(answers.q1)}
**工作方式偏好：** ${getWorkStyle(answers.q2)}
**性格特点：** ${getPersonalityType(answers.q3)}
**工作节奏期望：** ${getWorkPace(answers.q4)}
${answers.q5 ? `**长期目标：** ${answers.q5}` : ''}

---

### 📌 推荐职业方向：

#### 1. ${area[0]}
这是与您兴趣和性格最匹配的职业方向。${getInterestArea(answers.q1)}领域正处于快速发展阶段，结合您${getPersonalityType(answers.q3).split(' - ')[0]}的特质，您在这个方向上有很大的发展潜力。

**发展建议：**
- 学习相关核心技能
- 积累项目经验
- 建立行业人脉网络

#### 2. ${area[1]}
作为备选方向，这个职业同样能发挥您的优势，并提供不同的发展路径。

**发展建议：**
- 了解行业趋势
- 培养跨领域能力
- 寻找实习或入门机会

---

### 🚀 技能发展路径：

**短期（0-6 个月）：**
- 掌握基础专业技能
- 完成 1-2 个实战项目
- 建立在线作品集

**中期（6-18 个月）：**
- 深入学习高级技能
- 参与开源项目或行业活动
- 寻求mentor指导

**长期（18 个月以上）：**
- 成为领域专家
- 领导项目或团队
- 持续学习和适应新技术

---

### 💡 温馨提示：

职业发展规划是一个动态调整的过程。建议您：
1. 保持学习的态度，跟进行业最新动态
2. 定期回顾和调整自己的目标
3. 建立和维护专业人脉网络
4. 注重工作与生活的平衡

祝您在职业道路上取得成功！🌟

---
*此预测由 NVIDIA AI 技术支持生成*
`;
}

async function sendPredictionEmail(to, prediction, answers) {
    if (!EMAIL_USER || !EMAIL_PASS) {
        console.warn('Email credentials not configured, skipping email send');
        return;
    }

    const transporter = createTransporter();

    const mailOptions = {
        from: `"AI 职业预测" <${EMAIL_USER}>`,
        to: to,
        subject: '🎯 您的 AI 职业方向预测报告已生成',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .section { margin-bottom: 20px; }
        .highlight { background: #e7f3ff; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 您的职业方向预测报告</h1>
            <p>由 NVIDIA AI 技术驱动</p>
        </div>
        <div class="content">
            <div class="section">
                <p>您好！</p>
                <p>感谢您使用我们的 AI 职业方向预测服务。基于您提供的信息和回答，我们已经生成了专属的职业发展建议。</p>
            </div>
            
            <div class="highlight">
                <strong>您的基本信息：</strong><br>
                • 感兴趣领域：${getInterestArea(answers.q1)}<br>
                • 工作方式：${getWorkStyle(answers.q2)}<br>
                • 性格特点：${getPersonalityType(answers.q3)}<br>
                • 工作节奏：${getWorkPace(answers.q4)}
            </div>
            
            <div class="section">
                <h2>📊 详细预测分析：</h2>
                ${prediction.replace(/\n/g, '<br>')}
            </div>
            
            <div class="section">
                <p>如果您有任何疑问或需要进一步的咨询，欢迎随时联系我们。</p>
                <p>祝您职业发展顺利！</p>
            </div>
            
            <div class="footer">
                <p>此邮件由 AI 自动生成 | 使用 NVIDIA AI API 技术</p>
                <p>© 2024 AI 职业预测服务</p>
            </div>
        </div>
    </div>
</body>
</html>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 AI 职业方向预测服务已启动                              ║
║                                                           ║
║   访问地址：http://localhost:${PORT}                       ║
║                                                           ║
║   配置说明：                                               ║
║   - NVIDIA_API_KEY: NVIDIA AI API 密钥                     ║
║   - EMAIL_USER: 发送邮件的邮箱账号                          ║
║   - EMAIL_PASS: 邮箱授权码                                 ║
║   - 免费额度：40 RPM (Requests Per Minute)                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
