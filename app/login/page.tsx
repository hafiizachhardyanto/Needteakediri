'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import { 
  saveOTP, 
  loginWithOTP
} from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userData, isAdmin, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);

  // Redirect jika sudah login
  useEffect(() => {
    if (!authLoading && userData) {
      if (isAdmin) {
        router.push('/admin');
      } else {
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
      }
    }
  }, [userData, isAdmin, authLoading, router, searchParams]);

  // Countdown untuk resend OTP
  useEffect(() => {
    if (step === 'otp' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Email tidak valid');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Generate OTP 6 digit
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Simpan OTP ke Firestore
      const result = await saveOTP(email, generatedOTP);
      
      if (result.success) {
        // TODO: Kirim email dengan OTP (gunakan EmailJS atau backend)
        // Untuk development, tampilkan OTP di console
        console.log('OTP untuk', email, ':', generatedOTP);
        
        // Simulasi kirim email (ganti dengan integrasi email service)
        alert(`Kode OTP Anda: ${generatedOTP}\n\n(Di production, kode ini akan dikirim via email)`);
        
        setStep('otp');
        setCountdown(60);
      } else {
        setError(result.error || 'Gagal mengirim OTP');
      }
    } catch (err: any) {
      setError('Terjadi kesalahan. Coba lagi.');
    }
    
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Masukkan 6 digit kode OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const result = await loginWithOTP(email, otpString);
    
    if (result.success && result.userData) {
      // Redirect berdasarkan role
      if (result.userData.role === 'admin') {
        router.push('/admin');
      } else {
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
      }
    } else {
      setError(result.error || 'Verifikasi gagal');
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await saveOTP(email, generatedOTP);
    
    if (result.success) {
      console.log('OTP baru untuk', email, ':', generatedOTP);
      alert(`Kode OTP baru Anda: ${generatedOTP}`);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
    } else {
      setError(result.error || 'Gagal mengirim ulang OTP');
    }
    
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Hanya 1 karakter per box
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto focus ke box berikutnya
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <Navbar />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
          
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6 group">
              <span className="text-4xl group-hover:animate-bounce">🍵</span>
              <span className="text-2xl font-bold text-white">NeedTea</span>
            </Link>
            
            <h1 className="text-3xl font-bold text-white mb-2">
              {step === 'email' ? 'Masuk' : 'Verifikasi OTP'}
            </h1>
            <p className="text-white/80">
              {step === 'email' 
                ? 'Masukkan email Anda' 
                : `Masukkan 6 digit kode yang dikirim ke ${email}`}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center">
              <p className="text-red-100 text-sm">{error}</p>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Alamat Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
              </button>

              <div className="text-center">
                <p className="text-white/60 text-sm">
                  Belum punya akun?{' '}
                  <Link href="/daftar" className="text-white font-semibold underline hover:text-yellow-300">
                    Daftar di sini
                  </Link>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label className="block text-white text-sm font-medium mb-4 text-center">
                  Kode OTP 6 Digit
                </label>
                <div className="flex justify-center space-x-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 bg-white/10 border border-white/20 rounded-xl text-white text-center text-2xl font-bold focus:outline-none focus:border-white/50 focus:bg-white/20"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Memverifikasi...' : 'Verifikasi'}
              </button>

              <div className="text-center space-y-3">
                {countdown > 0 ? (
                  <p className="text-white/60 text-sm">
                    Kirim ulang kode dalam {countdown} detik
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-white font-semibold text-sm underline hover:text-yellow-300"
                  >
                    Kirim Ulang Kode
                  </button>
                )}
                
                <div>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-white/60 hover:text-white text-sm"
                  >
                    Gunakan email lain
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function LoginLoading() {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <div className="relative z-10 text-white text-center">
        <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Memuat...</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}