'use client';

import { Suspense } from 'react';
import DaftarContent from './DaftarContent';

function DaftarLoading() {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700" />
      <div className="relative z-10 text-white text-center">
        <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Memuat...</p>
      </div>
    </main>
  );
}

export default function DaftarPage() {
  return (
    <Suspense fallback={<DaftarLoading />}>
      <DaftarContent />
    </Suspense>
  );
}