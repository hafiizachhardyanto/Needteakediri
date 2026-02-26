'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';
import { subscribeToUserOrders, cancelOrder } from '@/lib/firebase';

type OrderStatus = 'awaiting_payment' | 'payment_confirmed' | 'pending' | 'completed' | 'cancelled';

interface Order {
  id: string;
  items: any[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: any;
  completedAt?: any;
  expiryTime?: any;
}

export default function CekPesananPage() {
  const router = useRouter();
  const { user, userData, isAdmin, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [timers, setTimers] = useState<{[key: string]: number}>({});
  const [isReady, setIsReady] = useState(false);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    const checkAuth = () => {
      if (redirectAttempted.current) return;
      
      const storedUser = localStorage.getItem('needtea_user');
      
      if (!storedUser && !user) {
        redirectAttempted.current = true;
        router.replace('/login?redirect=/cek-pesanan');
        return;
      }

      if (isAdmin) {
        redirectAttempted.current = true;
        router.replace('/admin');
        return;
      }

      setIsReady(true);
    };

    checkAuth();
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isReady || !userData?.email) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = () => {
      try {
        unsubscribe = subscribeToUserOrders(userData.email, (userOrders) => {
          setOrders(userOrders);
          setLoading(false);
        });
      } catch (err) {
        console.error('Subscription error:', err);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isReady, userData?.email]);

  useEffect(() => {
    if (orders.length === 0) return;
    
    const interval = setInterval(() => {
      const newTimers: {[key: string]: number} = {};
      
      orders.forEach(order => {
        if (order.status === 'awaiting_payment' && order.expiryTime) {
          try {
            const expiry = order.expiryTime.toDate 
              ? order.expiryTime.toDate().getTime() 
              : new Date(order.expiryTime.seconds * 1000).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
            newTimers[order.id] = remaining;
          } catch (e) {
            newTimers[order.id] = 0;
          }
        }
      });
      
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [orders]);

  const getStatusConfig = (status: OrderStatus) => {
    const configs: Record<OrderStatus, { text: string; color: string; bg: string; icon: string; desc: string }> = {
      awaiting_payment: { 
        text: 'MENUNGGU KONFIRMASI ADMIN', 
        color: 'text-cyan-400', 
        bg: 'bg-cyan-500/10',
        icon: '⏳',
        desc: 'Admin sedang memeriksa pembayaran Anda'
      },
      payment_confirmed: { 
        text: 'PEMBAYARAN DIKONFIRMASI', 
        color: 'text-fuchsia-400', 
        bg: 'bg-fuchsia-500/10',
        icon: '✅',
        desc: 'Pesanan Anda akan segera diproses'
      },
      pending: { 
        text: 'SEDANG DIPROSES', 
        color: 'text-yellow-400', 
        bg: 'bg-yellow-500/10',
        icon: '⚙️',
        desc: 'Pesanan sedang disiapkan'
      },
      completed: { 
        text: 'SELESAI', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10',
        icon: '✨',
        desc: 'Pesanan telah selesai'
      },
      cancelled: { 
        text: 'DIBATALKAN', 
        color: 'text-rose-500', 
        bg: 'bg-rose-500/10',
        icon: '❌',
        desc: 'Pesanan dibatalkan'
      }
    };
    return configs[status] || configs.pending;
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;
    
    const result = await cancelOrder(orderId);
    if (result.success) {
      alert('Pesanan dibatalkan');
    } else {
      alert('Gagal membatalkan: ' + result.error);
    }
  };

  const activeOrders = orders.filter(o => 
    ['awaiting_payment', 'payment_confirmed', 'pending'].includes(o.status)
  );
  
  const historyOrders = orders.filter(o => 
    ['completed', 'cancelled'].includes(o.status)
  );

  const displayOrders = activeTab === 'active' ? activeOrders : historyOrders;

  if (authLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-mono">MEMUAT...</p>
        </div>
      </div>
    );
  }

  if (!user && !localStorage.getItem('needtea_user')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-cyan-400 mb-4 font-mono text-xl">AKSES_DITOLAK</p>
          <p className="text-slate-400 mb-6">Silakan login sebagai pelanggan</p>
          <Link href="/login">
            <button className="px-8 py-3 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/30 transition-all">
              LOGIN
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-fuchsia-500/5" />
      
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-cyan-500/30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3">
            <span className="text-3xl">🍵</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
              NeedTea
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-slate-400 hover:text-cyan-400 font-mono text-sm">BERANDA</Link>
            <Link href="/menu" className="text-slate-400 hover:text-cyan-400 font-mono text-sm">MENU</Link>
            <span className="text-cyan-400 font-mono text-sm border-b-2 border-cyan-400 pb-1">CEK_PESANAN</span>
          </div>
          
          <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 font-mono text-sm">{userData?.name || 'User'}</span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
                STATUS_PESANAN
              </span>
            </h1>
            <p className="text-slate-400 font-mono">Pantau pesanan Anda secara real-time</p>
          </div>

          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-8 py-4 rounded-lg font-bold font-mono text-sm transition-all ${
                activeTab === 'active' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400 shadow-lg shadow-cyan-500/20' 
                  : 'bg-slate-900 text-slate-500 border border-slate-700 hover:border-cyan-500/50'
              }`}
            >
              PESANAN_AKTIF [{activeOrders.length}]
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`px-8 py-4 rounded-lg font-bold font-mono text-sm transition-all ${
                activeTab === 'history' 
                  ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-400 shadow-lg shadow-fuchsia-500/20' 
                  : 'bg-slate-900 text-slate-500 border border-slate-700 hover:border-fuchsia-500/50'
              }`}
            >
              RIWAYAT [{historyOrders.length}]
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-cyan-400 font-mono">MEMUAT_DATA...</p>
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800">
              <div className="text-8xl mb-6 opacity-50">📭</div>
              <p className="text-2xl font-mono text-slate-500 mb-2">TIDAK_ADA_DATA</p>
              <p className="text-slate-600 mb-8">
                {activeTab === 'active' 
                  ? 'Anda tidak memiliki pesanan aktif saat ini' 
                  : 'Belum ada riwayat pesanan'}
              </p>
              <Link href="/menu">
                <button className="px-8 py-3 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/30 transition-all">
                  PESAN_SEKARANG
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {displayOrders.map((order) => {
                const status = getStatusConfig(order.status);
                const remainingTime = timers[order.id] || 0;
                
                return (
                  <div key={order.id} className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-2xl opacity-20 group-hover:opacity-40 transition-opacity blur" />
                    
                    <div className="relative bg-slate-900 rounded-2xl p-6 border border-slate-800">
                      
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                        <div>
                          <p className="text-slate-500 font-mono text-xs mb-1 tracking-wider">ORDER_ID</p>
                          <p className="text-xl font-mono text-cyan-400 tracking-wider">
                            #{order.id.slice(-8).toUpperCase()}
                          </p>
                        </div>
                        <div className={`px-4 py-2 rounded-lg ${status.bg} ${status.color} border border-current flex items-center space-x-2`}>
                          <span>{status.icon}</span>
                          <span className="font-mono text-xs font-bold tracking-wider">{status.text}</span>
                        </div>
                      </div>

                      {order.status === 'awaiting_payment' && remainingTime > 0 && (
                        <div className="mb-6 bg-slate-950 border border-cyan-500/30 rounded-xl p-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-cyan-400 font-mono text-xs mb-1">BATAS_WAKTU</p>
                              <p className="text-4xl font-black font-mono text-cyan-400">
                                {formatTime(remainingTime)}
                              </p>
                            </div>
                            <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                          </div>
                        </div>
                      )}

                      <div className="mb-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                        <p className={`${status.color} text-sm font-mono`}>
                          {status.icon} {status.desc}
                        </p>
                      </div>

                      <div className="space-y-3 mb-6">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 px-3 rounded-lg transition-colors">
                            <div className="flex items-center space-x-3">
                              <span className="text-cyan-400 font-mono text-sm font-bold">{item.quantity}x</span>
                              <span className="text-slate-300">{item.name}</span>
                            </div>
                            <span className="text-fuchsia-400 font-mono">Rp {item.subtotal?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-800 pt-6 flex flex-wrap justify-between items-center gap-4">
                        <div>
                          <p className="text-slate-500 font-mono text-xs mb-1 tracking-wider">TOTAL_PEMBAYARAN</p>
                          <p className="text-3xl font-black text-cyan-400">
                            Rp {order.totalAmount?.toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-slate-600 font-mono text-xs">
                            {order.createdAt?.toDate?.().toLocaleString('id-ID') || '-'}
                          </p>
                          {order.status === 'awaiting_payment' && remainingTime > 0 && (
                            <button
                              onClick={() => handleCancel(order.id)}
                              className="mt-2 text-rose-500 hover:text-rose-400 text-sm font-mono underline decoration-rose-500/50"
                            >
                              [BATALKAN_PESANAN]
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}