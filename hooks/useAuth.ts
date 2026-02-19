'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// ✅ Ubah ke default export
export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser?.email) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.email));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        // Cek localStorage
        const stored = localStorage.getItem('needtea_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          const userDoc = await getDoc(doc(db, 'users', parsed.email));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = userData?.role === 'admin';
  const isUser = userData?.role === 'user';

  return { user, userData, loading, isAdmin, isUser };
}