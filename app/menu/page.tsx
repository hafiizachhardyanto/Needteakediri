'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FloatingLeaves from '@/components/FloatingLeaves';
import Navbar from '@/components/Navbar';
import { getMenuItems } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export default function MenuPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'food' | 'drink'>('all');

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    const result = await getMenuItems();
   if (result.success && result.items) {
  setMenuItems(result.items);
} else {
  setMenuItems([]);
}
    setLoading(false);
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: item.image
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    localStorage.setItem('needtea_cart', JSON.stringify(cart));
    router.push('/order');
  };

  const filteredItems = activeCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === activeCategory);

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <FloatingLeaves />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-32 px-4">
        <div className="max-w-6xl mx-auto">
          
          <h1 className="text-4xl font-bold text-white text-center mb-8">Menu Kami</h1>
          
          {/* Category Filter */}
          <div className="flex justify-center space-x-4 mb-8">
            {[
              { key: 'all', label: 'Semua', icon: '🍽️' },
              { key: 'food', label: 'Makanan', icon: '🍰' },
              { key: 'drink', label: 'Minuman', icon: '🥤' }
            ].map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key as any)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeCategory === cat.key
                    ? 'bg-white text-tea-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          {loading ? (
            <div className="text-center text-white py-12">Memuat menu...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/20 hover:transform hover:-translate-y-2 transition-all">
                  <div className="h-48 bg-gray-300 relative">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        {item.category === 'food' ? '🍰' : '🥤'}
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-white">{item.name}</h3>
                      <span className="text-yellow-300 font-bold text-lg">
                        Rp {item.price.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white/70 text-sm mb-4">{item.description}</p>
                    
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full py-3 bg-white text-tea-600 rounded-xl font-bold hover:bg-yellow-50 transition-all flex items-center justify-center space-x-2"
                    >
                      <span>+ Tambah</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Floating Cart */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-2xl z-50 p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div>
              <p className="text-gray-600 text-sm">{totalItems} item dipilih</p>
              <p className="text-2xl font-bold text-tea-600">
                Total: Rp {totalPrice.toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleCheckout}
              className="px-8 py-4 bg-tea-600 text-white rounded-xl font-bold hover:bg-tea-700 transition-all flex items-center space-x-2"
            >
              <span>Pesan Sekarang</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
