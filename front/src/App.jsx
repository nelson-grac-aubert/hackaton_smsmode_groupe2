import { Routes, Route } from 'react-router-dom';
import OtpVerificationPage from './pages/otp-verification-page';

export default function App() {
  return (
    <Routes>
      <Route path="/verification" element={<OtpVerificationPage />} />
    </Routes>
  );
}