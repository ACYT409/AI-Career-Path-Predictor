import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

export async function POST(request: NextRequest) {
  try {
    const { photo, email, answers } = await request.json();

    // Validate inputs
    if (!photo || !email || !answers) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    // Prepare prompt for NVIDIA AI
    const answersText = Object.entries(answers)
      .map(([id, answer]) => `问题${id}: ${answer}`)
      .join("\n");

    const prompt = `你是一位专业的职业咨询师。请根据以下用户问卷回答，分析并预测该用户未来的职业方向。

用户回答：
${answersText}

请提供详细的分析报告，包括：
1. 推荐的3-5个职业方向
2. 每个职业方向的匹配度百分比
3. 短期（1-2年）、中期（3-5年）、长期（5年以上）的技能发展路径
4. 个性化的建议和注意事项

请用中文回复，格式清晰易读。`;

    let aiResult = "";

    // Call NVIDIA API if key is available
    if (NVIDIA_API_KEY) {
      try {
        const nvidiaResponse = await fetch(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${NVIDIA_API_KEY}`,
            },
            body: JSON.stringify({
              model: "meta/llama-3.1-70b-instruct",
              messages: [
                {
                  role: "system",
                  content: "你是一位专业的职业咨询师，擅长根据用户的兴趣、性格和能力特点，提供精准的职业方向建议。",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              temperature: 0.7,
              max_tokens: 1500,
            }),
          }
        );

        if (nvidiaResponse.ok) {
          const data = await nvidiaResponse.json();
          aiResult = data.choices?.[0]?.message?.content || "无法获取 AI 分析结果";
        } else {
          console.error("NVIDIA API Error:", await nvidiaResponse.text());
          aiResult = generateFallbackPrediction(answers);
        }
      } catch (error) {
        console.error("NVIDIA API Call Failed:", error);
        aiResult = generateFallbackPrediction(answers);
      }
    } else {
      // Fallback mode without API key
      aiResult = generateFallbackPrediction(answers);
    }

    // Send email if configured
    if (EMAIL_USER && EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"AI 职业预测系统" <${EMAIL_USER}>`,
          to: email,
          subject: "🔮 你的 AI 职业方向预测报告",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4F46E5;">🔮 AI 职业方向预测报告</h1>
              <p>亲爱的用户，</p>
              <p>感谢你使用我们的 AI 职业预测服务。以下是根据你的问卷回答生成的详细分析报告：</p>
              <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <pre style="white-space: pre-wrap; font-family: inherit;">${aiResult}</pre>
              </div>
              <p style="color: #6B7280; font-size: 14px;">
                <strong>温馨提示：</strong>本报告由 AI 生成，仅供参考。职业规划还需结合实际情况和个人努力。
              </p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
              <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                此邮件由 AI 职业预测系统自动发送
              </p>
            </div>
          `,
        });

        console.log(`Email sent to ${email}`);
      } catch (error) {
        console.error("Email sending failed:", error);
        // Continue even if email fails
      }
    }

    return NextResponse.json({
      result: aiResult,
      emailSent: !!(EMAIL_USER && EMAIL_PASS),
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}

// Fallback prediction without AI
function generateFallbackPrediction(answers: Record<number, string>): string {
  const careerMap: Record<string, string[]> = {
    "解决问题/分析数据": ["数据科学家", "软件工程师", "金融分析师", "系统架构师"],
    "创作设计/艺术表达": ["UI/UX设计师", "平面设计师", "内容创作者", "产品经理"],
    "帮助他人/沟通交流": ["人力资源专家", "教师/培训师", "心理咨询师", "客户成功经理"],
    "组织领导/管理团队": ["项目经理", "运营总监", "创业者", "团队负责人"],
  };

  const interests = Object.values(answers);
  const recommendedCareers: string[] = [];

  interests.forEach((interest) => {
    if (careerMap[interest]) {
      recommendedCareers.push(...careerMap[interest]);
    }
  });

  const uniqueCareers = [...new Set(recommendedCareers)].slice(0, 5);

  return `🎯 职业方向预测分析

基于您的问卷回答，为您推荐以下职业方向：

【推荐职业】
${uniqueCareers.map((c, i) => `${i + 1}. ${c}`).join("\n")}

【发展建议】
• 短期（1-2 年）：学习相关技能，积累项目经验
• 中期（3-5 年）：深耕专业领域，建立行业影响力
• 长期（5 年以上）：成为行业专家或管理者

【个性化建议】
保持好奇心，持续学习，多参与实践项目。职业成功需要时间和坚持，祝您前程似锦！

---
注：这是基础版预测，配置 NVIDIA API Key 后可获得更精准的 AI 分析。`;
}
