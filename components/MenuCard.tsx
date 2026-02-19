'use client';

import React from 'react';

interface MenuItem {
  name: string;
  price: number;
  emoji: string;
  color: string;
}

interface MenuCardProps {
  item: MenuItem;
  index: number;
}

export default function MenuCard({ item, index }: MenuCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div 
      className="group bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 
                 hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-2 
                 cursor-pointer animate-fade-in-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${item.color} 
                      flex items-center justify-center text-2xl mb-3 
                      group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
        {item.emoji}
      </div>
      
      <h4 className="text-white font-semibold text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
        {item.name}
      </h4>
      
      <div className="flex justify-between items-center mt-3">
        <span className="text-lg font-bold text-white">
          {formatPrice(item.price)}
        </span>
        <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center 
                         hover:bg-white hover:text-tea-600 transition-all duration-300
                         group-hover:scale-110">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}