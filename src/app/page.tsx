"use client";

import { useState, useRef, useEffect } from "react";

interface Question {
  id: number;
  text: string;
  options: string[];
}

const questions: Question[] = [
  {
    id: 1,
    text: "你最喜欢做什么类型的事情？",
    options: ["解决问题/分析数据", "创作设计/艺术表达", "帮助他人/沟通交流", "组织领导/管理团队"],
  },
  {
    id: 2,
    text: "你更倾向于哪种工作环境？",
    options: ["独立工作", "小组协作", "大型团队", "灵活多变"],
  },
  {
    id: 3,
    text: "你对以下哪个领域最感兴趣？",
    options: ["科技/编程", "商业/金融", "教育/培训", "医疗/健康"],
  },
  {
    id: 4,
    text: "你如何处理压力和挑战？",
    options: ["冷静分析找解决方案", "寻求他人帮助", "暂时回避调整心态", "直接面对快速行动"],
  },
  {
    id: 5,
    text: "你希望未来的工作有什么特点？",
    options: ["高收入/稳定性", "创造性/自由度", "社会影响力", "工作生活平衡"],
  },
];

export default function Home() {
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openWebcam = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
        videoRef.current.play().catch(() => {});
      }
      
      setWebcamOpen(true);
    } catch (err: any) {
      setCameraError(err.name === "NotAllowedError"
        ? "摄像头权限被拒绝，请在浏览器设置中允许访问"
        : "无法访问摄像头，请检查设备连接");
      console.error(err);
      setWebcamOpen(false);
    }
  };

  const closeWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setWebcamOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // 使用默认尺寸或视频实际尺寸
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoData = canvas.toDataURL("image/png");
        setPhoto(photoData);
        closeWebcam();
      }
    }
  };

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!photo || !email || Object.keys(answers).length < questions.length) {
      alert("请完成所有步骤：拍照、填写邮箱、回答所有问题");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("email", email);
      formData.append("answers", JSON.stringify(answers));

      const response = await fetch("/api/predict", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        setResult(data.result);
      } else {
        alert(data.error || "提交失败，请稍后重试");
      }
    } catch (err) {
      alert("网络错误，请稍后重试");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          🔮 AI 职业方向预测
        </h1>
        <p className="text-center text-gray-600 mb-8">
          使用 NVIDIA AI 分析你的特征，预测未来职业方向
        </p>

        {/* Webcam Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">📸 拍摄照片</h2>

          {cameraError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{cameraError}</p>
              <button
                onClick={() => setCameraError(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                关闭错误提示
              </button>
            </div>
          )}

          {!photo ? (
            <div className="space-y-4">
              {!webcamOpen ? (
                <button
                  onClick={openWebcam}
                  className="w-full py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  打开摄像头
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ minHeight: "480px" }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={takePhoto}
                      className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      📷 确认拍照
                    </button>
                    <button
                      onClick={closeWebcam}
                      className="flex-1 py-3 px-6 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <div className="space-y-4">
              <img
                src={photo}
                alt="已拍摄的照片"
                className="w-full rounded-lg border-2 border-indigo-300"
              />
              <button
                onClick={() => setPhoto(null)}
                className="w-full py-3 px-6 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                🔄 重拍
              </button>
            </div>
          )}
        </div>

        {/* Email Input */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">📧 接收结果的邮箱</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your-email@example.com"
            className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <p className="mt-2 text-sm text-gray-500">
            预测结果将发送到此邮箱
          </p>
        </div>

        {/* Questions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">❓ 职业倾向问卷</h2>
          <div className="space-y-6">
            {questions.map((q) => (
              <div key={q.id} className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-800 mb-3">{q.text}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(q.id, option)}
                      className={`py-2 px-4 rounded-lg text-left transition-all ${
                        answers[q.id] === option
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-4 px-6 rounded-lg font-medium text-lg transition-colors ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {loading ? "⏳ 正在分析中..." : "🚀 提交并获取预测"}
          </button>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-green-800 mb-4">
              ✅ 预测完成！
            </h3>
            <p className="text-green-700 mb-4">
              详细预测报告已发送至 <strong>{email}</strong>
            </p>
            {result && (
              <div className="bg-white rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-gray-800 mb-2">快速预览：</h4>
                <div className="text-gray-600 whitespace-pre-line text-sm">
                  {result}
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setSubmitted(false);
                setPhoto(null);
                setEmail("");
                setAnswers({});
                setResult(null);
              }}
              className="mt-4 w-full py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              🔄 重新测试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
// FORCE_PUSH_FIX_1774357509
