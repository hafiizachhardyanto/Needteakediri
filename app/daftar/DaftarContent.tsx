'use client';

import React, { useState, useEffect } from 'react';
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

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
          
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6 group">
              <span className="text-4xl group-hover:animate-bounce">🍵</span>
              <span className="text-2xl font-bold text-white">NeedTea</span>
            </Link>
            
            <h1 className="text-3xl font-bold text-white mb-2">
              {step === 'email' && 'Daftar Akun'}
              {step === 'otp' && 'Verifikasi OTP'}
              {step === 'profile' && 'Lengkapi Profil'}
            </h1>
            <p className="text-white/80">
              {step === 'email' && 'Masukkan email Anda'}
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