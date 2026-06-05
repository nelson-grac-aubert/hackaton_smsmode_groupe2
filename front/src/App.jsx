import { Navigate, Route, Routes } from 'react-router-dom'
import SendCodePage from './pages/SendCodePage'
import OtpVerificationPage from './pages/otp-verification-page'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/send-code" replace />} />
      <Route path="/send-code" element={<SendCodePage />} />
      <Route path="/verification" element={<OtpVerificationPage />} />
      <Route path="*" element={<Navigate to="/send-code" replace />} />
    </Routes>
  )
}
