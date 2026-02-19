import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp, 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp
} from "firebase/firestore";
import { 
  getAuth, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCGQgTom3RvQoURS6esMbh2lOm0FjXClF0",
  authDomain: "needtea-32554.firebaseapp.com",
  databaseURL: "https://needtea-32554-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "needtea-32554",
  storageBucket: "needtea-32554.firebasestorage.app",
  messagingSenderId: "306781281475",
  appId: "1:306781281475:web:3e21dd82fc1f050323d676"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);

// ⭐ DYNAMIC DOMAIN - Support localhost & production
const getActionCodeSettings = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production - Vercel domain Anda
    if (hostname === 'needteakediri.vercel.app') {
      return {
        url: 'https://needteakediri.vercel.app/verifikasi',
        handleCodeInApp: true,
      };
    }
    
    // Fallback untuk domain lain (termasuk vercel.app lain)
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      return {
        url: `${window.location.origin}/verifikasi`,
        handleCodeInApp: true,
      };
    }
  }
  
  // Local development
  return {
    url: 'http://localhost:3000/verifikasi',
    handleCodeInApp: true,
  };
};

// ==================== AUTH FUNCTIONS ====================

export async function sendEmailLink(email: string) {
  try {
    const actionCodeSettings = getActionCodeSettings();
    console.log('📧 Sending to:', email);
    console.log('🔗 Callback URL:', actionCodeSettings.url);
    
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message, code: error.code };
  }
}

export function checkSignInLink(url: string) {
  return isSignInWithEmailLink(auth, url);
}

export async function completeSignInWithLink(email: string, url: string) {
  try {
    const result = await signInWithEmailLink(auth, email, url);
    const user = result.user;
    const userCheck = await checkUserExists(email);
    const isNewUser = !userCheck.exists;
    
    return { 
      success: true, 
      user,
      isNewUser,
      email: user.email,
      uid: user.uid
    };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
}

export async function saveUserToFirestore(
  email: string, 
  name: string = '', 
  uid: string = '', 
  isNewUser: boolean = true, 
  role: string = 'user'
) {
  try {
    const userRef = doc(db, 'users', email);
    const baseData = {
      uid: uid,
      email: email,
      name: name || email.split('@')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      isActive: true,
      role: role,
      emailVerified: true,
      authProvider: 'emailLink',
      profile: { avatar: '', address: '', phone: '' }
    };
    
    const userData = role === 'user' 
      ? { ...baseData, stats: { totalOrders: 0, totalSpent: 0 } }
      : baseData;
    
    if (isNewUser) {
      await setDoc(userRef, userData);
      console.log('✅ New user:', email, '| Role:', role);
    } else {
      await updateDoc(userRef, { 
        lastLogin: serverTimestamp(), 
        updatedAt: serverTimestamp() 
      });
    }
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
}

export async function checkUserExists(email: string) {
  try {
    const userRef = doc(db, 'users', email);
    const userSnap = await getDoc(userRef);
    return { exists: userSnap.exists(), data: userSnap.data() };
  } catch (error: any) {
    return { exists: false, error: error.message };
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    localStorage.removeItem('emailForSignIn');
    localStorage.removeItem('needtea_user');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// ==================== MENU FUNCTIONS ====================

export async function addMenuItem(menuData: any) {
  try {
    const docRef = await addDoc(collection(db, 'menu'), {
      ...menuData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isAvailable: true
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMenuItems(category?: string) {
  try {
    let q = query(collection(db, 'menu'), where('isAvailable', '==', true));
    if (category) {
      q = query(q, where('category', '==', category));
    }
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, items: items || [] };
  } catch (error: any) {
    return { success: false, error: error.message, items: [] };
  }
}

export async function updateMenuItem(id: string, data: any) {
  try {
    await updateDoc(doc(db, 'menu', id), { 
      ...data, 
      updatedAt: serverTimestamp() 
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteMenuItem(id: string) {
  try {
    await deleteDoc(doc(db, 'menu', id));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== ORDER FUNCTIONS ====================

export async function createOrder(orderData: any) {
  try {
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000);
    
    const docRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiryTime: Timestamp.fromDate(expiryTime),
      completedAt: null
    });
    return { success: true, id: docRef.id, expiryTime };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOrders(status?: string) {
  try {
    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    if (status) {
      q = query(q, where('status', '==', status));
    }
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, orders: orders || [] };
  } catch (error: any) {
    return { success: false, error: error.message, orders: [] };
  }
}

export async function getUserOrders(userEmail: string) {
  try {
    const q = query(
      collection(db, 'orders'), 
      where('userEmail', '==', userEmail),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, orders: orders || [] };
  } catch (error: any) {
    return { success: false, error: error.message, orders: [] };
  }
}

export async function completeOrder(orderId: string) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      return { success: false, error: 'Order not found' };
    }
    
    const orderData = orderSnap.data();
    
    await addDoc(collection(db, 'orderHistory'), {
      ...orderData,
      orderId: orderId,
      status: 'completed',
      completedAt: serverTimestamp(),
      archivedAt: serverTimestamp()
    });
    
    await updateDoc(orderRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    if (orderData.userEmail) {
      const userRef = doc(db, 'users', orderData.userEmail);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        await updateDoc(userRef, {
          'stats.totalOrders': (userData.stats?.totalOrders || 0) + 1,
          'stats.totalSpent': (userData.stats?.totalSpent || 0) + (orderData.totalAmount || 0),
          updatedAt: serverTimestamp()
        });
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateOrderStatus(orderId: string, status: string) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
      completedAt: status === 'completed' ? serverTimestamp() : null
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function cancelExpiredOrders() {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      where('expiryTime', '<', now)
    );
    
    const snapshot = await getDocs(q);
    const batch = [];
    
    for (const docSnap of snapshot.docs) {
      batch.push(updateDoc(doc(db, 'orders', docSnap.id), {
        status: 'cancelled',
        cancelReason: 'Payment timeout (30 minutes)',
        updatedAt: serverTimestamp()
      }));
    }
    
    await Promise.all(batch);
    return { success: true, count: snapshot.docs.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getDailyStats(date?: string) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    const q = query(
      collection(db, 'orderHistory'),
      where('completedAt', '>=', Timestamp.fromDate(startOfDay)),
      where('completedAt', '<', Timestamp.fromDate(endOfDay))
    );
    
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => doc.data());
    
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      totalItems: orders.reduce((sum, o) => sum + (o.items?.length || 0), 0),
      averageOrderValue: orders.length > 0 
        ? orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) / orders.length 
        : 0
    };
    
    return { success: true, stats, orders };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== REALTIME LISTENERS ====================

export function subscribeToOrders(callback: (orders: any[]) => void) {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
}

export function subscribeToPendingOrders(callback: (orders: any[]) => void) {
  const q = query(
    collection(db, 'orders'), 
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
}

export function subscribeToMenu(callback: (items: any[]) => void) {
  const q = query(collection(db, 'menu'), where('isAvailable', '==', true));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  });
}

export default app;