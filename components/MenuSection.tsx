'use client';

import React from 'react';
import MenuCard from './MenuCard';

interface MenuItem {
  name: string;
  price: number;
  emoji: string;
  color: string;
}

interface MenuSectionProps {
  title: string;
  items: MenuItem[];
  delay?: number;
}

export default function MenuSection({ title, items, delay = 0 }: MenuSectionProps) {
  return (
    <div className="mb-12 animate-fade-in-up" style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center mb-6">
        <div className="h-1 w-8 bg-yellow-400 rounded-full mr-3" />
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        <div className="h-1 flex-1 bg-white/20 rounded-full ml-4" />
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item, index) => (
          <MenuCard key={item.name} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}