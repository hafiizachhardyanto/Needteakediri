'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { logoutUser, subscribeToMenuItems, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

interface FeaturedItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  orderCount: number;
}

export default function Home() {
  const router = useRouter();
  const { userData, isAdmin, loading } = useAuth();
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!loading && isAdmin) {
      router.push('/admin');
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    loadFeaturedItems();
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || featuredItems.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredItems.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredItems.length]);

  const loadFeaturedItems = async () => {
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const itemCounts: { [key: string]: { count: number; item: any } } = {};
      
      ordersSnapshot.docs.forEach(doc => {
        const order = doc.data();
        order.items?.forEach((item: any) => {
          if (!itemCounts[item.menuId]) {
            itemCounts[item.menuId] = { count: 0, item };
          }
          itemCounts[item.menuId].count += item.quantity;
        });
      });

      const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([id, data]) => ({
          id,
          name: data.item.name,
          description: data.item.description || 'Premium cyber tea blend',
          price: data.item.price,
          image: data.item.image,
          category: data.item.category,
          orderCount: data.count
        }));

      if (sortedItems.length < 3) {
        const menuQuery = query(collection(db, 'menuItems'), orderBy('createdAt', 'desc'), limit(3));
        const menuSnapshot = await getDocs(menuQuery);
        const menuItems = menuSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          description: doc.data().description || 'Premium cyber tea blend',
          price: doc.data().price,
          image: doc.data().image,
          category: doc.data().category,
          orderCount: 0
        }));

        const existingIds = new Set(sortedItems.map(i => i.id));
        const additionalItems = menuItems.filter(item => !existingIds.has(item.id));
        setFeaturedItems([...sortedItems, ...additionalItems].slice(0, 3));
      } else {
        setFeaturedItems(sortedItems);
      }
    } catch (error) {
      console.error('Error loading featured items:', error);
      const menuQuery = query(collection(db, 'menuItems'), orderBy('createdAt', 'desc'), limit(3));
      const menuSnapshot = await getDocs(menuQuery);
      setFeaturedItems(menuSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        description: doc.data().description || 'Premium cyber tea blend',
        price: doc.data().price,
        image: doc.data().image,
        category: doc.data().category,
        orderCount: 0
      })));
    }
  };

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % featuredItems.length);
  }, [featuredItems.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + featuredItems.length) % featuredItems.length);
  }, [featuredItems.length]);

  const handleLogout = async () => {
    if (confirm('Logout dari sistem?')) {
      await logoutUser();
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-fuchsia-500/10" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4 shadow-lg shadow-cyan-500/50" />
          <p className="text-cyan-400 font-mono animate-pulse">INITIALIZING...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) return null;

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
            <Link href="/" className="text-cyan-400 font-mono text-sm border-b-2 border-cyan-400 pb-1">
              BERANDA
            </Link>
            <Link href="/menu" className="text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm">
              MENU
            </Link>
            <Link href="/cek-pesanan" className="text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm">
              CEK_PESANAN
            </Link>
          </div>
          
          <div>
            {userData ? (
              <div className="flex items-center space-x-3">
                <span className="text-emerald-400 font-mono text-sm">Halo, {userData.name}</span>
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
      
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          
          <div className="text-center md:text-left">
            <div className="inline-flex items-center space-x-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-400/30 rounded-full px-4 py-2 mb-6">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
              <span className="text-cyan-400 font-mono text-sm tracking-wider">SYSTEM_ONLINE</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="text-white">Sip the</span>
              <span className="block bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                Future
              </span>
            </h1>
            
            <p className="text-xl text-slate-400 mb-8 max-w-lg mx-auto md:mx-0 font-mono">
              Authentic tea blends in cyberpunk style. Experience the neon taste of nature.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/menu">
                <button className="group px-8 py-4 bg-cyan-500/20 border border-cyan-400 text-cyan-400 rounded-full font-bold text-lg hover:bg-cyan-500/30 transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center space-x-2">
                  <span>EXPLORE_MENU</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </Link>
              
              <button className="px-8 py-4 bg-transparent border-2 border-fuchsia-400 text-fuchsia-400 rounded-full font-bold text-lg hover:bg-fuchsia-500/10 transition-all flex items-center justify-center space-x-2">
                <span>▶</span>
                <span>WATCH_STORY</span>
              </button>
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              {!userData ? (
                <Link href="/login">
                  <button className="px-6 py-3 bg-fuchsia-500/20 border border-fuchsia-400 text-fuchsia-400 rounded-full font-mono text-sm hover:bg-fuchsia-500/30 transition-all">
                    MASUK / LOGIN
                  </button>
                </Link>
              ) : (
                <>
                  <div className="flex items-center space-x-2 px-6 py-3 bg-emerald-500/10 border border-emerald-400/30 rounded-full">
                    <span className="text-emerald-400">👋</span>
                    <span className="text-emerald-400 font-mono">{userData.name}</span>
                  </div>
                  
                  {isAdmin && (
                    <Link href="/admin">
                      <button className="px-6 py-3 bg-yellow-400/20 border border-yellow-400 text-yellow-400 rounded-full font-mono text-sm hover:bg-yellow-400/30 transition-all">
                        ADMIN_PANEL
                      </button>
                    </Link>
                  )}
                </>
              )}
            </div>
            
            <div className="mt-12 grid grid-cols-3 gap-8">
              {[
                { value: '50+', label: 'TEA_VAR', color: 'text-cyan-400' },
                { value: '10K+', label: 'USERS', color: 'text-fuchsia-400' },
                { value: '4.9', label: 'RATING', color: 'text-emerald-400' },
              ].map((stat) => (
                <div key={stat.label} className="text-center md:text-left">
                  <div className={`text-3xl font-black ${stat.color} drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500 font-mono">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 rounded-full blur-3xl animate-pulse" />
            
            <div 
              className="relative z-10 bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10"
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              {featuredItems.length > 0 ? (
                <div className="relative overflow-hidden">
                  <div 
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {featuredItems.map((item, index) => (
                      <div key={item.id} className="w-full flex-shrink-0">
                        <div className="text-center">
                          <div className="relative mb-6">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 rounded-2xl blur-xl animate-pulse" />
                            <div className="relative w-48 h-48 mx-auto bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl bg-slate-800">
                                  {item.category === 'food' ? '🍰' : '🥤'}
                                </div>
                              )}
                            </div>
                            {item.orderCount > 0 && (
                              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-950 rounded-full px-3 py-1 text-xs font-bold animate-bounce">
                                TOP {index + 1}
                              </div>
                            )}
                          </div>
                          
                          <h3 className="text-2xl font-bold text-white mb-2 font-mono">{item.name.toUpperCase()}</h3>
                          <p className="text-cyan-400 mb-2 font-mono text-sm">{item.category === 'food' ? 'CYBER_SNACK' : 'CYBER_TEA'}</p>
                          <p className="text-slate-400 text-sm mb-4 line-clamp-2 px-4">{item.description}</p>
                          
                          <div className="flex items-center justify-center space-x-4 mb-4">
                            <span className="text-2xl font-bold text-fuchsia-400 font-mono">
                              Rp {item.price.toLocaleString()}
                            </span>
                            {item.orderCount > 0 && (
                              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
                                {item.orderCount}x ordered
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-center space-x-1 mb-6">
                            {[1,2,3,4,5].map((star) => (
                              <svg key={star} className="w-5 h-5 text-yellow-400 fill-current drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>

                          <Link href="/menu">
                            <button className="w-full py-3 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-slate-950 rounded-xl font-bold transition-all">
                              ORDER_NOW
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-center space-x-2 mt-6">
                    {featuredItems.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          currentSlide === index 
                            ? 'w-8 bg-cyan-400' 
                            : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-slate-800/80 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    ←
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-slate-800/80 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    →
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 animate-bounce">🍵</div>
                  <h3 className="text-2xl font-bold text-white mb-2 font-mono">NEON_MATCHA</h3>
                  <p className="text-cyan-400 mb-4 font-mono text-sm">Premium Cyber Tea</p>
                  <div className="flex justify-center space-x-1">
                    {[1,2,3,4,5].map((star) => (
                      <svg key={star} className="w-5 h-5 text-yellow-400 fill-current drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="absolute -top-4 -right-4 bg-gradient-to-r from-cyan-400 to-fuchsia-400 text-slate-950 rounded-full w-20 h-20 flex items-center justify-center font-black animate-spin-slow shadow-lg shadow-cyan-500/50">
              <div className="text-center text-xs">
                <div className="text-lg">20%</div>
                <div>OFF</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}