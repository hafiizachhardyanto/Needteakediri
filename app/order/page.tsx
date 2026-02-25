'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import useAuth from '@/hooks/useAuth';
import { createOrder, deductStockForOrder } from '@/lib/firebase';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

interface CartItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  maxStock: number;
}

export default function OrderPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [shopeepayNumber, setShopeepayNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && !userData) {
      localStorage.setItem('needtea_redirect_after_login', '/order');
      router.push('/login?redirect=/order');
      return;
    }

    const savedCart = localStorage.getItem('needtea_cart');
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      if (parsedCart.length === 0) {
        router.push('/menu');
        return;
      }
      setCart(parsedCart);
    } else {
      router.push('/menu');
    }
  }, [userData, authLoading, router]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleOrder = async () => {
    if (!shopeepayNumber.trim()) {
      alert('Masukkan nomor ShopeePay!');
      return;
    }

    if (!/^\d{10,13}$/.test(shopeepayNumber)) {
      alert('Nomor ShopeePay tidak valid! (10-13 digit)');
      return;
    }

    setLoading(true);

    const stockCheck = await deductStockForOrder(cart.map(item => ({
      menuId: item.menuId,
      quantity: item.quantity
    })));

    if (!stockCheck.success) {
      alert(stockCheck.error);
      setLoading(false);
      return;
    }

    const orderData = {
      userEmail: userData.email,
      userName: userData.name,
      items: cart.map(item => ({
        menuId: item.menuId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        image: item.image
      })),
      totalAmount,
      paymentMethod: 'shopeepay' as const,
      shopeepayNumber: shopeepayNumber,
      status: 'awaiting_payment' as const,
      paymentStatus: 'pending' as const,
      createdAt: serverTimestamp(),
      awaitingPaymentAt: serverTimestamp(),
      expiryTime: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000))
    };

    const result = await createOrder(orderData);
    
    if (result.success) {
      localStorage.removeItem('needtea_cart');
      router.push(`/order-success?orderId=${result.orderId}`);
    } else {
      alert('Gagal membuat pesanan: ' + result.error);
    }
    
    setLoading(false);
  };

  const openShopeeApp = () => {
    window.open('shopeeid://', '_blank');
  };

  if (authLoading) {
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

  if (cart.length === 0) return null;

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-100 font-bold">⏰ Batas Waktu Pembayaran: 30 Menit</p>
            <p className="text-red-200 text-sm">Setelah checkout, segera lakukan pembayaran</p>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-8">Checkout</h1>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Detail Pesanan</h2>
            
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-3 border-b border-white/10">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{item.image ? '📷' : '🍽️'}</span>
                  <div>
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-white/60 text-sm">{item.quantity}x Rp {item.price.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-white font-bold">
                  Rp {(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
            
            <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-white/20">
              <p className="text-xl font-bold text-white">Total</p>
              <p className="text-2xl font-bold text-yellow-300">
                Rp {totalAmount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <span className="mr-2">🧡</span>
              Pembayaran ShopeePay
            </h2>
            
            <div className="bg-orange-500/20 border border-orange-400/30 rounded-xl p-4 mb-4">
              <p className="text-orange-100 text-sm mb-2">Transfer ke ShopeePay:</p>
              <p className="text-white text-2xl font-bold">0857-0250-6241</p>
              <p className="text-orange-200 text-sm mt-1">A/N: NeedTea Official</p>
              <button
                onClick={openShopeeApp}
                className="mt-3 w-full py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-all"
              >
                Buka Aplikasi Shopee
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-white/80 text-sm mb-2">Nomor ShopeePay Anda</label>
              <input
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={shopeepayNumber}
                onChange={(e) => setShopeepayNumber(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:border-orange-500 outline-none"
              />
              <p className="text-white/60 text-xs mt-2">
                Pesanan akan masuk ke halaman konfirmasi admin. Timer 30 menit dimulai setelah checkout.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg shadow-lg hover:from-orange-400 hover:to-red-400 transition-all disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'BAYAR SEKARANG'}
            </button>
            
            <button
              onClick={() => router.push('/menu')}
              className="w-full py-3 bg-transparent border-2 border-white/30 text-white rounded-xl font-medium hover:bg-white/10 transition-all"
            >
              Kembali ke Menu
            </button>
          </div>

        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">🧡</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Konfirmasi Pembayaran</h3>
              
              <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mb-4">
                <p className="text-orange-800 text-sm">
                  Anda memiliki <span className="font-bold">30 menit</span> untuk menyelesaikan pembayaran ke ShopeePay <span className="font-bold">0857-0250-6241</span>.
                </p>
              </div>
              
              <p className="text-gray-600 mb-6">
                Total: <span className="font-bold text-orange-600">Rp {totalAmount.toLocaleString()}</span>
                <br />
                Dari: {shopeepayNumber}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleOrder}
                  disabled={loading}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
                >
                  {loading ? 'Memproses...' : 'Ya, Saya Sudah Transfer'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}