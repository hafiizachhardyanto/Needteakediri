'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import { 
  sendEmailLink, 
  checkSignInLink, 
  completeSignInWithLink,
  saveUserToFirestore,
  checkUserExists,
  auth
} from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'input' | 'sent'>('input');

  // Cek apakah URL saat ini adalah email link (user klik dari email)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      
      if (checkSignInLink(url)) {
        // Ambil email dari localStorage
        const emailFromStorage = window.localStorage.getItem('emailForSignIn');
        
        if (emailFromStorage) {
          handleCompleteSignIn(emailFromStorage, url);
        } else {
          setError('Sesi tidak valid. Silakan masukkan email lagi.');
        }
      }
    }
  }, []);

  const handleCompleteSignIn = async (userEmail: string, url: string) => {
    setLoading(true);
    setStep('sent');
    
    try {
      const result = await completeSignInWithLink(userEmail, url);
      
      if (result.success && result.user) {
        // Cek apakah user sudah ada di Firestore
        const userCheck = await checkUserExists(userEmail);
        
        // Simpan/update ke Firestore
        await saveUserToFirestore(
          userEmail, 
          result.user.displayName || userEmail.split('@')[0],
          result.uid || '',
          !userCheck.exists // isNewUser = true jika belum ada di Firestore
        );
        
        // Simpan session ke localStorage
        localStorage.setItem('needtea_user', JSON.stringify({
          email: userEmail,
          uid: result.uid,
          isLoggedIn: true,
          loginTime: new Date().toISOString()
        }));
        
        // Redirect ke home
        router.push('/?login=success');
      } else {
        setError('Link tidak valid atau sudah kadaluarsa.');
        setStep('input');
      }
    } catch (err: any) {
      setError('Gagal verifikasi: ' + err.message);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Kirim email link via Firebase
      const result = await sendEmailLink(email);
      
      if (result.success) {
        setSuccess(`Link login telah dikirim ke ${email}. Silakan cek inbox (atau folder spam) dan klik link untuk login.`);
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

  const handleCheckInbox = () => {
    // Cek apakah user sudah klik link (auth state berubah)
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Sudah login, redirect
        router.push('/');
      } else {
        setError('Belum terdeteksi login. Pastikan Anda sudah klik link di email.');
      }
    });
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
            
            {step === 'input' ? (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Selamat Datang</h1>
                <p className="text-white/80">Masuk dengan email Anda</p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Cek Email Anda</h1>
                <p className="text-white/80">Link login telah dikirim</p>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center animate-fade-in-up">
              <p className="text-red-100 text-sm">{error}</p>
              {step === 'sent' && (
                <button
                  onClick={() => setStep('input')}
                  className="mt-3 text-white underline text-sm hover:text-yellow-300"
                >
                  Kirim ulang ke email lain
                </button>
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

          {step === 'input' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  Link login akan dikirim ke email Anda
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
                    <span>Kirim Link Login</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-white/20" />
                <span className="px-4 text-white/60 text-sm">atau</span>
                <div className="flex-1 h-px bg-white/20" />
              </div>

              {/* Tombol Daftar */}
              <Link href="/daftar" className="block w-full">
                <button 
                  type="button" 
                  className="w-full py-3 border-2 border-white/30 text-white rounded-xl font-medium hover:bg-white/10 transition-all flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>Buat Akun Baru</span>
                </button>
              </Link>
            </form>
          ) : (
            /* Step: Email Sent */
            <div className="space-y-6 text-center">
              <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="text-6xl mb-4">✉️</div>
                <h3 className="text-white font-bold text-lg mb-2">Link Terkirim!</h3>
                <p className="text-white/80 text-sm mb-4">
                  Kami telah mengirim link login ke:<br/>
                  <span className="text-white font-semibold break-all">{email}</span>
                </p>
                <p className="text-white/60 text-xs">
                  Klik link di email untuk login otomatis.<br/>
                  Link berlaku selama 1 jam.
                </p>
              </div>

              <button
                onClick={handleCheckInbox}
                disabled={loading}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? 'Memeriksa...' : 'Saya Sudah Klik Link'}
              </button>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('input');
                    setSuccess('');
                    setEmail('');
                  }}
                  className="text-white/60 hover:text-white text-sm underline"
                >
                  Gunakan email lain
                </button>
              </div>

              <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 text-left">
                <p className="text-blue-100 text-xs">
                  <span className="font-bold">💡 Tips:</span> Jika tidak menemukan email, cek folder <span className="font-semibold">Spam</span> atau <span className="font-semibold">Promosi</span>.
                </p>
              </div>
            </div>
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

          {/* Help Text */}
          <p className="text-center text-white/60 text-sm mt-6">
            Butuh bantuan? Hubungi{' '}
            <a href="https://wa.me/6285967046137" className="text-white underline hover:text-yellow-300">
              0859-6704-6137
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}