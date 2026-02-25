'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FloatingLeaves from '@/components/FloatingLeaves';
import useAuth from '@/hooks/useAuth';
import { getMenuItems, subscribeToMenuItems } from '@/lib/firebase';

interface CartItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  maxStock: number;
  category: string;
}

export default function MenuPage() {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'food' | 'drink'>('all');

  useEffect(() => {
    const unsubscribe = subscribeToMenuItems((items) => {
      setMenuItems(items);
      setLoading(false);
    });

    const savedCart = localStorage.getItem('needtea_cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('needtea_cart', JSON.stringify(cart));
  }, [cart]);

  const getAvailableStock = (menuId: string) => {
    const menuItem = menuItems.find(item => item.id === menuId);
    if (!menuItem) return 0;
    
    const usedInCart = cart.find(i => i.menuId === menuId)?.quantity || 0;
    return Math.max(0, (menuItem.stock || 0) - usedInCart);
  };

  const addToCart = (item: any) => {
    const availableStock = getAvailableStock(item.id);
    if (availableStock <= 0) {
      alert(`Stok ${item.name} habis!`);
      return;
    }

    const existingItem = cart.find(i => i.menuId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.stock) {
        alert(`Stok ${item.name} tidak mencukupi!`);
        return;
      }
      setCart(prev => prev.map(i => 
        i.menuId === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart(prev => [...prev, {
        menuId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: item.image,
        maxStock: item.stock || 0,
        category: item.category
      }]);
    }
  };

  const updateQuantity = (menuId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(i => i.menuId !== menuId));
      return;
    }

    const item = cart.find(i => i.menuId === menuId);
    if (!item) return;

    if (quantity > item.maxStock) {
      alert(`Stok ${item.name} tidak mencukupi! Maksimum: ${item.maxStock}`);
      return;
    }

    setCart(prev => prev.map(i => 
      i.menuId === menuId ? { ...i, quantity } : i
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Keranjang masih kosong!');
      return;
    }
    if (!userData) {
      alert('Silakan login terlebih dahulu!');
      router.push('/login?redirect=/menu');
      return;
    }
    router.push('/order');
  };

  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

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

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <div className="fixed inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"/>
      <FloatingLeaves />
      <Navbar />

      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Menu Kami</h1>
            <p className="text-white/80 text-lg">Pilih favoritmu dan nikmati kesegarannya</p>
          </div>

          <div className="flex justify-center space-x-2 mb-8">
            {[
              { key: 'all', label: 'Semua', icon: '🍽️' },
              { key: 'food', label: 'Makanan', icon: '🍰' },
              { key: 'drink', label: 'Minuman', icon: '🥤' }
            ].map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key as any)}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  selectedCategory === cat.key
                    ? 'bg-white text-tea-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => {
                  const availableStock = getAvailableStock(item.id);
                  const isOutOfStock = availableStock <= 0;

                  return (
                    <div 
                      key={item.id} 
                      className={`bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 transition-all ${
                        isOutOfStock ? 'opacity-50' : 'hover:bg-white/20'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-24 h-24 bg-white/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{item.category === 'food' ? '🍰' : '🥤'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg truncate">{item.name}</h3>
                          <p className="text-white/70 text-sm line-clamp-2 mb-2">{item.description}</p>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-yellow-300 font-bold">Rp {item.price?.toLocaleString()}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              isOutOfStock ? 'bg-red-500/50 text-red-100' :
                              availableStock < 5 ? 'bg-yellow-500/50 text-yellow-100' :
                              'bg-green-500/50 text-green-100'
                            }`}>
                              Stok: {availableStock}
                            </span>
                          </div>
                          <button
                            onClick={() => !isOutOfStock && addToCart(item)}
                            disabled={isOutOfStock}
                            className={`w-full py-2 rounded-lg font-medium transition-all ${
                              isOutOfStock
                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                : 'bg-white/20 hover:bg-white/30 text-white'
                            }`}
                          >
                            {isOutOfStock ? 'Stok Habis' : '+ Tambah ke Keranjang'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="sticky top-24 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <h2 className="text-white font-bold text-xl mb-4 flex items-center">
                  <span>🛒</span>
                  <span className="ml-2">Keranjang</span>
                  {cart.length > 0 && (
                    <span className="ml-auto bg-yellow-400 text-yellow-900 text-sm px-2 py-1 rounded-full">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)}
                    </span>
                  )}
                </h2>

                {cart.length === 0 ? (
                  <p className="text-white/60 text-center py-8">Keranjang masih kosong</p>
                ) : (
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.menuId} className="bg-white/10 rounded-xl p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-white font-medium text-sm">{item.name}</span>
                          <button 
                            onClick={() => updateQuantity(item.menuId, 0)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => updateQuantity(item.menuId, item.quantity - 1)}
                              className="w-6 h-6 bg-white/20 rounded text-white hover:bg-white/30 flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="text-white w-8 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.menuId, item.quantity + 1)}
                              className="w-6 h-6 bg-white/20 rounded text-white hover:bg-white/30 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-yellow-300 text-sm">
                            Rp {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <>
                    <div className="border-t border-white/20 pt-4 mb-4">
                      <div className="flex justify-between items-center text-white">
                        <span className="font-medium">Total</span>
                        <span className="text-2xl font-bold text-yellow-300">
                          Rp {calculateTotal().toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleCheckout}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white rounded-xl font-bold transition-all"
                    >
                      Lanjut ke Pembayaran
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}