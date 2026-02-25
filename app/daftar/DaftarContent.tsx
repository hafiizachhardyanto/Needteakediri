'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  saveOTPToUser, 
  checkUserExists, 
  saveUserToFirestoreSafe,
  db
} from '@/lib/firebase';
import { sendOTPEmail } from '@/lib/emailjs';
import { getDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';

export default function DaftarContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
  const [countdown, setCountdown] = useState(60);
  const [showEmail, setShowEmail] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

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
    setSuccessMessage('');

    try {
      const checkResult = await checkUserExists(email);
      if (checkResult.exists) {
        setError('Email sudah terdaftar. Silakan login.');
        setLoading(false);
        return;
      }

      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      const result = await saveOTPToUser(email, generatedOTP);
      
      if (result.success) {
        const emailResult = await sendOTPEmail({
          to_email: email,
          to_name: email.split('@')[0],
          otp_code: generatedOTP,
          expiry_time: '5 menit'
        });

        if (emailResult.success) {
          setSuccessMessage('Kode OTP telah dikirim ke email Anda. Silakan cek inbox/spam.');
          setStep('otp');
          setCountdown(60);
        } else {
          setError('Gagal mengirim email: ' + emailResult.error);
        }
      } else {
        setError(result.error || 'Gagal mengirim OTP');
      }
    } catch (err: any) {
      setError('Terjadi kesalahan. Coba lagi.');
      console.error('Send OTP Error:', err);
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

    try {
      const userRef = doc(db, 'users', email);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('User tidak ditemukan');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const otpData = userData.otp;

      if (!otpData) {
        setError('OTP tidak ditemukan');
        setLoading(false);
        return;
      }

      const now = Timestamp.now();

      if (otpData.expiresAt.toDate() < now.toDate()) {
        setError('OTP sudah kadaluarsa');
        setLoading(false);
        return;
      }

      if (otpData.used) {
        setError('OTP sudah digunakan');
        setLoading(false);
        return;
      }

      if (otpData.code !== otpString) {
        setError('OTP tidak valid');
        setLoading(false);
        return;
      }

      await updateDoc(userRef, { 'otp.used': true });
      
      setStep('profile');
      setSuccessMessage('Email terverifikasi! Lengkapi profil Anda.');
    } catch (err: any) {
      setError('Terjadi kesalahan saat verifikasi');
      console.error(err);
    }
    
    setLoading(false);
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      const result = await saveOTPToUser(email, generatedOTP);
      
      if (result.success) {
        const emailResult = await sendOTPEmail({
          to_email: email,
          to_name: email.split('@')[0],
          otp_code: generatedOTP,
          expiry_time: '5 menit'
        });

        if (emailResult.success) {
          setSuccessMessage('Kode OTP baru telah dikirim!');
          setCountdown(60);
          setOtp(['', '', '', '', '', '']);
        } else {
          setError('Gagal mengirim ulang: ' + emailResult.error);
        }
      } else {
        setError(result.error || 'Gagal mengirim ulang OTP');
      }
    } catch (err: any) {
      setError('Terjadi kesalahan saat mengirim ulang.');
    }
    
    setLoading(false);
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Nama tidak boleh kosong');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await saveUserToFirestoreSafe(email, {
        email: email,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        role: 'user'
      });

      if (result.success) {
        localStorage.setItem('needtea_user', JSON.stringify({
          email: email,
          name: name.trim(),
          role: 'user',
          isLoggedIn: true,
          loginTime: new Date().toISOString()
        }));

        router.push('/?registered=success');
      } else {
        setError(result.error || 'Gagal menyimpan data');
      }
    } catch (err: any) {
      setError('Gagal menyimpan data: ' + err.message);
    }
    
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
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

  const toggleEmailVisibility = () => {
    setShowEmail(!showEmail);
    setIsPeeking(true);
    setTimeout(() => setIsPeeking(false), 300);
  };

  const getPeekingMascot = () => {
    if (isPeeking) {
      return (
        <div className="text-4xl animate-bounce">
          👀
        </div>
      );
    }
    if (showEmail) {
      return (
        <div className="text-4xl">
          😮
        </div>
      );
    }
    return (
      <div className="text-4xl">
        🙈
      </div>
    );
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700 p-4">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-10"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl">
          
          <div className="text-center mb-6 sm:mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-4 sm:mb-6 group">
              <span className="text-3xl sm:text-4xl group-hover:animate-bounce">🍵</span>
              <span className="text-xl sm:text-2xl font-bold text-white">NeedTea</span>
            </Link>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {step === 'email' && 'Daftar Akun'}
              {step === 'otp' && 'Verifikasi OTP'}
              {step === 'profile' && 'Lengkapi Profil'}
            </h1>
            <p className="text-white/80 text-sm sm:text-base px-2">
              {step === 'email' && 'Masukkan email dan nama Anda'}
              {step === 'otp' && `Masukkan 6 digit kode yang dikirim ke ${email}`}
              {step === 'profile' && 'Beritahu kami nama Anda'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-center">
              <p className="text-red-100 text-xs sm:text-sm">{error}</p>
              {error.includes('sudah terdaftar') && (
                <Link href="/login">
                  <button className="mt-3 px-4 py-2 bg-white text-red-600 rounded-lg font-medium text-xs sm:text-sm hover:bg-red-50 transition-all">
                    Login Sekarang
                  </button>
                </Link>
              )}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-center">
              <p className="text-green-100 text-xs sm:text-sm">{successMessage}</p>
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center mb-4">
                {getPeekingMascot()}
              </div>
              
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Alamat Email
                </label>
                <div className="relative">
                  <input
                    ref={emailInputRef}
                    type={showEmail ? "text" : "password"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 pr-12 text-sm sm:text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleEmailVisibility}
                    onMouseDown={() => setIsPeeking(true)}
                    onMouseUp={() => setIsPeeking(false)}
                    onMouseLeave={() => setIsPeeking(false)}
                    onTouchStart={() => setIsPeeking(true)}
                    onTouchEnd={() => setIsPeeking(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-all p-2"
                  >
                    {showEmail ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-white/60 text-xs mt-2 text-center">
                  Klik icon mata untuk melihat email
                </p>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama Anda"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 text-sm sm:text-base"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !name}
                className="w-full py-3 sm:py-4 bg-white text-tea-600 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
              </button>

              <div className="text-center">
                <p className="text-white/60 text-xs sm:text-sm">
                  Sudah punya akun?{' '}
                  <Link href="/login" className="text-white font-semibold underline hover:text-yellow-300">
                    Masuk di sini
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-white text-sm font-medium mb-4 text-center">
                  Kode OTP 6 Digit
                </label>
                <div className="flex justify-center space-x-2 sm:space-x-3">
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
                      className="w-10 h-12 sm:w-12 sm:h-14 bg-white/10 border border-white/20 rounded-xl text-white text-center text-xl sm:text-2xl font-bold focus:outline-none focus:border-white/50 focus:bg-white/20"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-3 sm:py-4 bg-white text-tea-600 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Memverifikasi...' : 'Verifikasi'}
              </button>

              <div className="text-center space-y-3">
                {countdown > 0 ? (
                  <p className="text-white/60 text-xs sm:text-sm">
                    Kirim ulang dalam {countdown} detik
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-white font-semibold text-xs sm:text-sm underline hover:text-yellow-300"
                  >
                    Kirim Ulang Kode
                  </button>
                )}
                
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setOtp(['', '', '', '', '', '']);
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-white/60 hover:text-white text-xs sm:text-sm"
                  >
                    Gunakan email lain
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 'profile' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-4 sm:space-y-6">
              <div className="text-center mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl sm:text-4xl">
                  👤
                </div>
                <p className="text-white/80 text-xs sm:text-sm">Email terverifikasi:</p>
                <p className="text-white font-semibold break-all text-xs sm:text-sm">{email}</p>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama Anda"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 text-sm sm:text-base"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-3 sm:py-4 bg-white text-tea-600 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Menyimpan...' : 'Daftar & Simpan'}
              </button>
            </form>
          )}

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/20">
            <Link href="/" className="block w-full">
              <button className="w-full py-2 sm:py-3 text-white/70 hover:text-white text-xs sm:text-sm font-medium transition-all flex items-center justify-center space-x-2">
                <span>Kembali ke Beranda</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}