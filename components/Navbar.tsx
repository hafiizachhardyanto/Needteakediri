'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useAuth from '@/hooks/useAuth';

export default function Navbar() {
  const { userData, isAdmin } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'BERANDA', icon: '🏠' },
    { href: '/menu', label: 'MENU', icon: '📋' },
    { href: '/cek-pesanan', label: 'CEK_PESANAN', icon: '📦' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-cyan-500/30">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-fuchsia-500/5" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
      
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center relative">
        <Link href="/" className="flex items-center space-x-3 group">
          <span className="text-3xl group-hover:scale-110 transition-transform filter drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
            🍵
          </span>
          <span className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
            NeedTea
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`relative px-4 py-2 rounded-lg font-mono text-sm tracking-wider transition-all ${
                  isActive
                    ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-400/50'
                    : 'text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/5'
                }`}
              >
                <span className="mr-2 opacity-50">{item.icon}</span>
                {item.label}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center space-x-4">
          {userData ? (
            <div className="flex items-center space-x-3">
              {isAdmin && (
                <Link href="/admin">
                  <button className="px-4 py-2 bg-fuchsia-500/20 border border-fuchsia-400 text-fuchsia-400 rounded-lg font-mono text-sm hover:bg-fuchsia-500/30 transition-all shadow-lg shadow-fuchsia-500/20">
                    👑 ADMIN
                  </button>
                </Link>
              )}
              <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 border border-emerald-400/30 rounded-lg">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50" />
                <span className="text-emerald-400 font-mono text-sm">{userData.name}</span>
              </div>
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
  );
}