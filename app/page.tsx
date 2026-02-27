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
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (containerRef.current) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.1),transparent_50%)]" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Memuat...</p>
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
    <main ref={containerRef} className="min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-30 transition-all duration-1000 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)',
            left: `${mousePos.x * 20}%`,
            top: `${mousePos.y * 20}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 transition-all duration-1000 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(232,121,249,0.3) 0%, transparent 70%)',
            right: `${(1 - mousePos.x) * 20}%`,
            bottom: `${(1 - mousePos.y) * 20}%`,
            transform: 'translate(50%, 50%)'
          }}
        />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.1)_1px,transparent_1px)] bg-[size:60px_60px]" />
        
        {/* Floating Shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-cyan-200/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-40 right-20 w-48 h-48 bg-fuchsia-200/20 rounded-full blur-xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-emerald-200/20 rounded-full blur-xl animate-pulse delay-500" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <span className="text-3xl transform group-hover:scale-110 transition-transform duration-300 inline-block">🍵</span>
              <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 bg-clip-text text-transparent">
              NeedTea
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-cyan-600 font-medium text-sm relative group">
              BERANDA
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-600 transform scale-x-100 transition-transform" />
            </Link>
            <Link href="/menu" className="text-slate-600 hover:text-cyan-600 transition-colors font-medium text-sm relative group">
              MENU
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-600 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
            </Link>
            <Link href="/cek-pesanan" className="text-slate-600 hover:text-cyan-600 transition-colors font-medium text-sm relative group">
              CEK PESANAN
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-cyan-600 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
            </Link>
          </div>
          
          <div>
            {userData ? (
              <div className="flex items-center space-x-4">
                <span className="text-slate-600 font-medium text-sm hidden sm:block">
                  {getGreeting()}, <span className="text-cyan-600">{getFirstName(userData.name || userData.email.split('@')[0])}</span>
                </span>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-full font-medium text-sm hover:bg-rose-100 transition-all hover:shadow-lg hover:shadow-rose-200/50"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <Link href="/login">
                <button className="px-6 py-2 bg-cyan-500 text-white rounded-full font-medium text-sm hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5">
                  LOGIN
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <div className="text-center lg:text-left space-y-8">
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm border border-cyan-200 rounded-full px-4 py-2 shadow-lg shadow-cyan-500/10">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-cyan-700 font-medium text-sm tracking-wide">SYSTEM ONLINE</span>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                <span className="text-slate-800 block">Sip the</span>
                <span className="block bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-emerald-500 bg-clip-text text-transparent animate-gradient-x">
                  Future
                </span>
              </h1>
              <p className="text-lg text-slate-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Authentic tea blends in modern style. Experience the perfect taste of nature with every sip.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/menu">
                <button className="group px-8 py-4 bg-cyan-500 text-white rounded-full font-semibold text-lg hover:bg-cyan-600 transition-all shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-1 flex items-center justify-center space-x-2">
                  <span>EXPLORE MENU</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </Link>
              
              <button className="group px-8 py-4 bg-white border-2 border-fuchsia-400 text-fuchsia-600 rounded-full font-semibold text-lg hover:bg-fuchsia-50 transition-all hover:shadow-lg hover:shadow-fuchsia-500/20 hover:-translate-y-1 flex items-center justify-center space-x-2">
                <span className="group-hover:scale-110 transition-transform">▶</span>
                <span>WATCH STORY</span>
              </button>
            </div>

            {/* User Status */}
            {!userData && (
              <div className="flex justify-center lg:justify-start">
                <Link href="/login">
                  <button className="px-6 py-3 bg-fuchsia-100 border border-fuchsia-300 text-fuchsia-700 rounded-full font-medium text-sm hover:bg-fuchsia-200 transition-all">
                    Masuk / Login
                  </button>
                </Link>
              </div>
            )}
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-200">
              {[
                { value: '50+', label: 'Varian Teh', color: 'text-cyan-600' },
                { value: '10K+', label: 'Pelanggan', color: 'text-fuchsia-600' },
                { value: '4.9', label: 'Rating', color: 'text-emerald-600' },
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <div className={`text-3xl lg:text-4xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500 font-medium mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - 3D Card Slider */}
          <div className="relative perspective-1000">
            {/* Decorative Elements */}
            <div className="absolute -top-10 -right-10 w-72 h-72 bg-gradient-to-br from-cyan-200 to-fuchsia-200 rounded-full blur-3xl opacity-50 animate-pulse" />
            <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-gradient-to-br from-emerald-200 to-cyan-200 rounded-full blur-3xl opacity-50 animate-pulse delay-500" />
            
            {/* Main Card Container */}
            <div className="relative bg-white/60 backdrop-blur-2xl rounded-3xl p-8 border border-white/50 shadow-2xl shadow-slate-500/20">
              {/* 3D Rotating Object Simulation */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-cyan-400 to-fuchsia-400 rounded-2xl rotate-12 opacity-80 blur-sm animate-float" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full opacity-80 blur-sm animate-float-delayed" />
              
              {featuredItems.length > 0 ? (
                <div className="relative h-96">
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
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                          {/* Image Container with 3D Effect */}
                          <div className="relative w-56 h-56 group">
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-fuchsia-400 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-opacity" />
                            
                            {/* Image */}
                            <div className="relative w-full h-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 transform group-hover:scale-105 transition-transform duration-500">
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-8xl">
                                  {item.category === 'food' ? '🍰' : '🥤'}
                                </div>
                              )}
                              
                              {/* Badge */}
                              <div className="absolute top-4 right-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                                TOP {index + 1}
                              </div>
                            </div>
                            
                            {/* Floating Elements */}
                            <div className="absolute -top-2 -left-2 w-8 h-8 bg-cyan-400 rounded-full opacity-60 animate-bounce" />
                            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-fuchsia-400 rounded-full opacity-60 animate-bounce delay-300" />
                          </div>

                          {/* Content */}
                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-slate-800">{item.name}</h3>
                            <p className="text-cyan-600 font-semibold text-lg">Rp {item.price?.toLocaleString()}</p>
                            <p className="text-slate-500 text-sm">{item.orderCount} orders</p>
                            
                            {/* Rating */}
                            <div className="flex justify-center space-x-1 pt-2">
                              {[1,2,3,4,5].map((star) => (
                                <svg key={star} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Navigation Arrows */}
                  {featuredItems.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevSlide}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white hover:bg-cyan-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-cyan-600 transition-all shadow-lg hover:shadow-xl hover:-translate-x-5 z-30"
                      >
                        ←
                      </button>
                      <button
                        onClick={handleNextSlide}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white hover:bg-cyan-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-cyan-600 transition-all shadow-lg hover:shadow-xl hover:translate-x-5 z-30"
                      >
                        →
                      </button>
                    </>
                  )}

                  {/* Dots Indicator */}
                  <div className="absolute -bottom-8 left-0 right-0 flex justify-center space-x-3">
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
                        className={`h-2 rounded-full transition-all duration-300 ${
                          index === currentSlide 
                            ? 'bg-cyan-500 w-8' 
                            : 'bg-slate-300 w-2 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center h-96 flex flex-col justify-center space-y-6">
                  <div className="relative w-48 h-48 mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-fuchsia-400 rounded-full blur-2xl opacity-30 animate-pulse" />
                    <div className="relative w-full h-full bg-white rounded-3xl shadow-2xl flex items-center justify-center text-9xl animate-bounce">
                      🍵
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">NEON MATCHA</h3>
                    <p className="text-cyan-600 font-medium">Premium Cyber Tea</p>
                  </div>
                  <div className="flex justify-center space-x-1">
                    {[1,2,3,4,5].map((star) => (
                      <svg key={star} className="w-6 h-6 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Discount Badge */}
            <div className="absolute -top-4 -right-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-2xl w-20 h-20 flex items-center justify-center font-bold shadow-xl animate-spin-slow hover:scale-110 transition-transform cursor-pointer">
              <div className="text-center">
                <div className="text-xl">20%</div>
                <div className="text-xs">OFF</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CSS for custom animations */}
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