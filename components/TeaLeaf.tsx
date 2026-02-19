'use client';

import React from 'react';

interface TeaLeafProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
}

export default function TeaLeaf({ className = '', size = 'md', delay = 0 }: TeaLeafProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      style={{ animationDelay: `${delay}s` }}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M50 95C50 95 20 80 15 50C10 20 35 5 50 5C65 5 90 20 85 50C80 80 50 95 50 95Z"
        fill="url(#teaGradient)"
        className="opacity-90"
      />
      <path d="M50 15V85" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 35L30 25M50 50L25 40M50 65L30 55" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M50 35L70 25M50 50L75 40M50 65L70 55" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="teaGradient" x1="50" y1="5" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop stopColor="#86efac" />
          <stop offset="0.5" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
    </svg>
  );
}