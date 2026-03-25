const { NextResponse } = require('next/server');

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, answers, photo } = body;

    // Validate input
    if (!email || !answers || !photo) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // Here you would typically:
    // 1. Call NVIDIA API to analyze the photo and answers
    // 2. Send email with results
    
    // For now, return a mock response
    return NextResponse.json({
      success: true,
      message: '预测完成！报告已发送到您的邮箱',
      data: {
        prediction: '基于您的回答和照片分析，您适合从事技术类或创意类工作。',
        careers: ['软件工程师', '数据科学家', '产品设计师']
      }
    });

  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
