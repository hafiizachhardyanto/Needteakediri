'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import { createOrder, cancelExpiredOrders } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export default function OrderPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'shopeepay' | 'cash'>('cash');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const savedCart = localStorage.getItem('needtea_cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    } else {
      router.push('/menu');
    }
    
    // Check expired orders periodically
    const interval = setInterval(() => {
      cancelExpiredOrders();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleOrder = async () => {
    if (!userData) {
      alert('Silakan login terlebih dahulu');
      router.push('/login');
      return;
    }

    setLoading(true);
    
    const orderData = {
      userEmail: userData.email,
      userName: userData.name,
      items: cart.map(item => ({
        menuId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        image: item.image
      })),
      totalAmount,
      paymentMethod,
      shopeepayNumber: paymentMethod === 'shopeepay' ? '085702506241' : null
    };

    const result = await createOrder(orderData);
    
    if (result.success) {
      localStorage.removeItem('needtea_cart');
      // Start countdown
      if (result.expiryTime) {
        const expiry = new Date(result.expiryTime);
        const updateTimer = () => {
          const now = new Date();
          const diff = expiry.getTime() - now.getTime();
          if (diff <= 0) {
            alert('Waktu pembayaran habis! Silakan pesan ulang.');
            router.push('/menu');
            return;
          }
          setTimeLeft(Math.floor(diff / 1000));
        };
        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        setTimeout(() => clearInterval(timer), 30 * 60 * 1000); // 30 minutes
      }
      router.push(`/order-success?orderId=${result.id}`);
    } else {
      alert('Gagal membuat pesanan: ' + result.error);
    }
    
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShopeePay = () => {
    window.open('https://shopee.co.id/m/shopeepay', '_blank');
    setPaymentMethod('shopeepay');
  };

  if (cart.length === 0) return null;

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          
          {/* ⭐ WARNING TIMEOUT */}
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-100 font-bold">⏰ Batas Waktu Pembayaran: 30 Menit</p>
            <p className="text-red-200 text-sm">Jika melebihi 30 menit, pesanan akan dibatalkan otomatis</p>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-8">Konfirmasi Pesanan</h1>
          
          {/* Order Summary */}
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

          {/* Payment Method */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Metode Pembayaran</h2>
            
            <div className="space-y-3">
              <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-all">
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                  className="w-5 h-5 mr-4"
                />
                <span className="text-2xl mr-3">💵</span>
                <div>
                  <p className="text-white font-medium">Bayar Tunai</p>
                  <p className="text-white/60 text-sm">Bayar di tempat saat pengambilan</p>
                </div>
              </label>

              <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-all">
                <input
                  type="radio"
                  name="payment"
                  value="shopeepay"
                  checked={paymentMethod === 'shopeepay'}
                  onChange={() => setPaymentMethod('shopeepay')}
                  className="w-5 h-5 mr-4"
                />
                <span className="text-2xl mr-3">🧡</span>
                <div>
                  <p className="text-white font-medium">ShopeePay</p>
                  <p className="text-white/60 text-sm">Transfer ke 0857-0250-6241</p>
                </div>
              </label>
            </div>

            {paymentMethod === 'shopeepay' && (
              <div className="mt-4 p-4 bg-orange-500/20 border border-orange-400/30 rounded-xl">
                <p className="text-orange-100 text-sm mb-2">Nomor ShopeePay:</p>
                <p className="text-white text-xl font-bold">0857-0250-6241</p>
                <button
                  onClick={handleShopeePay}
                  className="mt-3 w-full py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-all"
                >
                  Buka Aplikasi Shopee
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="w-full py-4 bg-white text-tea-600 rounded-xl font-bold text-lg shadow-lg hover:bg-yellow-50 transition-all disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'PESAN SEKARANG'}
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

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Konfirmasi Pesanan</h3>
              
              {/* ⭐ WARNING DI MODAL */}
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Anda memiliki <span className="font-bold">30 menit</span> untuk menyelesaikan pembayaran. 
                  Jika lewat, pesanan akan dibatalkan otomatis.
                </p>
              </div>
              
              <p className="text-gray-600 mb-6">
                Total: <span className="font-bold text-tea-600">Rp {totalAmount.toLocaleString()}</span>
                <br />
                Metode: {paymentMethod === 'cash' ? 'Bayar Tunai' : 'ShopeePay'}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleOrder}
                  disabled={loading}
                  className="w-full py-3 bg-tea-600 text-white rounded-xl font-bold hover:bg-tea-700 transition-all"
                >
                  {loading ? 'Memproses...' : 'Ya, Pesan Sekarang'}
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