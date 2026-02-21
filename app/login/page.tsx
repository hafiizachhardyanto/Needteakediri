'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import { sendEmailLink, checkSignInLink, completeSignInWithLink, saveUserToFirestore, checkUserExists } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';

// ✅ TAMBAHAN: Komponen yang menggunakan useSearchParams dibungkus terpisah
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userData } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(300);

  // Redirect jika sudah login
  useEffect(() => {
    if (userData) {
      const redirect = searchParams.get('redirect') || '/';
      const savedCart = localStorage.getItem('needtea_cart');
      
      if (savedCart && redirect === '/order') {
        router.push('/order');
      } else {
        router.push(redirect);
      }
    }
  }, [userData, router, searchParams]);

  // Check if this is email link callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      if (checkSignInLink(url)) {
        const emailFromStorage = window.localStorage.getItem('emailForSignIn');
        if (emailFromStorage) {
          handleCompleteSignIn(emailFromStorage, url);
        }
      }
    }
  }, []);

  const handleCompleteSignIn = async (email: string, url: string) => {
    setLoading(true);
    const result = await completeSignInWithLink(email, url);
    
    if (result.success && result.user) {
      const uid = result.user.uid;
      const isNewUser = result.user.metadata?.creationTime === result.user.metadata?.lastSignInTime;
      
      await saveUserToFirestore(email, {
        name: email.split('@')[0],
        uid: uid,
        isNewUser: isNewUser
      });
      
      localStorage.setItem('needtea_user', JSON.stringify({
        email: email,
        uid: uid,
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      }));
      
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
    } else {
      setError('Link tidak valid atau sudah kadaluarsa.');
      setLoading(false);
    }
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Email tidak valid');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const result = await sendEmailLink(email);
    
    if (result.success) {
      setStep('otp');
      setCountdown(300);
    } else {
      setError(result.error || 'Gagal mengirim email');
    }
    
    setLoading(false);
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
            
            <h1 className="text-3xl font-bold text-white mb-2">Masuk</h1>
            <p className="text-white/80">Login dengan email Anda</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center">
              <p className="text-red-100 text-sm">{error}</p>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendLink} className="space-y-6">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Alamat Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50"
              >
                {loading ? 'Mengirim...' : 'Kirim Link Login'}
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
            <div className="text-center space-y-6">
              <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4">
                <p className="text-green-100 text-sm">
                  Link login telah dikirim ke <span className="font-bold">{email}</span>
                </p>
                <p className="text-green-200 text-xs mt-2">
                  Cek inbox atau spam folder Anda
                </p>
              </div>
              
              <button
                onClick={() => setStep('email')}
                className="text-white/60 hover:text-white text-sm underline"
              >
                Gunakan email lain
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ✅ TAMBAHAN: Loading fallback component
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

// ✅ PERBAIKAN: Export default dengan Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}