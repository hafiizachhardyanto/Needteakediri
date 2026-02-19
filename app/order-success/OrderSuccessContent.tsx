'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60); // 30 menit dalam detik
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    if (!orderId) return;

    // Subscribe realtime ke order
    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder(data);
        setStatus(data.status);
        
        // Jika sudah completed atau cancelled, stop timer
        if (data.status === 'completed' || data.status === 'cancelled') {
          return;
        }
        
        // Calculate time left
        if (data.expiryTime?.toDate) {
          const expiry = data.expiryTime.toDate();
          const now = new Date();
          const diff = Math.floor((expiry.getTime() - now.getTime()) / 1000);
          setTimeLeft(Math.max(0, diff));
        }
      }
    });

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Waktu habis, redirect ke menu
          alert('Waktu pembayaran habis! Silakan pesan ulang.');
          router.push('/menu');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [orderId, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'cancelled') {
    return (
      <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-br from-red-400 via-red-500 to-red-700" />
        <FloatingLeaves />
        <Navbar />
        
        <div className="relative z-10 px-4 w-full max-w-md">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Pesanan Dibatalkan</h1>
            <p className="text-gray-600 mb-6">
              Waktu pembayaran 30 menit telah habis. Silakan pesan ulang.
            </p>
            <Link href="/menu">
              <button className="w-full py-3 bg-tea-600 text-white rounded-xl font-bold hover:bg-tea-700 transition-all">
                Pesan Ulang
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'completed') {
    return (
      <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-br from-green-400 via-green-500 to-green-700" />
        <FloatingLeaves />
        <Navbar />
        
        <div className="relative z-10 px-4 w-full max-w-md">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Pesanan Selesai!</h1>
            <p className="text-gray-600 mb-6">
              Pesanan Anda telah selesai diproses. Terima kasih!
            </p>
            <Link href="/">
              <button className="w-full py-3 bg-tea-600 text-white rounded-xl font-bold hover:bg-tea-700 transition-all">
                Kembali ke Beranda
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Menunggu Pembayaran</h1>
            
            {/* ⭐ COUNTDOWN TIMER */}
            <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 mb-6">
              <p className="text-red-600 text-sm mb-1">Sisa Waktu Pembayaran:</p>
              <p className="text-4xl font-bold text-red-600 font-mono">
                {formatTime(timeLeft)}
              </p>
            </div>

            {order && (
              <div className="bg-gray-100 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-gray-600">Order ID:</p>
                <p className="font-mono text-sm mb-3">{orderId}</p>
                
                <p className="text-sm text-gray-600">Total:</p>
                <p className="text-2xl font-bold text-tea-600 mb-3">
                  Rp {order.totalAmount?.toLocaleString()}
                </p>
                
                <p className="text-sm text-gray-600">Pembayaran:</p>
                <p className="font-medium">
                  {order.paymentMethod === 'cash' ? '💵 Bayar Tunai' : '🧡 ShopeePay'}
                </p>
                
                {order.paymentMethod === 'shopeepay' && (
                  <div className="mt-3 p-3 bg-orange-100 rounded-lg">
                    <p className="text-sm text-orange-800">Transfer ke:</p>
                    <p className="text-lg font-bold text-orange-600">0857-0250-6241</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-gray-600 text-sm">
                Silakan selesaikan pembayaran sebelum waktu habis.
                Pesanan akan diproses setelah pembayaran dikonfirmasi.
              </p>
              
              <Link href="/menu">
                <button className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all">
                  Kembali ke Menu
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}