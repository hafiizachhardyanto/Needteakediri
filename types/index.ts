export interface UserData {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: any;
  lastLogin: any;
  profile: {
    avatar: string;
    address: string;
    phone: string;
  };
  stats: {
    totalOrders: number;
    totalSpent: number;
  };
}

export interface MenuItem {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: 'food' | 'drink';
  image: string;
  isAvailable: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface OrderItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  image: string;
}

export interface Order {
  id?: string;
  userEmail: string;
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: 'shopeepay' | 'cash';
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
  shopeepayNumber?: string;
}