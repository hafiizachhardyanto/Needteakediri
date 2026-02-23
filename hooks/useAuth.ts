'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser?.email) {
        const userRef = doc(db, 'users', firebaseUser.email);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          
          await updateDoc(userRef, {
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
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

  const isAdmin = userData?.role === 'admin';
  const isUser = userData?.role === 'user';

  return { user, userData, loading, isAdmin, isUser };
}