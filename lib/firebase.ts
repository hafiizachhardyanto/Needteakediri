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
  DocumentData,
  enableIndexedDbPersistence,
  runTransaction
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGQgTom3RvQoURS6esMbh2lOm0FjXClF0",
  authDomain: "needtea-32554.firebaseapp.com",
  databaseURL: "https://needtea-32554-default-rtdb.asia-southeast1.firebasedatabase.app ",
  projectId: "needtea-32554",
  storageBucket: "needtea-32554.firebasestorage.app",
  messagingSenderId: "306781281475",
  appId: "1:306781281475:web:3e21dd82fc1f050323d676"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.log('The current browser does not support all of the features required to enable persistence');
    }
  });
}

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
    const dataToSave: any = {
      ...userData,
      email,
      updatedAt: serverTimestamp()
    };
    
    if (!userData.createdAt) {
      dataToSave.createdAt = serverTimestamp();
    }
    
    await setDoc(doc(db, 'users', email), dataToSave);
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
      
      const safeUpdate: any = {};
      
      Object.keys(userData).forEach(key => {
        if (userData[key] !== undefined) {
          safeUpdate[key] = userData[key];
        }
      });
      
      safeUpdate.role = existingData.role;
      safeUpdate.createdAt = existingData.createdAt;
      safeUpdate.updatedAt = serverTimestamp();
      
      await updateDoc(userRef, safeUpdate);
      return { success: true, isNewUser: false, role: existingData.role };
    } else {
      const newRole = userData.role || 'user';
      
      const newUserData: any = {
        role: newRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      Object.keys(userData).forEach(key => {
        if (userData[key] !== undefined && key !== 'role' && key !== 'createdAt' && key !== 'updatedAt') {
          newUserData[key] = userData[key];
        }
      });
      
      await setDoc(userRef, newUserData);
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

const getCurrentUserEmail = (): string => {
  if (typeof window === 'undefined') return 'unknown';
  const storedUser = localStorage.getItem('needtea_user');
  if (!storedUser) return 'unknown';
  try {
    const userData = JSON.parse(storedUser);
    return userData?.email || 'unknown';
  } catch {
    return 'unknown';
  }
};

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
    console.error('getMenuItems Error:', error);
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
    const adminEmail = getCurrentUserEmail();
    
    if (adminEmail === 'unknown') {
      return { success: false, error: 'Anda harus login terlebih dahulu' };
    }
    
    const validCategory: CategoryType = data.category === 'drink' ? 'drink' : 'food';
    
    const docData = {
      name: data.name,
      description: data.description || '',
      price: data.price,
      category: validCategory,
      image: data.image || '',
      stock: data.stock,
      createdBy: adminEmail,
      updatedBy: adminEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('Adding menu item:', docData);
    
    const docRef = await addDoc(collection(db, 'menuItems'), docData);
    
    console.log('Menu item added with ID:', docRef.id);
    
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('addMenuItem Error:', error);
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
    const adminEmail = getCurrentUserEmail();
    
    if (adminEmail === 'unknown') {
      return { success: false, error: 'Anda harus login terlebih dahulu' };
    }
    
    const itemRef = doc(db, 'menuItems', id);
    const updateData: any = { 
      ...data, 
      updatedBy: adminEmail,
      updatedAt: serverTimestamp() 
    };
    
    if (data.category) {
      updateData.category = data.category === 'drink' ? 'drink' : 'food';
    }
    
    console.log('Updating menu item:', id, updateData);
    
    await updateDoc(itemRef, updateData);
    
    console.log('Menu item updated successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('updateMenuItem Error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteMenuItem = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Deleting menu item:', id);
    
    await deleteDoc(doc(db, 'menuItems', id));
    
    console.log('Menu item deleted successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('deleteMenuItem Error:', error);
    return { success: false, error: error.message };
  }
};

export const updateStock = async (menuId: string, quantityChange: number): Promise<{ success: boolean; error?: string }> => {
  try {
    const menuRef = doc(db, 'menuItems', menuId);
    
    await runTransaction(db, async (transaction) => {
      const menuDoc = await transaction.get(menuRef);
      
      if (!menuDoc.exists()) {
        throw new Error('Menu item tidak ditemukan');
      }
      
      const currentStock = menuDoc.data().stock || 0;
      const newStock = Math.max(0, currentStock + quantityChange);
      
      transaction.update(menuRef, { 
        stock: newStock,
        updatedAt: serverTimestamp()
      });
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('updateStock Error:', error);
    return { success: false, error: error.message };
  }
};

export const restoreStockFromOrder = async (items: { menuId: string; quantity: number }[]): Promise<{ success: boolean; error?: string }> => {
  try {
    for (const item of items) {
      const result = await updateStock(item.menuId, item.quantity);
      if (!result.success) {
        return { success: false, error: result.error };
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const subscribeToMenuItems = (callback: (items: any[]) => void) => {
  const q = query(collection(db, 'menuItems'), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(items);
  });
};

export const subscribeToUserOrders = (userEmail: string, callback: (orders: any[]) => void) => {
  const q = query(
    collection(db, 'orders'),
    where('userEmail', '==', userEmail),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(orders);
  });
};

export const cancelOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      return { success: false, error: 'Pesanan tidak ditemukan' };
    }
    
    const orderData = orderDoc.data();
    
    if (orderData.items) {
      await restoreStockFromOrder(orderData.items.map((item: any) => ({
        menuId: item.menuId,
        quantity: item.quantity
      })));
    }
    
    await updateDoc(orderRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deductStockForOrder = async (items: { menuId: string; quantity: number }[]): Promise<{ success: boolean; error?: string }> => {
  try {
    for (const item of items) {
      const menuRef = doc(db, 'menuItems', item.menuId);
      const menuDoc = await getDoc(menuRef);
      
      if (!menuDoc.exists()) {
        return { success: false, error: `Menu ${item.menuId} tidak ditemukan` };
      }
      
      const currentStock = menuDoc.data().stock || 0;
      if (currentStock < item.quantity) {
        return { success: false, error: `Stok ${menuDoc.data().name} tidak mencukupi (tersisa: ${currentStock})` };
      }
    }
    
    for (const item of items) {
      const result = await updateStock(item.menuId, -item.quantity);
      if (!result.success) {
        return { success: false, error: result.error };
      }
    }
    
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

export type OrderStatus = 'pending' | 'completed' | 'cancelled' | 'awaiting_payment' | 'payment_confirmed';
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
  awaitingPaymentAt?: Timestamp;
}

export const createManualOrder = async (orderData: {
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
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
    
    const stockCheck = await deductStockForOrder(orderData.items.map(item => ({ menuId: item.menuId, quantity: item.quantity })));
    if (!stockCheck.success) {
      return { success: false, error: stockCheck.error };
    }
    
    const paymentMethod = orderData.paymentMethod || 'manual';
    const requiresConfirmation = ['e-money', 'transfer', 'shopeepay'].includes(paymentMethod);
    
    const docRef = await addDoc(collection(db, 'orders'), {
      userName: orderData.customerName,
      userEmail: 'manual-order@admin.local',
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      status: requiresConfirmation ? 'awaiting_payment' : 'pending',
      paymentMethod: paymentMethod,
      paymentStatus: 'pending',
      createdAt: serverTimestamp(),
      awaitingPaymentAt: requiresConfirmation ? serverTimestamp() : null,
      expiryTime: requiresConfirmation ? Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)) : null,
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

export const confirmPayment = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'payment_confirmed',
      paymentStatus: 'paid',
      paymentConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const moveToQueue = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'pending',
      expiryTime: null,
      awaitingPaymentAt: null,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deleteOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const cancelAndDeleteOrder = async (orderId: string, items?: { menuId: string; quantity: number }[]): Promise<{ success: boolean; error?: string }> => {
  try {
    if (items && items.length > 0) {
      const restoreResult = await restoreStockFromOrder(items);
      if (!restoreResult.success) {
        return { success: false, error: restoreResult.error };
      }
    }
    
    await deleteDoc(doc(db, 'orders', orderId));
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

export const cancelExpiredAwaitingPaymentOrders = async (): Promise<{ success: boolean; error?: string; cancelledCount?: number }> => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'awaiting_payment'),
      where('expiryTime', '<', now)
    );
    
    const snapshot = await getDocs(q);
    
    for (const docSnapshot of snapshot.docs) {
      const orderData = docSnapshot.data();
      if (orderData.items) {
        await restoreStockFromOrder(orderData.items.map((item: any) => ({
          menuId: item.menuId,
          quantity: item.quantity
        })));
      }
      await updateDoc(docSnapshot.ref, { status: 'cancelled', cancelledAt: serverTimestamp() });
    }
    
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

export const subscribeToAwaitingPaymentOrders = (callback: (orders: Order[]) => void) => {
  const q = query(
    collection(db, 'orders'),
    where('status', '==', 'awaiting_payment'),
    orderBy('awaitingPaymentAt', 'asc')
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

export const subscribeToTodayCompletedOrders = (callback: (orders: Order[]) => void) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  const q = query(
    collection(db, 'orders'),
    where('status', '==', 'completed'),
    where('completedAt', '>=', Timestamp.fromDate(startOfDay)),
    where('completedAt', '<=', Timestamp.fromDate(endOfDay)),
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

export const getMonthlyOrders = async (year: number, month: number): Promise<{
  success: boolean;
  error?: string;
  orders: Order[];
}> => {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const allOrders = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Order[];
    
    const filteredOrders = allOrders.filter(order => {
      if (!order.completedAt) return false;
      const completedDate = order.completedAt.toDate();
      return completedDate >= startOfMonth && completedDate <= endOfMonth;
    });
    
    return { success: true, orders: filteredOrders };
  } catch (error: any) {
    return { success: false, error: error.message, orders: [] };
  }
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

export const getOrdersByDateRange = async (startDate: string, endDate: string): Promise<{
  success: boolean;
  error?: string;
  orders: Order[];
}> => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const allOrders = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Order[];
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const filteredOrders = allOrders.filter(order => {
      if (!order.completedAt) return false;
      const completedDate = order.completedAt.toDate();
      return completedDate >= start && completedDate <= end;
    });
    
    return { success: true, orders: filteredOrders };
  } catch (error: any) {
    return { success: false, error: error.message, orders: [] };
  }
};

export const getMonthlyStats = async (year: number, month: number): Promise<{
  success: boolean;
  error?: string;
  stats: any;
}> => {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const allOrders = snapshot.docs.map(doc => doc.data() as Order);
    
    const orders = allOrders.filter(order => {
      if (!order.completedAt) return false;
      const completedDate = order.completedAt.toDate();
      return completedDate >= startOfMonth && completedDate <= endOfMonth;
    });
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalItems = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    
    return {
      success: true,
      stats: {
        totalOrders,
        totalRevenue,
        totalItems,
        year,
        month
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
        year,
        month
      }
    };
  }
};

export const getYearlyStats = async (year: number): Promise<{
  success: boolean;
  error?: string;
  stats: any;
}> => {
  try {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
    
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const allOrders = snapshot.docs.map(doc => doc.data() as Order);
    
    const orders = allOrders.filter(order => {
      if (!order.completedAt) return false;
      const completedDate = order.completedAt.toDate();
      return completedDate >= startOfYear && completedDate <= endOfYear;
    });
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalItems = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    
    return {
      success: true,
      stats: {
        totalOrders,
        totalRevenue,
        totalItems,
        year
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
        year
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