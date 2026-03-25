import { useState, useRef } from 'react'

function App() {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [photoTaken, setPhotoTaken] = useState(false)
  const [photoData, setPhotoData] = useState(null)
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState({
    interests: '',
    skills: '',
    workStyle: '',
    values: '',
    experience: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const openCamera = async () => {
    try {
      setMessage({ type: '', text: '' })
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }, 
        audio: false 
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Force play with multiple attempts
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        
        const playVideo = async () => {
          try {
            await videoRef.current.play()
            console.log('✅ Video playing successfully')
          } catch (err) {
            console.warn('⚠️ Play attempt failed:', err.message)
            // Try again after a short delay
            setTimeout(async () => {
              try {
                await videoRef.current.play()
                console.log('✅ Video playing on retry')
              } catch (retryErr) {
                console.error('❌ Final play failed:', retryErr.message)
              }
            }, 100)
          }
        }
        
        playVideo()
        
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded')
          playVideo()
        }
      }
      
      setCameraOpen(true)
      setPhotoTaken(false)
      setPhotoData(null)
    } catch (err) {
      console.error('❌ Camera error:', err)
      let errorMsg = '无法访问摄像头'
      if (err.name === 'NotAllowedError') {
        errorMsg = '摄像头权限被拒绝，请在浏览器设置中允许摄像头权限'
      } else if (err.name === 'NotFoundError') {
        errorMsg = '未找到摄像头设备'
      } else if (err.name === 'NotReadableError') {
        errorMsg = '摄像头可能被其他程序占用'
      }
      setMessage({ type: 'error', text: errorMsg })
    }
  }

  const takePhoto = () => {
    if (!videoRef.current || !streamRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    // Use actual video dimensions
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    
    canvas.width = width
    canvas.height = height
    
    context.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/png')
    
    setPhotoData(dataUrl)
    setPhotoTaken(true)
    console.log('📸 Photo taken:', width, 'x', height)
  }

  const retakePhoto = () => {
    setPhotoTaken(false)
    setPhotoData(null)
  }

  const closeCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setCameraOpen(false)
    setPhotoTaken(false)
    setPhotoData(null)
  }

  const handleAnswerChange = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!photoData) {
      setMessage({ type: 'error', text: '请先拍摄照片' })
      return
    }
    
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址' })
      return
    }
    
    setLoading(true)
    setMessage({ type: '', text: '' })
    
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo: photoData,
          email,
          answers
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: '预测完成！详细报告已发送至您的邮箱：' + email 
        })
        // Reset form
        setPhotoData(null)
        setPhotoTaken(false)
        setEmail('')
        setAnswers({
          interests: '',
          skills: '',
          workStyle: '',
          values: '',
          experience: ''
        })
        closeCamera()
      } else {
        setMessage({ type: 'error', text: result.error || '预测失败，请重试' })
      }
    } catch (err) {
      console.error('Submit error:', err)
      setMessage({ type: 'error', text: '提交失败，请检查网络连接' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h1>🔮 AI 职业方向预测</h1>
      <p className="subtitle">上传照片并回答问题，让 AI 预测你的未来职业方向</p>

      {message.text && (
        <div className={`${message.type}-message`}>
          {message.text}
        </div>
      )}

      {/* Camera Section */}
      <div className="section camera-section">
        <h2 className="section-title">📷 拍摄照片</h2>
        
        {!cameraOpen ? (
          <button className="btn btn-primary" onClick={openCamera}>
            📹 打开摄像头
          </button>
        ) : (
          <div>
            <div className="video-container">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
              />
              {photoData && (
                <img 
                  src={photoData} 
                  alt="拍摄的照片" 
                  className="photo-preview show"
                />
              )}
            </div>
            <canvas ref={canvasRef} className="canvas-preview" />
            
            <div className="button-group">
              {!photoTaken ? (
                <>
                  <button className="btn btn-success" onClick={takePhoto}>
                    📸 确认拍照
                  </button>
                  <button className="btn btn-danger" onClick={closeCamera}>
                    ✖ 取消
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={retakePhoto}>
                    🔄 重拍
                  </button>
                  <button className="btn btn-success" onClick={closeCamera}>
                    ✔ 使用这张
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="section">
        <h2 className="section-title">📧 接收报告的邮箱</h2>
        <div className="form-group">
          <input
            type="email"
            placeholder="your-email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Questions Section */}
      <div className="section">
        <h2 className="section-title">❓ 职业倾向问题</h2>
        
        <div className="question-item">
          <label className="question-label">
            1. 你平时对哪些领域最感兴趣？（例如：科技、艺术、商业、医疗等）
          </label>
          <textarea
            placeholder="请描述你的兴趣爱好..."
            value={answers.interests}
            onChange={(e) => handleAnswerChange('interests', e.target.value)}
            disabled={loading || !photoData}
          />
        </div>

        <div className="question-item">
          <label className="question-label">
            2. 你擅长哪些技能？（例如：编程、写作、设计、沟通等）
          </label>
          <textarea
            placeholder="请列出你的特长和技能..."
            value={answers.skills}
            onChange={(e) => handleAnswerChange('skills', e.target.value)}
            disabled={loading || !photoData}
          />
        </div>

        <div className="question-item">
          <label className="question-label">
            3. 你更喜欢什么样的工作方式？（例如：独立工作、团队合作、远程办公等）
          </label>
          <textarea
            placeholder="请描述你理想的工作方式..."
            value={answers.workStyle}
            onChange={(e) => handleAnswerChange('workStyle', e.target.value)}
            disabled={loading || !photoData}
          />
        </div>

        <div className="question-item">
          <label className="question-label">
            4. 你在选择职业时最看重什么？（例如：薪资、稳定性、创造力、帮助他人等）
          </label>
          <textarea
            placeholder="请说明你的职业价值观..."
            value={answers.values}
            onChange={(e) => handleAnswerChange('values', e.target.value)}
            disabled={loading || !photoData}
          />
        </div>

        <div className="question-item">
          <label className="question-label">
            5. 你有什么相关的工作或学习经历？
          </label>
          <textarea
            placeholder="请简述你的相关经历..."
            value={answers.experience}
            onChange={(e) => handleAnswerChange('experience', e.target.value)}
            disabled={loading || !photoData}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="section text-center">
        <button 
          className="btn btn-primary" 
          onClick={handleSubmit}
          disabled={loading || !photoData}
          style={{ width: '100%', maxWidth: '300px', justifyContent: 'center' }}
        >
          {loading ? (
            <>
              <span className="loading"></span>
              正在分析...
            </>
          ) : (
            '🚀 提交并获取预测'
          )}
        </button>
        {!photoData && (
          <p style={{ color: '#999', marginTop: '10px', fontSize: '0.9rem' }}>
            ⚠️ 请先拍摄照片后再提交
          </p>
        )}
      </div>
    </div>
  )
}

export default App
// FORCE_UPDATE_1774415297
