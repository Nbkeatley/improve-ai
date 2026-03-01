import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// No StrictMode — MediaPipe PoseLandmarker doesn't survive double-mount
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
