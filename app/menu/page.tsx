'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';
import { subscribeToMenuItems, logoutUser } from '@/lib/firebase';

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
  const { userData, isAdmin, loading: authLoading } = useAuth();
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
      alert(`STOK_HABIS: ${item.name}`);
      return;
    }

    const existingItem = cart.find(i => i.menuId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.stock) {
        alert(`STOK_LIMIT: ${item.name}`);
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
      alert(`STOK_LIMIT: ${item.name} [MAX: ${item.maxStock}]`);
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
      alert('KERANJANG_KOSONG');
      return;
    }
    if (!userData) {
      alert('LOGIN_REQUIRED');
      router.push('/login?redirect=/menu');
      return;
    }
    router.push('/order');
  };

  const handleLogout = async () => {
    if (confirm('LOGOUT_SYSTEM?')) {
      await logoutUser();
      window.location.reload();
    }
  };

  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-fuchsia-500/10" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4 shadow-lg shadow-cyan-500/50" />
          <p className="text-cyan-400 font-mono animate-pulse">LOADING_MENU...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-fuchsia-500/5" />
      
      <div className="fixed top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
      <div className="fixed top-20 left-0 w-px h-40 bg-gradient-to-b from-cyan-400 to-transparent opacity-30 animate-pulse" />
      <div className="fixed top-40 right-0 w-px h-60 bg-gradient-to-b from-fuchsia-400 to-transparent opacity-30 animate-pulse" />
      
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3">
            <span className="text-3xl filter drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">🍵</span>
            <span className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
              NeedTea
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm">
              BERANDA
            </Link>
            <Link href="/menu" className="text-cyan-400 font-mono text-sm border-b-2 border-cyan-400 pb-1">
              MENU
            </Link>
            <Link href="/cek-pesanan" className="text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm">
              CEK_PESANAN
            </Link>
          </div>
          
          <div>
            {userData ? (
              <div className="flex items-center space-x-3">
                <span className="text-emerald-400 font-mono text-sm hidden sm:inline">{userData.name}</span>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-500/20 border border-rose-400 text-rose-400 rounded-lg font-mono text-sm hover:bg-rose-500/30 transition-all"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <Link href="/login">
                <button className="px-6 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-lg font-mono text-sm hover:bg-cyan-500/30 transition-all shadow-lg shadow-cyan-500/20">
                  LOGIN
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-28 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center space-x-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-400/30 rounded-full px-4 py-2 mb-4">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
              <span className="text-cyan-400 font-mono text-sm tracking-wider">MENU_DATABASE_LOADED</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              DIGITAL<span className="text-cyan-400">_</span>MENU
            </h1>
            <p className="text-slate-400 text-lg font-mono">Select items to initialize order protocol</p>
          </div>

          <div className="flex justify-center space-x-3 mb-10">
            {[
              { key: 'all', label: 'ALL_ITEMS', icon: '🌐' },
              { key: 'food', label: 'FOOD', icon: '🍰' },
              { key: 'drink', label: 'DRINK', icon: '🥤' }
            ].map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key as any)}
                className={`px-6 py-3 rounded-lg font-mono text-sm transition-all border ${
                  selectedCategory === cat.key
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-fuchsia-400 hover:text-fuchsia-400'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => {
                  const availableStock = getAvailableStock(item.id);
                  const isOutOfStock = availableStock <= 0;
                  const isLowStock = availableStock < 5 && availableStock > 0;

                  return (
                    <div 
                      key={item.id} 
                      className={`group bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border transition-all duration-300 ${
                        isOutOfStock 
                          ? 'border-slate-800 opacity-50' 
                          : 'border-cyan-500/30 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-24 h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden border border-slate-700 group-hover:border-cyan-500/50 transition-colors">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">{item.category === 'food' ? '🍰' : '🥤'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg truncate font-mono mb-1 group-hover:text-cyan-400 transition-colors">{item.name}</h3>
                          <p className="text-slate-400 text-sm line-clamp-2 mb-3 font-mono text-xs">{item.description}</p>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-fuchsia-400 font-bold font-mono">Rp {item.price?.toLocaleString()}</span>
                            <span className={`text-xs px-2 py-1 rounded border font-mono ${
                              isOutOfStock 
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
                                : isLowStock 
                                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' 
                                  : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            }`}>
                              {isOutOfStock ? 'STOK: 0' : `STOK: ${availableStock}`}
                            </span>
                          </div>
                          <button
                            onClick={() => !isOutOfStock && addToCart(item)}
                            disabled={isOutOfStock}
                            className={`w-full py-2 rounded-lg font-mono text-sm transition-all border ${
                              isOutOfStock
                                ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                                : 'bg-cyan-500/10 border-cyan-400/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400'
                            }`}
                          >
                            {isOutOfStock ? 'OFFLINE' : '+ ADD_TO_CART'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-slate-900/80 backdrop-blur-md rounded-xl p-6 border border-fuchsia-500/30 shadow-lg shadow-fuchsia-500/10">
                <h2 className="text-white font-bold text-xl mb-4 flex items-center font-mono">
                  <span className="mr-2">🛒</span>
                  <span>CART_SYSTEM</span>
                  {cart.length > 0 && (
                    <span className="ml-auto bg-cyan-400 text-slate-950 text-xs px-2 py-1 rounded font-mono font-bold">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)}
                    </span>
                  )}
                </h2>

                {cart.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-lg">
                    <p className="text-slate-500 font-mono text-sm">CART_EMPTY</p>
                    <p className="text-slate-600 text-xs mt-1">Waiting for input...</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {cart.map((item) => (
                      <div key={item.menuId} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-white font-medium text-sm font-mono truncate pr-2">{item.name}</span>
                          <button 
                            onClick={() => updateQuantity(item.menuId, 0)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-mono"
                          >
                            [X]
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => updateQuantity(item.menuId, item.quantity - 1)}
                              className="w-6 h-6 bg-slate-700 rounded text-cyan-400 hover:bg-slate-600 flex items-center justify-center font-mono text-sm border border-slate-600"
                            >
                              -
                            </button>
                            <span className="text-white w-8 text-center font-mono text-sm">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.menuId, item.quantity + 1)}
                              className="w-6 h-6 bg-slate-700 rounded text-cyan-400 hover:bg-slate-600 flex items-center justify-center font-mono text-sm border border-slate-600"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-fuchsia-400 text-sm font-mono">
                            Rp {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <>
                    <div className="border-t border-slate-700 pt-4 mb-4">
                      <div className="flex justify-between items-center text-white mb-1">
                        <span className="font-mono text-sm text-slate-400">SUBTOTAL</span>
                        <span className="text-lg font-bold text-fuchsia-400 font-mono">
                          Rp {calculateTotal().toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                        <span>TAX_INCLUDED</span>
                        <span>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleCheckout}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-slate-950 rounded-lg font-bold font-mono transition-all shadow-lg shadow-cyan-500/25"
                    >
                      PROCEED_TO_CHECKOUT →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }
      `}</style>
    </main>
  );
}