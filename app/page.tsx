'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FloatingLeaves from '@/components/FloatingLeaves';
import TeaLeaf from '@/components/TeaLeaf';
import useAuth from '@/hooks/useAuth';

export default function Home() {
  const router = useRouter();
  const { userData, isAdmin, loading } = useAuth();

  // Redirect otomatis ke admin jika sudah login sebagai admin
  useEffect(() => {
    if (!loading && isAdmin) {
      router.push('/admin');
    }
  }, [loading, isAdmin, router]);

  // Jika sedang loading atau adalah admin (akan di-redirect), tampilkan loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Jika admin, tidak perlu render halaman ini (sudah di-redirect)
  if (isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background Gradasi */}
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      
      {/* Pattern Overlay */}
      <div className="fixed inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"/>
      
      <FloatingLeaves />
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          
          {/* Left Content */}
          <div className="text-center md:text-left animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <span className="flex h-2 w-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-white text-sm font-medium">Fresh Diseduh Setiap Hari</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
              Sip the
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-200 to-emerald-100">Freshness</span>
            </h1>
            
            <p className="text-xl text-white/90 mb-8 max-w-lg mx-auto md:mx-0">
              Authentic tea blends crafted with passion. Experience nature's finest leaves in every cup.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/menu">
                <button className="px-8 py-4 bg-white text-tea-600 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all flex items-center justify-center space-x-2 group">
                  <span>Explore Menu</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </Link>
              
              <button className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                <span>Watch Story</span>
              </button>
            </div>
            
            {/* Login / Admin Button */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              {!userData ? (
                // Belum login - tampilkan tombol Login
                <Link href="/login">
                  <button className="px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-full font-semibold hover:bg-white/30 transition-all flex items-center space-x-2 group">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Masuk / Login</span>
                  </button>
                </Link>
              ) : (
                // Sudah login sebagai user (bukan admin, karena admin sudah di-redirect)
                <div className="flex items-center space-x-2 px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-full">
                  <span>👋</span>
                  <span>Halo, {userData.name}</span>
                </div>
              )}
            </div>
            
            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-8">
              {[
                { value: '50+', label: 'Tea Varieties' },
                { value: '10k+', label: 'Happy Customers' },
                { value: '4.9', label: 'Rating' },
              ].map((stat) => (
                <div key={stat.label} className="text-center md:text-left">
                  <div className="text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right Content */}
          <div className="relative animate-slide-in-right">
            <div className="relative w-full aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl animate-pulse" />
              
              <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl transform hover:scale-105 transition-transform duration-500">
                <div className="text-center">
                  <div className="text-9xl mb-4 animate-bounce-slow">🍵</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Signature Matcha</h3>
                  <p className="text-white/80 mb-4">Premium Japanese green tea</p>
                  <div className="flex justify-center space-x-1">
                    {[1,2,3,4,5].map((star) => (
                      <svg key={star} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Floating Badge */}
              <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 rounded-full w-20 h-20 flex items-center justify-center font-bold animate-spin-slow shadow-lg">
                <div className="text-center text-xs">
                  <div className="text-lg">20%</div>
                  <div>OFF</div>
                </div>
              </div>
              
              <div className="absolute -bottom-6 -left-6">
                <TeaLeaf size="md" className="opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}