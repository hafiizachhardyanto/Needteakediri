'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import { 
  sendEmailLink, 
  checkSignInLink, 
  completeSignInWithLink,
  saveUserToFirestore,
  checkUserExists
} from '@/lib/firebase';

export default function DaftarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'email' | 'sent' | 'complete'>('email');

  // Ambil email dari URL jika ada
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
    }
    
    // Cek apakah ini callback dari email link
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      
      if (checkSignInLink(url)) {
        const emailFromStorage = window.localStorage.getItem('emailForSignIn');
        if (emailFromStorage) {
          handleCompleteRegistration(emailFromStorage, url);
        }
      }
    }
  }, [searchParams]);

  const handleCompleteRegistration = async (userEmail: string, url: string) => {
    setLoading(true);
    setStep('sent');
    
    try {
      const result = await completeSignInWithLink(userEmail, url);
      
      if (result.success && result.isNewUser) {
        // User baru, tampilkan form nama
        setEmail(userEmail);
        setStep('complete');
      } else if (result.success && !result.isNewUser) {
        // User sudah ada, langsung login
        await saveUserToFirestore(userEmail, '', result.uid || '', false);
        
        localStorage.setItem('needtea_user', JSON.stringify({
          email: userEmail,
          uid: result.uid,
          isLoggedIn: true,
          loginTime: new Date().toISOString()
        }));
        
        router.push('/?login=success');
      } else {
        setError('Link tidak valid atau sudah kadaluarsa.');
        setStep('email');
      }
    } catch (err: any) {
      setError('Gagal verifikasi: ' + err.message);
      setStep('email');
    } finally {
      setLoading(false);
    }
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validasi email
      if (!email.includes('@') || !email.includes('.')) {
        setError('Email tidak valid. Masukkan email yang benar.');
        setLoading(false);
        return;
      }

      // Cek apakah email sudah terdaftar
      const checkResult = await checkUserExists(email);
      if (checkResult.exists) {
        setError('Email sudah terdaftar. Silakan login.');
        setLoading(false);
        return;
      }

      // Kirim email link
      const result = await sendEmailLink(email);
      
      if (result.success) {
        setSuccess(`Link verifikasi telah dikirim ke ${email}. Silakan cek inbox Anda.`);
        setStep('sent');
      } else {
        setError(result.error || 'Gagal mengirim email. Silakan coba lagi.');
      }
      
    } catch (err: any) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Dapatkan current user dari auth
      const { auth } = await import('@/lib/firebase');
      const { onAuthStateChanged } = await import('firebase/auth');
      
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Simpan ke Firestore dengan nama
          await saveUserToFirestore(email, name, user.uid, true);
          
          localStorage.setItem('needtea_user', JSON.stringify({
            email: email,
            name: name,
            uid: user.uid,
            isLoggedIn: true,
            loginTime: new Date().toISOString()
          }));
          
          router.push('/?registered=success');
        } else {
          setError('Sesi tidak valid. Silakan coba lagi.');
          setStep('email');
        }
        setLoading(false);
      });
    } catch (err: any) {
      setError('Gagal menyimpan data: ' + err.message);
      setLoading(false);
    }
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
            
            {step === 'email' && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Daftar Akun</h1>
                <p className="text-white/80">Buat akun baru dengan email</p>
              </>
            )}
            {step === 'sent' && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Cek Email</h1>
                <p className="text-white/80">Link verifikasi telah dikirim</p>
              </>
            )}
            {step === 'complete' && (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Lengkapi Profil</h1>
                <p className="text-white/80">Beritahu kami nama Anda</p>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center animate-fade-in-up">
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

          {/* Success Message */}
          {success && (
            <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4 mb-6 text-center animate-fade-in-up">
              <div className="text-4xl mb-2">📧</div>
              <p className="text-green-100 text-sm">{success}</p>
            </div>
          )}

          {/* Step 1: Input Email */}
          {step === 'email' && (
            <form onSubmit={handleSendLink} className="space-y-6">
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
                <p className="text-white/60 text-xs mt-2">
                  Link verifikasi akan dikirim ke email Anda
                </p>
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
                    <span>Kirim Link Verifikasi</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </>
                )}
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

          {/* Step 2: Email Sent */}
          {step === 'sent' && (
            <div className="space-y-6 text-center">
              <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="text-6xl mb-4">✉️</div>
                <h3 className="text-white font-bold text-lg mb-2">Link Terkirim!</h3>
                <p className="text-white/80 text-sm mb-4">
                  Kami telah mengirim link verifikasi ke:<br/>
                  <span className="text-white font-semibold break-all">{email}</span>
                </p>
                <p className="text-white/60 text-xs">
                  Klik link di email untuk melanjutkan pendaftaran.<br/>
                  Link berlaku selama 1 jam.
                </p>
              </div>

              <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 text-left">
                <p className="text-blue-100 text-xs">
                  <span className="font-bold">💡 Tips:</span> Jika tidak menemukan email, cek folder <span className="font-semibold">Spam</span> atau <span className="font-semibold">Promosi</span>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setSuccess('');
                }}
                className="text-white/60 hover:text-white text-sm underline"
              >
                Gunakan email lain
              </button>
            </div>
          )}

          {/* Step 3: Complete Profile */}
          {step === 'complete' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
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
                  className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                  required
                />
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
                    <span>Simpan & Lanjutkan</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Back to Home */}
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