// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGQgTom3RvQoURS6esMbh2lOm0FjXClF0",
  authDomain: "needtea-32554.firebaseapp.com",
  databaseURL: "https://needtea-32554-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "needtea-32554",
  storageBucket: "needtea-32554.firebasestorage.app",
  messagingSenderId: "306781281475",
  appId: "1:306781281475:web:3e21dd82fc1f050323d676"
};

// Initialize Firebase (hanya sekali)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

// ==========================================
// KONFIGURASI URL DINAMIS
// ==========================================

// ✅ PERBAIKAN: Gunakan environment variable atau deteksi otomatis
const getBaseUrl = () => {
  // Prioritas 1: Environment variable (untuk production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Prioritas 2: Deteksi window location (client-side)
  if (typeof window !== 'undefined') {
    // Jika bukan localhost, gunakan origin asli
    if (!window.location.origin.includes('localhost')) {
      return window.location.origin;
    }
  }
  
  // Prioritas 3: Fallback ke localhost (development)
  return 'http://localhost:3000';
};

const actionCodeSettings = {
  url: `${getBaseUrl()}/login`,
  handleCodeInApp: true,
};

// ==========================================
// EMAIL LINK AUTHENTICATION
// ==========================================

export const sendEmailLink = async (email: string) => {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const checkSignInLink = (url: string) => {
  return isSignInWithEmailLink(auth, url);
};

export const completeSignInWithLink = async (email: string, url: string) => {
  try {
    const result = await signInWithEmailLink(auth, email, url);
    window.localStorage.removeItem('emailForSignIn');
    
    const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
    
    return { 
      success: true, 
      user: result.user,
      isNewUser: isNewUser
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const checkUserExists = async (email: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', email));
    return { success: true, exists: userDoc.exists(), userData: userDoc.data() };
  } catch (error: any) {
    return { success: false, error: error.message, exists: false };
  }
};

export const saveUserToFirestore = async (email: string, userData: any) => {
  try {
    await setDoc(doc(db, 'users', email), {
      ...userData,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================

export const registerUser = async (email: string, password: string, name: string, role: 'user' | 'admin' = 'user') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, 'users', email), {
      email,
      name,
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userDoc = await getDoc(doc(db, 'users', email));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      localStorage.setItem('needtea_user', JSON.stringify({ email, ...userData }));
      return { success: true, user, userData };
    }
    
    return { success: false, error: 'Data user tidak ditemukan' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('needtea_user');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// MENU MANAGEMENT FUNCTIONS
// ==========================================

export type CategoryType = 'food' | 'drink';

export interface MenuItem {
  id?: string;
  name: string;
  description?: string;
  price: number;
  category: CategoryType;
  image?: string;
  stock: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const getMenuItems = async () => {
  try {
    const q = query(collection(db, 'menuItems'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as MenuItem[];
    
    return { success: true, items };
  } catch (error: any) {
    return { success: false, error: error.message, items: [] };
  }
};

export const addMenuItem = async (data: {
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  stock: number;
}) => {
  try {
    const validCategory: CategoryType = data.category === 'drink' ? 'drink' : 'food';
    
    const docRef = await addDoc(collection(db, 'menuItems'), {
      ...data,
      category: validCategory,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return { success: true, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateMenuItem = async (id: string, data: Partial<{
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  stock: number;
}>) => {
  try {
    const itemRef = doc(db, 'menuItems', id);
    const updateData: any = { ...data, updatedAt: serverTimestamp() };
    
    if (data.category) {
      updateData.category = data.category === 'drink' ? 'drink' : 'food';
    }
    
    await updateDoc(itemRef, updateData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deleteMenuItem = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'menuItems', id));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// ORDER MANAGEMENT FUNCTIONS
// ==========================================

export interface OrderItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'shopeepay' | 'manual';

export interface Order {
  id?: string;
  userEmail: string;
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  shopeepayNumber?: string;
  createdAt?: Timestamp;
  expiryTime?: Timestamp;
  completedAt?: Timestamp;
  isManualOrder?: boolean;
  notes?: string;
}

export const createOrder = async (orderData: {
  userEmail: string;
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  shopeepayNumber?: string;
  status?: OrderStatus;
  isManualOrder?: boolean;
  notes?: string;
}) => {
  try {
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);
    
    const docRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      status: orderData.status || 'pending',
      createdAt: serverTimestamp(),
      expiryTime: Timestamp.fromDate(expiryTime)
    });
    
    return { success: true, orderId: docRef.id, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  try {
    const updateData: any = { status };
    
    if (status === 'completed') {
      updateData.completedAt = serverTimestamp();
    }
    
    await updateDoc(doc(db, 'orders', orderId), updateData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const completeOrder = async (orderId: string) => {
  return updateOrderStatus(orderId, 'completed');
};

export const cancelExpiredOrders = async () => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      where('expiryTime', '<', now)
    );
    
    const snapshot = await getDocs(q);
    const batch = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { status: 'cancelled' })
    );
    
    await Promise.all(batch);
    return { success: true, cancelledCount: snapshot.size };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const subscribeToPendingOrders = (callback: (orders: Order[]) => void) => {
  const q = query(
    collection(db, 'orders'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Order[];
    callback(orders);
  });
};

export const getUserOrders = async (userEmail: string) => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('userEmail', '==', userEmail),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Order[];
    
    return { success: true, orders };
  } catch (error: any) {
    return { success: false, error: error.message, orders: [] };
  }
};

// ==========================================
// STATISTICS FUNCTIONS
// ==========================================

export const getDailyStats = async (dateString: string) => {
  try {
    const date = new Date(dateString);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'completed'),
      where('completedAt', '>=', Timestamp.fromDate(startOfDay)),
      where('completedAt', '<=', Timestamp.fromDate(endOfDay))
    );
    
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => doc.data() as Order);
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalItems = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      success: true,
      stats: {
        totalOrders,
        totalRevenue,
        totalItems,
        averageOrderValue,
        date: dateString
      }
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      stats: {
        totalOrders: 0,
        totalRevenue: 0,
        totalItems: 0,
        averageOrderValue: 0,
        date: dateString
      }
    };
  }
};

// ==========================================
// USER MANAGEMENT (ADMIN ONLY)
// ==========================================

export const getAllUsers = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    return { success: true, users };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateUserRole = async (email: string, role: 'user' | 'admin') => {
  try {
    await updateDoc(doc(db, 'users', email), {
      role,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};