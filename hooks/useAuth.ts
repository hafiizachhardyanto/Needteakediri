'use client';

import { useState, useEffect } from 'react';
import { auth, db, logoutUser } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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

  const logout = async () => {
    const result = await logoutUser();
    if (result.success) {
      setUser(null);
      setUserData(null);
    }
    return result;
  };

  const isAdmin = userData?.role === 'admin';
  const isUser = userData?.role === 'user';

  return { user, userData, loading, isAdmin, isUser, logout };
}