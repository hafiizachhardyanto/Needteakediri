import { Suspense } from 'react';
import DaftarContent from './DaftarContent';

export default function DaftarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tea-400 via-tea-500 to-tea-700">
        <div className="text-white text-center">
          <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <DaftarContent />
    </Suspense>
  );
}