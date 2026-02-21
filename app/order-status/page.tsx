'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import useAuth from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Link from 'next/link';

interface Order {
  id: string;
  items: any[];
  totalAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  paymentMethod: string;
  createdAt: any;
  expiryTime?: any;
}

export default function OrderStatusPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect ke login jika belum login
    if (!authLoading && !userData) {
      router.push('/login?redirect=/order-status');
      return;
    }

    if (userData?.email) {
      loadOrders();
    }
  }, [userData, authLoading, router]);

  const loadOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('userEmail', '==', userData.email),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const ordersData: Order[] = [];
      
      querySnapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() } as Order);
      });
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Selesai';
      case 'cancelled': return 'Dibatalkan';
      default: return 'Menunggu Pembayaran';
    }
  };

  if (authLoading || loading) {
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

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">Status Pesanan</h1>
          
          {orders.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-2xl font-bold text-white mb-2">Belum Ada Pesanan</h2>
              <p className="text-white/80 mb-6">Anda belum memiliki pesanan aktif</p>
              <Link href="/menu">
                <button className="px-6 py-3 bg-white text-tea-600 rounded-xl font-bold hover:bg-yellow-50 transition-all">
                  Pesan Sekarang
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-white/60 text-sm">Order ID</p>
                      <p className="text-white font-mono text-sm">{order.id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-white/80">
                        <span>{item.name} x{item.quantity}</span>
                        <span>Rp {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-white/20 pt-4 flex justify-between items-center">
                    <div>
                      <p className="text-white/60 text-sm">Total</p>
                      <p className="text-2xl font-bold text-yellow-300">
                        Rp {order.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-sm">Pembayaran</p>
                      <p className="text-white font-medium">
                        {order.paymentMethod === 'cash' ? '💵 Tunai' : '🧡 ShopeePay'}
                      </p>
                    </div>
                  </div>
                  
                  {order.status === 'pending' && (
                    <div className="mt-4 bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-3 text-center">
                      <p className="text-yellow-100 text-sm">
                        ⏰ Segera selesaikan pembayaran dalam 30 menit
                      </p>
                    </div>
                  )}
                  
                  {order.status === 'cancelled' && (
                    <div className="mt-4 text-center">
                      <Link href="/menu">
                        <button className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all">
                          Pesan Ulang
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}