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
  serverTimestamp,
  DocumentData
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGQgTom3RvQoURS6esMbh2lOm0FjXClF0",
  authDomain: "needtea-32554.firebaseapp.com",
  databaseURL: "https://needtea-32554-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "needtea-32554",
  storageBucket: "needtea-32554.firebasestorage.app",
  messagingSenderId: "306781281475",
  appId: "1:306781281475:web:3e21dd82fc1f050323d676"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (typeof window !== 'undefined') {
    if (!window.location.origin.includes('localhost')) {
      return window.location.origin;
    }
  }
  
  return 'http://localhost:3000';
};

const actionCodeSettings = {
  url: `${getBaseUrl()}/login`,
  handleCodeInApp: true,
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOTPToUser = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, 'users', email);
    
    await setDoc(userRef, {
      otp: {
        code: otp,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
        used: false
      }
    }, { merge: true });
    
    return { success: true };
  } catch (error: any) {
    console.error('saveOTPToUser Error:', error);
    return { success: false, error: error.message };
  }
};

export const verifyOTPFromUser = async (email: string, inputOTP: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, 'users', email);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, error: 'User tidak ditemukan' };
    }
    
    const userData = userDoc.data();
    const otpData = userData.otp;
    
    if (!otpData) {
      return { success: false, error: 'OTP tidak ditemukan' };
    }
    
    const now = Timestamp.now();
    
    if (otpData.expiresAt.toDate() < now.toDate()) {
      return { success: false, error: 'OTP sudah kadaluarsa' };
    }
    
    if (otpData.used) {
      return { success: false, error: 'OTP sudah digunakan' };
    }
    
    if (otpData.code !== inputOTP) {
      return { success: false, error: 'OTP tidak valid' };
    }
    
    await updateDoc(userRef, { 'otp.used': true });
    
    return { success: true };
  } catch (error: any) {
    console.error('verifyOTPFromUser Error:', error);
    return { success: false, error: error.message };
  }
};

export const loginWithOTP = async (email: string, otp: string): Promise<{
  success: boolean;
  error?: string;
  userData?: DocumentData;
  isNewUser?: boolean;
}> => {
  try {
    const verifyResult = await verifyOTPFromUser(email, otp);
    if (!verifyResult.success) {
      return { 
        success: false, 
        error: verifyResult.error || 'Verifikasi OTP gagal'
      };
    }
    
    const userCheck = await checkUserExists(email);
    
    if (!userCheck.exists) {
      const saveResult = await saveUserToFirestoreSafe(email, {
        email,
        name: email.split('@')[0],
        role: 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
      
      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error || 'Gagal menyimpan data user'
        };
      }
    } else {
      await updateDoc(doc(db, 'users', email), {
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    const userDoc = await getDoc(doc(db, 'users', email));
    const userData = userDoc.data();
    
    localStorage.setItem('needtea_user', JSON.stringify({
      email,
      ...userData,
      isLoggedIn: true,
      loginTime: new Date().toISOString()
    }));
    
    return { 
      success: true, 
      userData,
      isNewUser: !userCheck.exists 
    };
  } catch (error: any) {
    console.error('loginWithOTP Error:', error);
    return { 
      success: false, 
      error: error.message || 'Terjadi kesalahan saat login'
    };
  }
};

export const sendEmailLink = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const checkSignInLink = (url: string): boolean => {
  return isSignInWithEmailLink(auth, url);
};

export const completeSignInWithLink = async (email: string, url: string): Promise<{
  success: boolean;
  error?: string;
  user?: User;
  isNewUser?: boolean;
}> => {
  try {
    const result = await signInWithEmailLink(auth, email, url);
    window.localStorage.removeItem('emailForSignIn');
    
    const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
    
    await saveUserToFirestoreSafe(email, {
      email: result.user.email,
      name: result.user.displayName || email.split('@')[0],
      emailVerified: result.user.emailVerified,
      lastLogin: serverTimestamp(),
    });
    
    return { 
      success: true, 
      user: result.user,
      isNewUser: isNewUser
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const checkUserExists = async (email: string): Promise<{ success: boolean; exists: boolean; userData?: DocumentData; error?: string }> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', email));
    return { success: true, exists: userDoc.exists(), userData: userDoc.data() };
  } catch (error: any) {
    return { success: false, exists: false, error: error.message };
  }
};

export const saveUserToFirestore = async (email: string, userData: any): Promise<{ success: boolean; error?: string }> => {
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

export const saveUserToFirestoreSafe = async (email: string, userData: any): Promise<{
  success: boolean;
  error?: string;
  isNewUser?: boolean;
  role?: string;
}> => {
  try {
    const userRef = doc(db, 'users', email);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const existingData = userDoc.data();
      
      const safeUpdate = {
        ...userData,
        role: existingData.role,
        createdAt: existingData.createdAt,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, safeUpdate);
      return { success: true, isNewUser: false, role: existingData.role };
    } else {
      const newRole = userData.role || 'user';
      await setDoc(userRef, {
        ...userData,
        role: newRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, isNewUser: true, role: newRole };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (email: string, profileData: any): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, 'users', email);
    
    const allowedFields = ['name', 'phone', 'address', 'avatar', 'updatedAt'];
    const safeUpdate: any = {};
    
    allowedFields.forEach(field => {
      if (profileData[field] !== undefined) {
        safeUpdate[field] = profileData[field];
      }
    });
    
    safeUpdate.updatedAt = serverTimestamp();
    
    await updateDoc(userRef, safeUpdate);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const setUserRole = async (email: string, role: 'user' | 'admin'): Promise<{ success: boolean; error?: string }> => {
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

export const registerUser = async (email: string, password: string, name: string, role: 'user' | 'admin' = 'user'): Promise<{
  success: boolean;
  error?: string;
  user?: any;
}> => {
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

export const loginUser = async (email: string, password: string): Promise<{
  success: boolean;
  error?: string;
  user?: any;
  userData?: DocumentData;
}> => {
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

export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await signOut(auth);
    localStorage.removeItem('needtea_user');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

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
  createdBy?: string;
  updatedBy?: string;
}

export const getMenuItems = async (): Promise<{
  success: boolean;
  error?: string;
  items: MenuItem[];
}> => {
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
}): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const storedUser = localStorage.getItem('needtea_user');
    const userData = storedUser ? JSON.parse(storedUser) : null;
    const adminEmail = userData?.email || 'unknown';
    
    const validCategory: CategoryType = data.category === 'drink' ? 'drink' : 'food';
    
    const docRef = await addDoc(collection(db, 'menuItems'), {
      ...data,
      category: validCategory,
      createdBy: adminEmail,
      updatedBy: adminEmail,
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
}>): Promise<{ success: boolean; error?: string }> => {
  try {
    const storedUser = localStorage.getItem('needtea_user');
    const userData = storedUser ? JSON.parse(storedUser) : null;
    const adminEmail = userData?.email || 'unknown';
    
    const itemRef = doc(db, 'menuItems', id);
    const updateData: any = { 
      ...data, 
      updatedBy: adminEmail,
      updatedAt: serverTimestamp() 
    };
    
    if (data.category) {
      updateData.category = data.category === 'drink' ? 'drink' : 'food';
    }
    
    await updateDoc(itemRef, updateData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deleteMenuItem = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, 'menuItems', id));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export interface OrderItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'shopeepay' | 'manual' | 'transfer' | 'e-money';

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
  createdBy?: string;
  paymentProof?: string;
  paymentStatus?: 'pending' | 'paid';
}

export const createManualOrder = async (orderData: {
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string; orderId?: string }> => {
  try {
    const storedUser = localStorage.getItem('needtea_user');
    let createdBy = 'unknown';
    let isAdmin = false;
    
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      createdBy = userData.email || 'unknown';
      isAdmin = userData.role === 'admin';
    }
    
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized: Only admin can create manual orders' };
    }
    
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);
    
    const docRef = await addDoc(collection(db, 'orders'), {
      userName: orderData.customerName,
      userEmail: 'manual-order@admin.local',
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      status: 'pending',
      paymentMethod: 'manual',
      paymentStatus: 'pending',
      createdAt: serverTimestamp(),
      expiryTime: Timestamp.fromDate(expiryTime),
      notes: orderData.notes,
      isManualOrder: true,
      createdBy: createdBy,
    });
    
    return { success: true, orderId: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateOrderPaymentProof = async (orderId: string, paymentProofUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      paymentProof: paymentProofUrl,
      paymentStatus: 'paid',
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateOrderPaymentMethod = async (orderId: string, paymentMethod: PaymentMethod): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      paymentMethod: paymentMethod,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const createOrder = async (orderData: {
  userEmail: string;
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  shopeepayNumber?: string;
  status?: OrderStatus;
}): Promise<{ success: boolean; error?: string; orderId?: string; id?: string }> => {
  try {
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);
    
    const docRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      status: orderData.status || 'pending',
      paymentStatus: 'pending',
      createdAt: serverTimestamp(),
      expiryTime: Timestamp.fromDate(expiryTime)
    });
    
    return { success: true, orderId: docRef.id, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = { 
      status,
      updatedAt: serverTimestamp()
    };
    
    if (status === 'completed') {
      updateData.completedAt = serverTimestamp();
    }
    
    await updateDoc(doc(db, 'orders', orderId), updateData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const completeOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
  return updateOrderStatus(orderId, 'completed');
};

export const cancelExpiredOrders = async (): Promise<{ success: boolean; error?: string; cancelledCount?: number }> => {
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

export const subscribeToCompletedOrders = (callback: (orders: Order[]) => void) => {
  const q = query(
    collection(db, 'orders'),
    where('status', '==', 'completed'),
    orderBy('completedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Order[];
    callback(orders);
  });
};

export const getUserOrders = async (userEmail: string): Promise<{
  success: boolean;
  error?: string;
  orders: Order[];
}> => {
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

export const getDailyStats = async (dateString: string): Promise<{
  success: boolean;
  error?: string;
  stats: any;
}> => {
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

export const getAllUsers = async (): Promise<{
  success: boolean;
  error?: string;
  users?: any[];
}> => {
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

export const updateUserRole = async (email: string, role: 'user' | 'admin'): Promise<{ success: boolean; error?: string }> => {
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