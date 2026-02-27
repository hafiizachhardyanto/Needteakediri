'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { logoutUser, subscribeToMenuItems } from '@/lib/firebase';

interface FeaturedItem {
  id: string;
  name: string;
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!loading && isAdmin) {
      router.push('/admin');
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    const unsubscribe = subscribeToMenuItems((items) => {
      const sortedItems = [...items]
        .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
        .slice(0, 3)
        .map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          category: item.category,
          orderCount: item.orderCount || 0
        }));
      setFeaturedItems(sortedItems);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (featuredItems.length > 1) {
      const interval = setInterval(() => {
        handleNextSlide();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [featuredItems, currentSlide]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current && window.innerWidth > 768) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleNextSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentSlide((prev) => (prev + 1) % featuredItems.length);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const handlePrevSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentSlide((prev) => (prev - 1 + featuredItems.length) % featuredItems.length);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const handleLogout = async () => {
    if (confirm('Logout dari sistem?')) {
      await logoutUser();
      window.location.reload();
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.05),transparent_50%)]" />
        <div className="relative z-10 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm sm:text-base">Memuat...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) return null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0];
  };

  return (
    <main ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden transition-colors duration-300">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] rounded-full opacity-30 transition-all duration-1000 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)',
            left: `${mousePos.x * 20}%`,
            top: `${mousePos.y * 20}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] rounded-full opacity-20 transition-all duration-1000 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(232,121,249,0.3) 0%, transparent 70%)',
            right: `${(1 - mousePos.x) * 20}%`,
            bottom: `${(1 - mousePos.y) * 20}%`,
            transform: 'translate(50%, 50%)'
          }}
        />
        
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.1)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:40px_40px] sm:bg-[size:60px_60px]" />
        
        <div className="absolute top-10 left-5 sm:top-20 sm:left-10 w-20 h-20 sm:w-32 sm:h-32 bg-cyan-200/20 dark:bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-20 right-10 sm:bottom-40 sm:right-20 w-32 h-32 sm:w-48 sm:h-48 bg-fuchsia-200/20 dark:bg-fuchsia-500/10 rounded-full blur-xl animate-pulse delay-1000" />
        <div className="absolute top-1/3 left-1/4 w-16 h-16 sm:w-24 sm:h-24 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-xl animate-pulse delay-500" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-cyan-500/20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group">
            <div className="relative">
              <span className="text-2xl sm:text-3xl transform group-hover:scale-110 transition-transform duration-300 inline-block">🍵</span>
              <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 dark:from-cyan-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
              NeedTea
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-cyan-600 dark:text-cyan-400 font-medium text-sm relative group">
              BERANDA
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-600 dark:bg-cyan-400 transform scale-x-100 transition-transform" />
            </Link>
            <Link href="/menu" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium text-sm relative group">
              MENU
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-600 dark:bg-cyan-400 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
            </Link>
            <Link href="/cek-pesanan" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium text-sm relative group">
              CEK PESANAN
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-600 dark:bg-cyan-400 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
            </Link>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <div className="hidden md:block">
              {userData ? (
                <div className="flex items-center space-x-3">
                  <span className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                    {getGreeting()}, <span className="text-cyan-600 dark:text-cyan-400">{getFirstName(userData.name || userData.email.split('@')[0])}</span>
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-400 text-rose-600 dark:text-rose-400 rounded-full font-medium text-xs sm:text-sm hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-all"
                  >
                    LOGOUT
                  </button>
                </div>
              ) : (
                <Link href="/login">
                  <button className="px-4 sm:px-6 py-2 bg-cyan-500 text-white rounded-full font-medium text-sm hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5">
                    LOGIN
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className={`md:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-cyan-500/20 transition-all duration-300 ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <div className="px-4 py-4 space-y-3">
            <Link href="/" className="block text-cyan-600 dark:text-cyan-400 font-medium text-sm py-2" onClick={() => setIsMobileMenuOpen(false)}>
              BERANDA
            </Link>
            <Link href="/menu" className="block text-slate-600 dark:text-slate-400 font-medium text-sm py-2" onClick={() => setIsMobileMenuOpen(false)}>
              MENU
            </Link>
            <Link href="/cek-pesanan" className="block text-slate-600 dark:text-slate-400 font-medium text-sm py-2" onClick={() => setIsMobileMenuOpen(false)}>
              CEK PESANAN
            </Link>
            {userData ? (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  {getGreeting()}, <span className="text-cyan-600 dark:text-cyan-400">{getFirstName(userData.name || userData.email.split('@')[0])}</span>
                </p>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-2 bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-400 text-rose-600 dark:text-rose-400 rounded-full font-medium text-sm"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <Link href="/login" className="block pt-3 border-t border-slate-200 dark:border-slate-800" onClick={() => setIsMobileMenuOpen(false)}>
                <button className="w-full px-4 py-2 bg-cyan-500 text-white rounded-full font-medium text-sm">
                  LOGIN
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          <div className="text-center lg:text-left space-y-6 sm:space-y-8 order-2 lg:order-1">
            <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm border border-cyan-200 dark:border-cyan-400/30 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg shadow-cyan-500/10">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-cyan-700 dark:text-cyan-400 font-medium text-xs sm:text-sm tracking-wide">SYSTEM ONLINE</span>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="text-slate-800 dark:text-white block">Sip the</span>
                <span className="block bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-emerald-500 bg-clip-text text-transparent animate-gradient-x">
                  Future
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-lg mx-auto lg:mx-0 leading-relaxed px-4 sm:px-0">
                Authentic tea blends in modern style. Experience the perfect taste of nature with every sip.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start px-4 sm:px-0">
              <Link href="/menu" className="w-full sm:w-auto">
                <button className="w-full group px-6 sm:px-8 py-3 sm:py-4 bg-cyan-500 text-white rounded-full font-semibold text-base sm:text-lg hover:bg-cyan-600 transition-all shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-1 flex items-center justify-center space-x-2">
                  <span>EXPLORE MENU</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </Link>
              
              <button className="w-full sm:w-auto group px-6 sm:px-8 py-3 sm:py-4 bg-white dark:bg-slate-800 border-2 border-fuchsia-400 text-fuchsia-600 dark:text-fuchsia-400 rounded-full font-semibold text-base sm:text-lg hover:bg-fuchsia-50 dark:hover:bg-fuchsia-500/10 transition-all hover:shadow-lg hover:shadow-fuchsia-500/20 hover:-translate-y-1 flex items-center justify-center space-x-2">
                <span className="group-hover:scale-110 transition-transform">▶</span>
                <span>WATCH STORY</span>
              </button>
            </div>

            {!userData && (
              <div className="flex justify-center lg:justify-start px-4 sm:px-0">
                <Link href="/login">
                  <button className="px-5 sm:px-6 py-2.5 sm:py-3 bg-fuchsia-100 dark:bg-fuchsia-500/20 border border-fuchsia-300 dark:border-fuchsia-400 text-fuchsia-700 dark:text-fuchsia-400 rounded-full font-medium text-sm hover:bg-fuchsia-200 dark:hover:bg-fuchsia-500/30 transition-all">
                    Masuk / Login
                  </button>
                </Link>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-6 sm:pt-8 border-t border-slate-200 dark:border-slate-800">
              {[
                { value: '50+', label: 'Varian Teh', color: 'text-cyan-600 dark:text-cyan-400' },
                { value: '10K+', label: 'Pelanggan', color: 'text-fuchsia-600 dark:text-fuchsia-400' },
                { value: '4.9', label: 'Rating', color: 'text-emerald-600 dark:text-emerald-400' },
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 font-medium mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative perspective-1000 order-1 lg:order-2 mb-8 lg:mb-0">
            <div className="absolute -top-6 -right-6 sm:-top-10 sm:-right-10 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-br from-cyan-200 to-fuchsia-200 dark:from-cyan-500/20 dark:to-fuchsia-500/20 rounded-full blur-3xl opacity-50 animate-pulse" />
            <div className="absolute -bottom-6 -left-6 sm:-bottom-10 sm:-left-10 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-br from-emerald-200 to-cyan-200 dark:from-emerald-500/20 dark:to-cyan-500/20 rounded-full blur-3xl opacity-50 animate-pulse delay-500" />
            
            <div className="relative bg-white/60 dark:bg-slate-900/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/50 dark:border-cyan-500/30 shadow-2xl shadow-slate-500/20 dark:shadow-cyan-500/10">
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-cyan-400 to-fuchsia-400 rounded-xl sm:rounded-2xl rotate-12 opacity-80 blur-sm animate-float hidden sm:block" />
              <div className="absolute -bottom-2 -left-2 sm:-bottom-4 sm:-left-4 w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full opacity-80 blur-sm animate-float-delayed hidden sm:block" />
              
              {featuredItems.length > 0 ? (
                <div className="relative h-64 sm:h-80 lg:h-96">
                  {featuredItems.map((item, index) => {
                    const offset = index - currentSlide;
                    const isActive = index === currentSlide;
                    
                    return (
                      <div
                        key={item.id}
                        className={`absolute inset-0 transition-all duration-700 ease-out ${
                          isActive 
                            ? 'opacity-100 z-20' 
                            : 'opacity-0 z-10 pointer-events-none'
                        }`}
                        style={{
                          transform: `
                            translateX(${offset * 20}px) 
                            translateZ(${isActive ? 0 : -100}px) 
                            rotateY(${offset * 15}deg)
                            scale(${isActive ? 1 : 0.8})
                          `,
                          transformStyle: 'preserve-3d'
                        }}
                      >
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
                          <div className="relative w-36 h-36 sm:w-48 sm:h-48 lg:w-56 lg:h-56 group">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-fuchsia-400 rounded-2xl sm:rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-opacity" />
                            
                            <div className="relative w-full h-full bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-cyan-500/30 transform group-hover:scale-105 transition-transform duration-500">
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-6xl sm:text-8xl">
                                  {item.category === 'food' ? '🍰' : '🥤'}
                                </div>
                              )}
                              
                              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-lg">
                                TOP {index + 1}
                              </div>
                            </div>
                            
                            <div className="absolute -top-1 -left-1 sm:-top-2 sm:-left-2 w-6 h-6 sm:w-8 sm:h-8 bg-cyan-400 rounded-full opacity-60 animate-bounce" />
                            <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-4 h-4 sm:w-6 sm:h-6 bg-fuchsia-400 rounded-full opacity-60 animate-bounce delay-300" />
                          </div>

                          <div className="space-y-1 sm:space-y-2">
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{item.name}</h3>
                            <p className="text-cyan-600 dark:text-cyan-400 font-semibold text-base sm:text-lg">Rp {item.price?.toLocaleString()}</p>
                            <p className="text-slate-500 dark:text-slate-500 text-xs sm:text-sm">{item.orderCount} orders</p>
                            
                            <div className="flex justify-center space-x-0.5 sm:space-x-1 pt-1 sm:pt-2">
                              {[1,2,3,4,5].map((star) => (
                                <svg key={star} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {featuredItems.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevSlide}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-4 w-8 h-8 sm:w-12 sm:h-12 bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 border border-slate-200 dark:border-cyan-500/30 rounded-full flex items-center justify-center text-slate-600 dark:text-cyan-400 hover:text-cyan-600 transition-all shadow-lg hover:shadow-xl z-30"
                      >
                        <span className="text-sm sm:text-base">←</span>
                      </button>
                      <button
                        onClick={handleNextSlide}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-4 w-8 h-8 sm:w-12 sm:h-12 bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 border border-slate-200 dark:border-cyan-500/30 rounded-full flex items-center justify-center text-slate-600 dark:text-cyan-400 hover:text-cyan-600 transition-all shadow-lg hover:shadow-xl z-30"
                      >
                        <span className="text-sm sm:text-base">→</span>
                      </button>
                    </>
                  )}

                  <div className="absolute -bottom-6 sm:-bottom-8 left-0 right-0 flex justify-center space-x-2 sm:space-x-3">
                    {featuredItems.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (!isAnimating) {
                            setIsAnimating(true);
                            setCurrentSlide(index);
                            setTimeout(() => setIsAnimating(false), 800);
                          }
                        }}
                        className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                          index === currentSlide 
                            ? 'bg-cyan-500 w-6 sm:w-8' 
                            : 'bg-slate-300 dark:bg-slate-600 w-1.5 sm:w-2 hover:bg-slate-400 dark:hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center h-64 sm:h-80 lg:h-96 flex flex-col justify-center space-y-4 sm:space-y-6">
                  <div className="relative w-32 h-32 sm:w-48 sm:h-48 mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-fuchsia-400 rounded-full blur-2xl opacity-30 animate-pulse" />
                    <div className="relative w-full h-full bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex items-center justify-center text-7xl sm:text-9xl animate-bounce">
                      🍵
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-1 sm:mb-2">NEON MATCHA</h3>
                    <p className="text-cyan-600 dark:text-cyan-400 font-medium text-sm sm:text-base">Premium Cyber Tea</p>
                  </div>
                  <div className="flex justify-center space-x-0.5 sm:space-x-1">
                    {[1,2,3,4,5].map((star) => (
                      <svg key={star} className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-xl sm:rounded-2xl w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center font-bold shadow-xl animate-spin-slow hover:scale-110 transition-transform cursor-pointer">
              <div className="text-center">
                <div className="text-sm sm:text-xl">20%</div>
                <div className="text-[8px] sm:text-xs">OFF</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(12deg); }
          50% { transform: translateY(-20px) rotate(12deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite;
          animation-delay: 1s;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </main>
  );
}