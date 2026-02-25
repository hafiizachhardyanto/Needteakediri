'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FloatingLeaves from '@/components/FloatingLeaves';
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
  shopeepayNumber?: string;
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
    const configs: Record<OrderStatus, { text: string; color: string; bg: string; icon: string }> = {
      awaiting_payment: { 
        text: 'Menunggu Konfirmasi', 
        color: 'text-orange-400', 
        bg: 'bg-orange-500/20',
        icon: '⏳'
      },
      payment_confirmed: { 
        text: 'Pembayaran Dikonfirmasi', 
        color: 'text-blue-400', 
        bg: 'bg-blue-500/20',
        icon: '✅'
      },
      pending: { 
        text: 'Sedang Diproses', 
        color: 'text-yellow-400', 
        bg: 'bg-yellow-500/20',
        icon: '🔄'
      },
      completed: { 
        text: 'Selesai', 
        color: 'text-green-400', 
        bg: 'bg-green-500/20',
        icon: '✨'
      },
      cancelled: { 
        text: 'Dibatalkan', 
        color: 'text-red-400', 
        bg: 'bg-red-500/20',
        icon: '❌'
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700">
        <div className="text-center">
          <p className="text-white mb-4">Silakan login terlebih dahulu</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-white text-tea-600 rounded-full font-bold"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <div className="fixed inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"/>
      <FloatingLeaves />
      <Navbar />

      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">Cek Pesanan</h1>

          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 rounded-full font-bold transition-all ${
                activeTab === 'active' 
                  ? 'bg-white text-tea-600' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Pesanan Aktif ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-full font-bold transition-all ${
                activeTab === 'history' 
                  ? 'bg-white text-tea-600' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Riwayat ({historyOrders.length})
            </button>
          </div>

          {displayOrders.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-white/80 text-lg">
                {activeTab === 'active' 
                  ? 'Tidak ada pesanan aktif' 
                  : 'Belum ada riwayat pesanan'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayOrders.map((order) => {
                const status = getStatusConfig(order.status);
                const remainingTime = timers[order.id] || 0;
                
                return (
                  <div 
                    key={order.id} 
                    className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Order ID</p>
                        <p className="text-white font-mono">#{order.id.slice(-8).toUpperCase()}</p>
                      </div>
                      <div className={`px-4 py-2 rounded-full ${status.bg} ${status.color} text-sm font-bold flex items-center`}>
                        <span className="mr-1">{status.icon}</span>
                        {status.text}
                      </div>
                    </div>

                    {order.status === 'awaiting_payment' && remainingTime > 0 && (
                      <div className="mb-4 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-center">
                        <p className="text-red-200 text-sm mb-1">Batas Waktu Pembayaran:</p>
                        <p className="text-2xl font-bold text-red-400 font-mono">
                          {formatTime(remainingTime)}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2 mb-4">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-white/90">
                          <span>{item.quantity}x {item.name}</span>
                          <span>Rp {item.subtotal?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-white/20 pt-4 flex flex-wrap justify-between items-center gap-4">
                      <div>
                        <p className="text-slate-400 text-sm">Total Pembayaran</p>
                        <p className="text-2xl font-bold text-yellow-300">
                          Rp {order.totalAmount?.toLocaleString()}
                        </p>
                        {order.shopeepayNumber && (
                          <p className="text-slate-400 text-sm mt-1">
                            Dari: {order.shopeepayNumber}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <p className="text-slate-400 text-sm">
                          {order.createdAt?.toDate?.().toLocaleString('id-ID')}
                        </p>
                        {order.status === 'awaiting_payment' && remainingTime > 0 && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            className="mt-2 text-red-400 hover:text-red-300 text-sm underline"
                          >
                            Batalkan Pesanan
                          </button>
                        )}
                      </div>
                    </div>

                    {order.status === 'payment_confirmed' && (
                      <div className="mt-4 p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl">
                        <p className="text-blue-300 text-sm text-center">
                          Pembayaran telah dikonfirmasi admin. Pesanan sedang diproses.
                        </p>
                      </div>
                    )}

                    {order.status === 'pending' && (
                      <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-xl">
                        <p className="text-yellow-300 text-sm text-center">
                          Pesanan Anda sedang dalam antrian pemrosesan.
                        </p>
                      </div>
                    )}
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