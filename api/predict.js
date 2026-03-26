import nodemailer from 'nodemailer';

// Vercel Serverless 配置
export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  // 設置跨域與響應頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: '只接受 POST 請求' });

  try {
    const { email, answers } = req.body;
    const { NVIDIA_API_KEY, EMAIL_USER, EMAIL_PASS } = process.env;
    let aiReport = null;

    if (NVIDIA_API_KEY) {
      try {
        const prompt = `你是一位專業職業規劃師。請根據問卷生成JSON報告。
        結果：活動=${answers.q1}, 環境=${answers.q2}, 挑戰=${answers.q3}, 價值=${answers.q4}, 處理=${answers.q5}。
        必須嚴格遵守此JSON格式，不要有任何其他文字：
        { "career": "職位名", "reason": "理由", "steps": ["建議1", "建議2", "建議3"] }`;

        const aiResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: "meta/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1 
          })
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          const content = data.choices[0].message.content;
          const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
          const raw = JSON.parse(cleanJson);

          // 【關鍵：數據清洗】防止 [object Object]
          aiReport = {
            career: typeof raw.career === 'object' ? (raw.career.name || raw.career.title || "專業人才") : (raw.career || "專業人才"),
            reason: raw.reason || raw.explanation || "基於您的特質分析得出。",
            steps: Array.isArray(raw.steps) ? raw.steps.map(s => typeof s === 'object' ? (s.text || s.desc || "持續學習") : s) : ["提升技能", "實踐項目", "拓展人脈"]
          };
        }
      } catch (e) {
        console.error('AI 解析失敗:', e);
      }
    }

    // 兜底方案
    if (!aiReport) {
      const map = { 'analytical': '數據工程師', 'creative': '視覺設計師', 'social': '諮詢顧問', 'practical': '技術專家', 'leadership': '項目經理' };
      aiReport = {
        career: map[answers.q1] || '全能型人才',
        reason: '由於 AI 響應異常，這是基於您首選傾向的預測報告。',
        steps: ['掌握核心工具', '建立作品集', '尋找行業導師']
      };
    }

    // 發送郵件
    if (EMAIL_USER && EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS } });
        await transporter.sendMail({
          from: `"AI Predictor" <${EMAIL_USER}>`,
          to: email,
          subject: '🔮 您的職業預測報告',
          html: `<h2>🎯 推薦職業: ${aiReport.career}</h2><p>💡 理由: ${aiReport.reason}</p><ul>${aiReport.steps.map(s => `<li>${s}</li>`).join('')}</ul>`
        });
      } catch (mE) {
        console.error('郵件發送失敗:', mE);
      }
    }

    return res.status(200).json({ success: true, report: aiReport, emailSent: !!(EMAIL_USER && EMAIL_PASS) });

  } catch (error) {
    return res.status(500).json({ success: false, error: '伺服器錯誤', details: error.message });
  }
}
