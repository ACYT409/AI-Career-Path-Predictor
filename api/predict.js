import nodemailer from 'nodemailer';

// Vercel Serverless Function 配置
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  // --- 1. 強制返回 JSON 格式的跨域處理 ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只接受 POST 請求' });
  }

  try {
    const { email, answers } = req.body;

    // 參數校驗
    if (!email || !answers) {
      return res.status(400).json({ success: false, error: '缺少郵箱或問卷數據' });
    }

    const { NVIDIA_API_KEY, EMAIL_USER, EMAIL_PASS } = process.env;
    let aiReport = null;

    // --- 2. NVIDIA AI 邏輯 ---
    if (NVIDIA_API_KEY) {
      try {
        const prompt = `
          請根據以下測試結果生成職業預測：
          - 活動偏好: ${answers.q1}
          - 環境: ${answers.q2}
          - 挑戰應對: ${answers.q3}
          - 職業價值: ${answers.q4}
          - 信息處理: ${answers.q5}
          
          請直接返回 JSON 格式，不要包含 Markdown 標記：
          {
            "career": "職位名",
            "reason": "為什麼適合的原因",
            "steps": ["短期建議", "中期建議", "長期建議"]
          }
        `;

        const aiResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "meta/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6
          })
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          const content = data.choices[0].message.content;
          // 清理可能存在的 Markdown 格式
          const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
          aiReport = JSON.parse(cleanJson);
        } else {
          console.error('NVIDIA API 返回錯誤代碼:', aiResponse.status);
        }
      } catch (aiErr) {
        console.error('AI 生成環節崩潰:', aiErr.message);
      }
    }

    // --- 3. 兜底方案 (Fallback) ---
    // 確保即便 AI 或解析失敗，前端也能拿到 JSON 數據
    if (!aiReport) {
      const careerMap = {
        'analytical': '系統架構師 / 數據分析師',
        'creative': '交互設計師 / 創意策劃',
        'social': '團隊管理者 / 職業諮詢師',
        'practical': '現場工程師 / 操作專家',
        'leadership': '創業家 / 戰略經理'
      };
      const type = answers.q1 || 'analytical';
      aiReport = {
        career: careerMap[type] || '跨領域綜合人才',
        reason: `您的選擇顯示了強烈的 ${type} 特質，這在當前 AI 時代具備獨特的競爭力。`,
        steps: ['強化底層邏輯思維', '積累具體項目的實戰經驗', '建立行業內深度人脈']
      };
    }

    // --- 4. 郵件發送邏輯 ---
    let emailSent = false;
    if (EMAIL_USER && EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: EMAIL_USER, pass: EMAIL_PASS }
        });

        await transporter.sendMail({
          from: `"AI 職業預測師" <${EMAIL_USER}>`,
          to: email,
          subject: '🔮 您的職業路徑預測報告已生成',
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
              <h2 style="color: #4F46E5;">🎉 預測報告已就緒</h2>
              <p><strong>🎯 推薦職業:</strong> ${aiReport.career}</p>
              <p><strong>💡 理由:</strong> ${aiReport.reason}</p>
              <h3>🛣️ 發展路徑:</h3>
              <ul>${aiReport.steps.map(s => `<li>${s}</li>`).join('')}</ul>
              <p style="color: #888; font-size: 12px; margin-top: 20px;">此報告由 AI Career Predictor 生成</p>
            </div>
          `
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('郵件發送失敗:', mailErr.message);
      }
    }

    // --- 5. 返回標準化響應 ---
    return res.status(200).json({
      success: true,
      report: aiReport,
      emailSent: emailSent
    });

  } catch (globalError) {
    console.error('致命錯誤:', globalError);
    // 最終防禦：確保返回的是 JSON 而不是 HTML
    return res.status(500).json({
      success: false,
      error: '伺服器執行發生錯誤',
      details: globalError.message
    });
  }
}
