'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';

// Komponen utama yang menggunakan useSearchParams
function VerifikasiForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'send' | 'verify' | 'profile'>('send');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resendCount, setResendCount] = useState(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const modeParam = searchParams.get('mode') as 'login' | 'register';
    
    if (emailParam) {
      const decodedEmail = decodeURIComponent(emailParam);
      setEmail(decodedEmail);
      
      if (modeParam) {
        setMode(modeParam);
        handleInitialSend(decodedEmail, modeParam);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInitialSend = async (targetEmail: string, currentMode: string) => {
    setLoading(true);
    await generateAndSendOtp(targetEmail, currentMode);
    setStep('verify');
    setLoading(false);
  };

  // Generate OTP dan simpan ke Firestore
  const generateAndSendOtp = async (targetEmail: string, currentMode: string) => {
    try {
      // Generate OTP 6 digit
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(newOtp);
      
      // Cek apakah email sudah terdaftar (untuk mode login)
      if (currentMode === 'login') {
        const userDoc = await getDoc(doc(db, 'users', targetEmail));
        if (!userDoc.exists()) {
          setError('Email belum terdaftar. Silakan daftar terlebih dahulu.');
          setTimeout(() => {
            router.push('/daftar');
          }, 2000);
          return;
        }
      }

      // Cek apakah email sudah terdaftar (untuk mode register)
      if (currentMode === 'register') {
        const userDoc = await getDoc(doc(db, 'users', targetEmail));
        if (userDoc.exists()) {
          setError('Email sudah terdaftar. Silakan login.');
          setTimeout(() => {
            router.push('/login');
          }, 2000);
          return;
        }
      }
      
      // Simpan OTP ke Firestore
      await setDoc(doc(db, 'otp_codes', targetEmail), {
        code: newOtp,
        email: targetEmail,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 menit
        attempts: 0,
        used: false
      });
      
      // Tampilkan OTP di console untuk testing
      console.log('📧 OTP untuk', targetEmail, ':', newOtp);
      
      setCountdown(300); // 5 menit countdown
      
    } catch (err) {
      console.error('Error generating OTP:', err);
      setError('Gagal mengirim kode. Silakan coba lagi.');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Email tidak valid');
      return;
    }
    
    setLoading(true);
    setError('');
    await generateAndSendOtp(email, mode);
    setStep('verify');
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1 || !/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto focus ke input berikutnya
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    const newOtp = [...otp];
    pastedData.split('').forEach((digit, index) => {
      if (index < 6) newOtp[index] = digit;
    });
    setOtp(newOtp);
    
    // Focus ke input terakhir yang terisi atau selanjutnya
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const enteredOtp = otp.join('');
    
    if (enteredOtp.length !== 6) {
      setError('Masukkan 6 digit kode');
      setLoading(false);
      return;
    }
    
    try {
      const otpDocRef = doc(db, 'otp_codes', email);
      const otpDoc = await getDoc(otpDocRef);
      
      if (!otpDoc.exists()) {
        setError('Kode tidak valid. Silakan minta kode baru.');
        setLoading(false);
        return;
      }
      
      const otpData = otpDoc.data();
      
      if (otpData.used) {
        setError('Kode sudah digunakan. Silakan minta kode baru.');
        setLoading(false);
        return;
      }
      
      if (new Date() > otpData.expiresAt.toDate()) {
        setError('Kode sudah kadaluarsa. Silakan minta kode baru.');
        setLoading(false);
        return;
      }
      
      if (otpData.attempts >= 3) {
        setError('Terlalu banyak percobaan. Silakan minta kode baru.');
        setLoading(false);
        return;
      }
      
      if (enteredOtp === otpData.code) {
        // OTP benar - tandai sebagai used
        await updateDoc(otpDocRef, { used: true });
        
        if (mode === 'register') {
          setStep('profile');
        } else {
          // Mode login - langsung login
          await handleLoginSuccess();
        }
      } else {
        // OTP salah
        await updateDoc(otpDocRef, { attempts: otpData.attempts + 1 });
        setError(`Kode salah. Percobaan ${otpData.attempts + 1}/3`);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setLoading(false);
    }
  };

  // Cek admin dan redirect
  const handleLoginSuccess = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', email));
      const userData = userDoc.data();
      
      // Update last login
      await updateDoc(doc(db, 'users', email), {
        lastLogin: serverTimestamp()
      });
      
      // Simpan session
      localStorage.setItem('needtea_user', JSON.stringify({
        email: email,
        name: userData?.name || '',
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      }));

      // Cek admin dan redirect
      if (userData?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/?login=success');
      }
    } catch (err) {
      setError('Gagal login. Silakan coba lagi.');
    }
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
      // Simpan user ke Firestore
      await setDoc(doc(db, 'users', email), {
        email: email,
        name: name.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        isActive: true,
        role: 'customer',
        emailVerified: true,
        profile: {
          avatar: '',
          address: ''
        },
        stats: {
          totalOrders: 0,
          totalSpent: 0
        }
      });
      
      // Simpan session
      localStorage.setItem('needtea_user', JSON.stringify({
        email: email,
        name: name.trim(),
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      }));
      
      router.push('/?registered=success');
    } catch (err) {
      console.error('Error saving user:', err);
      setError('Gagal menyimpan data. Silakan coba lagi.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCount >= 3) {
      setError('Terlalu banyak pengiriman. Silakan coba lagi nanti.');
      return;
    }
    
    setResendCount(resendCount + 1);
    setCountdown(300);
    setOtp(['', '', '', '', '', '']);
    setError('');
    setLoading(true);
    
    await generateAndSendOtp(email, mode);
    inputRefs.current[0]?.focus();
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <div className="fixed inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"/>
      
      <FloatingLeaves />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
          
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6 group">
              <span className="text-4xl group-hover:animate-bounce">🍵</span>
              <span className="text-2xl font-bold text-white">NeedTea</span>
            </Link>
            
            {step === 'send' && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Verifikasi Email</h1>
                <p className="text-white/80">Masukkan email Anda</p>
              </>
            )}
            {step === 'verify' && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Kode Verifikasi</h1>
                <p className="text-white/80">Masukkan 6 digit kode yang dikirim ke</p>
                <p className="text-white font-semibold mt-1 text-sm break-all px-4">{email}</p>
              </>
            )}
            {step === 'profile' && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Lengkapi Profil</h1>
                <p className="text-white/80">Beritahu kami nama Anda</p>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center animate-fade-in-up">
              <p className="text-red-100 text-sm">{error}</p>
            </div>
          )}

          {step === 'send' && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Alamat Email
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-lg">
                    📧
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-white/20 border border-white/30 rounded-xl px-12 py-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.includes('@')}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Kode OTP</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>

              <div className="text-center">
                <p className="text-white/60 text-sm">
                  {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
                  <Link 
                    href={mode === 'login' ? '/daftar' : '/login'} 
                    className="text-white font-semibold underline hover:text-yellow-300"
                  >
                    {mode === 'login' ? 'Daftar di sini' : 'Masuk di sini'}
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-white text-sm font-medium mb-4 text-center">
                  Masukkan 6 digit kode OTP
                </label>
                <div 
                  className="flex justify-center space-x-2 sm:space-x-3" 
                  onPaste={handlePaste}
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-10 h-12 sm:w-12 sm:h-14 bg-white/20 border-2 border-white/30 rounded-xl text-center text-xl sm:text-2xl font-bold text-white focus:outline-none focus:border-white focus:bg-white/30 transition-all"
                      required
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.some(d => !d)}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Verifikasi</span>
                )}
              </button>

              <div className="text-center space-y-3">
                {countdown > 0 ? (
                  <p className="text-white/60 text-sm">
                    Kirim ulang dalam{' '}
                    <span className="text-white font-bold">{formatTime(countdown)}</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || resendCount >= 3}
                    className="text-white underline hover:text-yellow-300 text-sm font-medium disabled:opacity-50"
                  >
                    Kirim Ulang Kode {resendCount > 0 && `(${resendCount}/3)`}
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    setStep('send');
                    setOtp(['', '', '', '', '', '']);
                    setError('');
                  }}
                  className="block w-full text-white/60 hover:text-white text-sm"
                >
                  Ganti Email
                </button>
              </div>

              <div className="mt-6 bg-yellow-400/20 border border-yellow-400/30 rounded-xl p-4">
                <p className="text-yellow-100 text-xs text-center">
                  💡 <span className="font-bold">Demo:</span> Cek console browser (F12) untuk melihat kode OTP
                </p>
              </div>
            </form>
          )}

          {step === 'profile' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
                  👤
                </div>
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
                  className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <p className="text-white/80 text-sm mb-1">Email Terverifikasi:</p>
                <p className="text-white font-bold text-sm break-all">{email}</p>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span>Daftar & Simpan</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-white/20">
            <Link href="/" className="block w-full">
              <button className="w-full py-3 text-white/70 hover:text-white text-sm font-medium transition-all flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Kembali ke Beranda</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// Loading fallback
function VerifikasiLoading() {
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

// Export dengan Suspense
export default function VerifikasiContent() {
  return (
    <Suspense fallback={<VerifikasiLoading />}>
      <VerifikasiForm />
    </Suspense>
  );
}