'use client';

import React from 'react';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';

export default function Navbar() {
  const { userData, isAdmin, isUser } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-lg border-b border-white/20">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <span className="text-3xl group-hover:animate-bounce">🍵</span>
          <span className="text-2xl font-bold text-white">NeedTea</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/" className="text-white/80 hover:text-white transition-colors">
            Beranda
          </Link>
          <Link href="/menu" className="text-white/80 hover:text-white transition-colors">
            Menu
          </Link>
          <Link href="/order-status" className="text-white/80 hover:text-white transition-colors">
            Cek Pesanan
          </Link>
        </div>

        {/* User Actions */}
        <div className="flex items-center space-x-4">
          {userData ? (
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Link href="/admin">
                  <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-all">
                    Admin
                  </button>
                </Link>
              )}
              {isUser && (
                <Link href="/profile">
                  <button className="px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-all flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{userData.name || 'Profile'}</span>
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link href="/login">
                <button className="px-4 py-2 text-white/80 hover:text-white transition-colors">
                  Masuk
                </button>
              </Link>
              <Link href="/daftar">
                <button className="px-4 py-2 bg-white text-tea-600 rounded-lg font-medium hover:bg-yellow-50 transition-all">
                  Daftar
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}