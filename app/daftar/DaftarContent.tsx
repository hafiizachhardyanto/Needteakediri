'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
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
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [characterMood, setCharacterMood] = useState<'normal' | 'cover' | 'peek' | 'happy' | 'typing'>('normal');

  useEffect(() => {
    if (step === 'otp' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, step]);

  useEffect(() => {
    if (email.length > 0 && isEmailFocused) {
      setCharacterMood('typing');
    } else if (!isEmailFocused && email.length > 0) {
      setCharacterMood('normal');
    }
  }, [email, isEmailFocused]);

  const getCharacterEmoji = () => {
    switch (characterMood) {
      case 'cover':
        return '🙈';
      case 'peek':
        return '🙉';
      case 'happy':
        return '🙊';
      case 'typing':
        return '✍️';
      default:
        return '🐵';
    }
  };

  const getCharacterAnimation = () => {
    switch (characterMood) {
      case 'cover':
        return 'animate-bounce';
      case 'peek':
        return 'animate-pulse';
      case 'happy':
        return 'animate-bounce';
      case 'typing':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.includes('@')) {
      setError('Email tidak valid');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password tidak cocok');
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
          setCharacterMood('happy');
        } else {
          setError('Gagal mengirim email: ' + emailResult.error);
          setCharacterMood('normal');
        }
      } else {
        setError(result.error || 'Gagal mengirim OTP');
        setCharacterMood('normal');
      }
    } catch (err: any) {
      setError('Terjadi kesalahan. Coba lagi.');
      console.error('Send OTP Error:', err);
      setCharacterMood('normal');
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
      setCharacterMood('happy');
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
          setCharacterMood('happy');
        } else {
          setError('Gagal mengirim ulang: ' + emailResult.error);
          setCharacterMood('normal');
        }
      } else {
        setError(result.error || 'Gagal mengirim ulang OTP');
        setCharacterMood('normal');
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
        password: password,
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
        setCharacterMood('normal');
      }
    } catch (err: any) {
      setError('Gagal menyimpan data: ' + err.message);
      setCharacterMood('normal');
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

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
          
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-6xl shadow-lg">
                <span className={`${getCharacterAnimation()} transition-all duration-300`}>
                  {getCharacterEmoji()}
                </span>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center text-lg animate-bounce">
                🍵
              </div>
            </div>
            
            <Link href="/" className="inline-flex items-center space-x-2 mb-2 group">
              <span className="text-2xl font-bold text-white">NeedTea</span>
            </Link>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              {step === 'email' && 'Daftar Akun'}
              {step === 'otp' && 'Verifikasi OTP'}
              {step === 'profile' && 'Lengkapi Profil'}
            </h1>
            <p className="text-white/80 text-sm">
              {step === 'email' && 'Masukkan data Anda dengan aman'}
              {step === 'otp' && `Masukkan 6 digit kode yang dikirim ke ${email}`}
              {step === 'profile' && 'Beritahu kami nama Anda'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center">
              <p className="text-red-100 text-sm">{error}</p>
              {error.includes('sudah terdaftar') && (
                <Link href="/login">
                  <button className="mt-3 px-4 py-2 bg-white text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 transition-all">
                    Login Sekarang
                  </button>
                </Link>
              )}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4 mb-6 text-center">
              <p className="text-green-100 text-sm">{successMessage}</p>
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Alamat Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => {
                      setIsEmailFocused(true);
                      setCharacterMood('typing');
                    }}
                    onBlur={() => {
                      setIsEmailFocused(false);
                      if (email.length === 0) setCharacterMood('normal');
                    }}
                    placeholder="nama@email.com"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 pr-10"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                    📧
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setCharacterMood('cover')}
                    onBlur={() => {
                      if (email.length === 0) setCharacterMood('normal');
                      else setCharacterMood('typing');
                    }}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 pr-12"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordVisible(!isPasswordVisible);
                      setCharacterMood(isPasswordVisible ? 'cover' : 'peek');
                      setTimeout(() => setCharacterMood('cover'), 500);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {isPasswordVisible ? '🙈' : '🙉'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <input
                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setCharacterMood('cover')}
                    onBlur={() => {
                      if (email.length === 0) setCharacterMood('normal');
                      else setCharacterMood('typing');
                    }}
                    placeholder="Ulangi password"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmPasswordVisible(!isConfirmPasswordVisible);
                      setCharacterMood(isConfirmPasswordVisible ? 'cover' : 'peek');
                      setTimeout(() => setCharacterMood('cover'), 500);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {isConfirmPasswordVisible ? '🙈' : '🙉'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => setIsNameFocused(false)}
                    placeholder="Masukkan nama Anda"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50 pr-10"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                    👤
                  </span>
                </div>
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
                  Sudah punya akun?{' '}
                  <Link href="/login" className="text-white font-semibold underline hover:text-yellow-300">
                    Masuk di sini
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 'otp' && (
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
                    Kirim ulang dalam {countdown} detik
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
                    onClick={() => {
                      setStep('email');
                      setOtp(['', '', '', '', '', '']);
                      setError('');
                      setSuccessMessage('');
                      setCharacterMood('normal');
                    }}
                    className="text-white/60 hover:text-white text-sm"
                  >
                    Gunakan email lain
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 'profile' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
                  👤
                </div>
                <p className="text-white/80 text-sm">Email terverifikasi:</p>
                <p className="text-white font-semibold break-all">{email}</p>
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
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Menyimpan...' : 'Daftar & Simpan'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-white/20">
            <Link href="/" className="block w-full">
              <button className="w-full py-3 text-white/70 hover:text-white text-sm font-medium transition-all flex items-center justify-center space-x-2">
                <span>Kembali ke Beranda</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}