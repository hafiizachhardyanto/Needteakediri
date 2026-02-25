'use client';

import React, { useState, useEffect } from 'react';
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
  const { userData, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [timers, setTimers] = useState<{[key: string]: number}>({});

  useEffect(() => {
    if (!authLoading && !userData) {
      router.push('/login?redirect=/cek-pesanan');
      return;
    }

    if (!userData?.email) return;

    const unsubscribe = subscribeToUserOrders(userData.email, (userOrders) => {
      setOrders(userOrders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData, authLoading, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers: {[key: string]: number} = {};
      
      orders.forEach(order => {
        if (order.status === 'awaiting_payment' && order.expiryTime) {
          const expiry = order.expiryTime.toDate().getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
          newTimers[order.id] = remaining;
        }
      });
      
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [orders]);

  const getStatusConfig = (status: OrderStatus) => {
    const configs: Record<OrderStatus, { text: string; color: string; glow: string; icon: string }> = {
      awaiting_payment: { 
        text: 'MENUNGGU PEMBAYARAN', 
        color: 'text-cyan-400', 
        glow: 'shadow-cyan-500/50',
        icon: '⚡'
      },
      payment_confirmed: { 
        text: 'PEMBAYARAN TERKONFIRMASI', 
        color: 'text-fuchsia-400', 
        glow: 'shadow-fuchsia-500/50',
        icon: '🔮'
      },
      pending: { 
        text: 'SEDANG DIPROSES', 
        color: 'text-yellow-400', 
        glow: 'shadow-yellow-500/50',
        icon: '⚙️'
      },
      completed: { 
        text: 'SELESAI', 
        color: 'text-emerald-400', 
        glow: 'shadow-emerald-500/50',
        icon: '✨'
      },
      cancelled: { 
        text: 'DIBATALKAN', 
        color: 'text-rose-500', 
        glow: 'shadow-rose-500/50',
        icon: '💀'
      }
    };
    return configs[status];
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-fuchsia-500/10" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4 shadow-lg shadow-cyan-500/50" />
          <p className="text-cyan-400 font-mono text-lg tracking-wider animate-pulse">LOADING_SYSTEM...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-fuchsia-500/10" />
        <div className="relative z-10 text-center">
          <p className="text-cyan-400 mb-6 font-mono text-xl">AKSES_DITOLAK</p>
          <Link href="/login">
            <button className="px-8 py-3 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/30 transition-all shadow-lg shadow-cyan-500/30">
              LOGIN_REQUIRED
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-fuchsia-500/5" />
      
      <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
      <div className="fixed bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent opacity-50" />
      
      <div className="fixed top-20 left-0 w-px h-40 bg-gradient-to-b from-cyan-400 to-transparent opacity-30 animate-pulse" />
      <div className="fixed top-40 right-0 w-px h-60 bg-gradient-to-b from-fuchsia-400 to-transparent opacity-30 animate-pulse" />
      <div className="fixed bottom-20 left-20 w-px h-32 bg-gradient-to-b from-emerald-400 to-transparent opacity-20 animate-pulse" />
      
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <span className="text-3xl group-hover:animate-bounce filter drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">🍵</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
              NeedTea
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm tracking-wider">
              BERANDA
            </Link>
            <Link href="/menu" className="text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm tracking-wider">
              MENU
            </Link>
            <span className="text-cyan-400 font-mono text-sm tracking-wider border-b-2 border-cyan-400 pb-1">
              CEK_PESANAN
            </span>
          </div>
          
          <div className="flex items-center space-x-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50" />
            <span className="text-cyan-400 font-mono text-sm">{userData.name}</span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-10">
            <h1 className="text-5xl md:text-6xl font-black mb-4">
              <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                STATUS_PESANAN
              </span>
            </h1>
            <div className="w-32 h-1 bg-gradient-to-r from-cyan-400 to-fuchsia-400 mx-auto rounded-full shadow-lg shadow-cyan-500/50" />
          </div>

          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`relative px-8 py-4 rounded-lg font-bold font-mono tracking-wider transition-all overflow-hidden group ${
                activeTab === 'active' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400 shadow-lg shadow-cyan-500/30' 
                  : 'bg-slate-900/50 text-slate-500 border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400'
              }`}
            >
              <span className="relative z-10">AKTIF_[{activeOrders.length}]</span>
              {activeTab === 'active' && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-transparent" />
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`relative px-8 py-4 rounded-lg font-bold font-mono tracking-wider transition-all overflow-hidden group ${
                activeTab === 'history' 
                  ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-400 shadow-lg shadow-fuchsia-500/30' 
                  : 'bg-slate-900/50 text-slate-500 border border-slate-700 hover:border-fuchsia-500/50 hover:text-fuchsia-400'
              }`}
            >
              <span className="relative z-10">RIWAYAT_[{historyOrders.length}]</span>
              {activeTab === 'history' && (
                <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-400/20 to-transparent" />
              )}
            </button>
          </div>

          {displayOrders.length === 0 ? (
            <div className="text-center py-20 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-fuchsia-500/5 rounded-3xl" />
              <div className="relative z-10">
                <div className="text-8xl mb-6 opacity-50">📭</div>
                <p className="text-2xl font-mono text-slate-500 mb-2">DATA_NOT_FOUND</p>
                <p className="text-slate-600">
                  {activeTab === 'active' ? 'Tidak ada pesanan aktif' : 'Belum ada riwayat pesanan'}
                </p>
                <Link href="/menu">
                  <button className="mt-8 px-8 py-3 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/30 transition-all shadow-lg shadow-cyan-500/20">
                    BUAT_PESANAN_BARU
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {displayOrders.map((order, index) => {
                const status = getStatusConfig(order.status);
                const remainingTime = timers[order.id] || 0;
                
                return (
                  <div 
                    key={order.id} 
                    className="relative group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-2xl opacity-20 group-hover:opacity-40 transition-opacity blur" />
                    
                    <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
                      
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                        <div>
                          <p className="text-slate-500 font-mono text-xs mb-1 tracking-wider">ORDER_ID</p>
                          <p className="text-xl font-mono text-cyan-400 tracking-wider">
                            #{order.id.slice(-8).toUpperCase()}
                          </p>
                        </div>
                        <div className={`px-4 py-2 rounded-lg border ${status.color.replace('text-', 'border-')} ${status.color} ${status.glow} shadow-lg bg-slate-950/50 flex items-center space-x-2`}>
                          <span>{status.icon}</span>
                          <span className="font-mono text-xs font-bold tracking-wider">{status.text}</span>
                        </div>
                      </div>

                      {order.status === 'awaiting_payment' && remainingTime > 0 && (
                        <div className="mb-6 bg-slate-950/50 border border-cyan-500/30 rounded-xl p-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10" />
                          <div className="relative z-10 flex items-center justify-between">
                            <div>
                              <p className="text-cyan-400 font-mono text-xs mb-1">TIMER_COUNTDOWN</p>
                              <p className="text-4xl font-black font-mono text-cyan-400 tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                                {formatTime(remainingTime)}
                              </p>
                            </div>
                            <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 mb-6">
                        {order.items.map((item: any, idx: number) => (
                          <div 
                            key={idx} 
                            className="flex justify-between items-center py-3 border-b border-slate-800 last:border-0 group/item hover:bg-slate-800/50 px-3 rounded-lg transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-cyan-400 font-mono text-sm">{item.quantity}x</span>
                              <span className="text-slate-300 group-hover/item:text-cyan-400 transition-colors">{item.name}</span>
                            </div>
                            <span className="text-fuchsia-400 font-mono">Rp {item.subtotal?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-800 pt-6 flex flex-wrap justify-between items-center gap-4">
                        <div>
                          <p className="text-slate-500 font-mono text-xs mb-1">TOTAL_AMOUNT</p>
                          <p className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
                            Rp {order.totalAmount?.toLocaleString()}
                          </p>
                          <p className="text-slate-600 text-sm mt-1 flex items-center">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                            QRIS_PAYMENT
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-slate-600 font-mono text-xs mb-1">
                            {order.createdAt?.toDate?.().toLocaleString('id-ID')}
                          </p>
                          {order.status === 'awaiting_payment' && remainingTime > 0 && (
                            <button
                              onClick={() => handleCancel(order.id)}
                              className="mt-2 text-rose-500 hover:text-rose-400 text-sm font-mono underline decoration-rose-500/50 hover:decoration-rose-400"
                            >
                              [BATALKAN_ORDER]
                            </button>
                          )}
                        </div>
                      </div>

                      {order.status === 'payment_confirmed' && (
                        <div className="mt-4 p-4 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-transparent" />
                          <p className="relative z-10 text-fuchsia-400 text-sm font-mono text-center">
                            PEMBAYARAN_TERVERIFIKASI → MASUK_KE_ANTREAN
                          </p>
                        </div>
                      )}

                      {order.status === 'pending' && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent" />
                          <div className="relative z-10 flex items-center justify-center space-x-3">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                            <p className="text-yellow-400 text-sm font-mono">
                              PROSES_PENYIAPAN → SEDANG_DIKELOLA
                            </p>
                          </div>
                        </div>
                      )}

                      {order.status === 'completed' && (
                        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                          <p className="text-emerald-400 text-sm font-mono text-center">
                            ✓ PESANAN_SELESAI → TERIMA_KASIH
                          </p>
                        </div>
                      )}
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