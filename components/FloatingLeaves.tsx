'use client';

import React from 'react';

export default function FloatingLeaves() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Daun 1 */}
      <div className="absolute top-20 left-10 text-4xl animate-float opacity-30">
        🍃
      </div>
      {/* Daun 2 */}
      <div className="absolute top-40 right-20 text-3xl animate-float-delayed opacity-20">
        🌿
      </div>
      {/* Daun 3 */}
      <div className="absolute bottom-32 left-1/4 text-5xl animate-sway opacity-25">
        🍂
      </div>
      {/* Daun 4 */}
      <div className="absolute top-1/3 right-1/3 text-2xl animate-float opacity-20">
        🌱
      </div>
      {/* Daun 5 */}
      <div className="absolute bottom-20 right-10 text-4xl animate-float-delayed opacity-30">
        🍃
      </div>
    </div>
  );
}