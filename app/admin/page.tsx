'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getMenuItems, 
  addMenuItem, 
  deleteMenuItem,
  updateMenuItem,
  completeOrder,
  updateOrderStatus,
  cancelExpiredOrders,
  cancelExpiredAwaitingPaymentOrders,
  subscribeToPendingOrders,
  subscribeToCompletedOrders,
  subscribeToAwaitingPaymentOrders,
  subscribeToTodayCompletedOrders,
  createManualOrder,
  updateOrderPaymentProof,
  updateOrderPaymentMethod,
  confirmPayment,
  moveToQueue,
  deleteOrder,
  getOrdersByDateRange,
  getMonthlyStats,
  getYearlyStats,
  logoutUser
} from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminDashboard() {
  const router = useRouter();
  const { userData, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'payment' | 'menu' | 'history' | 'manual'>('dashboard');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [awaitingPaymentOrders, setAwaitingPaymentOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [todayCompletedOrders, setTodayCompletedOrders] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({ totalRevenue: 0, totalOrders: 0, totalItems: 0 });
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newMenu, setNewMenu] = useState({
    name: '',
    description: '',
    price: '',
    category: 'food',
    image: '',
    stock: ''
  });

const handleMenuImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'add' | 'edit') => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran file maksimal 2MB');
    return;
  }

  const reader = new FileReader();
  reader.onloadend = () => {
    const base64String = reader.result as string;
    if (mode === 'add') {
      setNewMenu(prev => ({ ...prev, image: base64String }));
    } else {
      setEditingMenu((prev: any) => ({ ...prev, image: base64String }));
    }
  };
  reader.readAsDataURL(file);
};

  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);

  const [manualOrder, setManualOrder] = useState({
    customerName: '',
    items: [] as { menuId: string; quantity: number; name: string; price: number; maxStock: number }[],
    notes: '',
    paymentMethod: 'cash' as 'cash' | 'e-money' | 'transfer' | 'shopeepay'
  });

  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paymentTimers, setPaymentTimers] = useState<{[key: string]: number}>({});

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [monthlyOrders, setMonthlyOrders] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadInitialData();
      
      const unsubscribePending = subscribeToPendingOrders((orders) => {
        setPendingOrders(orders);
      });
      
      const unsubscribeAwaiting = subscribeToAwaitingPaymentOrders((orders) => {
        setAwaitingPaymentOrders(orders);
      });
      
      const unsubscribeCompleted = subscribeToCompletedOrders((orders) => {
        setCompletedOrders(orders);
      });

      const unsubscribeToday = subscribeToTodayCompletedOrders((orders) => {
        setTodayCompletedOrders(orders);
        calculateTodayStats(orders);
      });
      
      const interval = setInterval(() => {
        cancelExpiredAwaitingPaymentOrders();
        cancelExpiredOrders();
      }, 60000);
      
      return () => {
        unsubscribePending();
        unsubscribeAwaiting();
        unsubscribeCompleted();
        unsubscribeToday();
        clearInterval(interval);
      };
    }
  }, [isAdmin]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const newTimers: {[key: string]: number} = {};
      
      awaitingPaymentOrders.forEach(order => {
        if (order.expiryTime) {
          const expiry = order.expiryTime.toDate().getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
          newTimers[order.id] = remaining;
        }
      });
      
      setPaymentTimers(newTimers);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [awaitingPaymentOrders]);

  useEffect(() => {
    const midnightCheck = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        setTodayStats({ totalRevenue: 0, totalOrders: 0, totalItems: 0 });
      }
    }, 60000);

    return () => clearInterval(midnightCheck);
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'dashboard') {
      loadMonthlyStats();
    }
  }, [isAdmin, activeTab, selectedMonth, selectedYear]);

  const calculateTodayStats = (orders: any[]) => {
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0
    );
    setTodayStats({ totalRevenue, totalOrders, totalItems });
  };

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      loadMenu(),
      loadMonthlyStats()
    ]);
    setLoading(false);
  };

  const loadMenu = async () => {
    const result = await getMenuItems();
    if (result.success) {
      setMenuItems(result.items || []);
    }
  };
      
        const loadMonthlyStats = async () => {
    setStatsLoading(true);
    try {
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      
      const q = query(
        collection(db, 'orders'),
        where('status', 'in', ['completed', 'cancelled']),
        orderBy('completedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const allOrders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as any[];
      
      const filteredOrders = allOrders.filter((order: any) => {
        const orderDate = order.completedAt?.toDate?.() || order.createdAt?.toDate?.();
        if (!orderDate) return false;
        return orderDate >= startOfMonth && orderDate <= endOfMonth;
      });
      
      setMonthlyOrders(filteredOrders);
      
      const completedOrdersInMonth = filteredOrders.filter((o: any) => o.status === 'completed');
      const cancelledOrdersInMonth = filteredOrders.filter((o: any) => o.status === 'cancelled');
      
      const totalRevenue = completedOrdersInMonth.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0);
      const totalOrders = completedOrdersInMonth.length;
      const totalItems = completedOrdersInMonth.reduce((sum: number, order: any) => 
        sum + (order.items || []).reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0), 0
      );
      
      const itemSales: {[key: string]: {name: string; quantity: number; revenue: number}} = {};
      completedOrdersInMonth.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          if (!itemSales[item.menuId]) {
            itemSales[item.menuId] = { name: item.name, quantity: 0, revenue: 0 };
          }
          itemSales[item.menuId].quantity += item.quantity || 0;
          itemSales[item.menuId].revenue += (item.price || 0) * (item.quantity || 0);
        });
      });
      
      const paymentMethods: {[key: string]: {count: number; amount: number}} = {};
      completedOrdersInMonth.forEach((order: any) => {
        const method = order.paymentMethod || 'unknown';
        if (!paymentMethods[method]) {
          paymentMethods[method] = { count: 0, amount: 0 };
        }
        paymentMethods[method].count += 1;
        paymentMethods[method].amount += order.totalAmount || 0;
      });
      
      const dailyRevenue: {[key: string]: number} = {};
      completedOrdersInMonth.forEach((order: any) => {
        const date = order.completedAt?.toDate?.();
        if (date) {
          const dateKey = date.toISOString().split('T')[0];
          if (!dailyRevenue[dateKey]) dailyRevenue[dateKey] = 0;
          dailyRevenue[dateKey] += order.totalAmount || 0;
        }
      });
      
      setMonthlyStats({
        totalRevenue,
        totalOrders,
        totalItems,
        totalCancelled: cancelledOrdersInMonth.length,
        itemSales: Object.entries(itemSales).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.quantity - a.quantity),
        paymentMethods,
        dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date))
      });
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    }
    setStatsLoading(false);
  };

  const downloadMonthlyReport = () => {
    if (!monthlyStats || monthlyOrders.length === 0) {
      alert('Tidak ada data untuk diunduh');
      return;
    }
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthName = monthNames[selectedMonth - 1];
    const filename = `laporan-${monthName}-${selectedYear}.csv`;
    
    let csvContent = '\ufeff';
    
    csvContent += `LAPORAN BULANAN NEEDTEA\n`;
    csvContent += `Periode: ${monthName} ${selectedYear}\n\n`;
    
    csvContent += `RINGKASAN UMUM\n`;
    csvContent += `Total Pendapatan,Rp ${monthlyStats.totalRevenue.toLocaleString()}\n`;
    csvContent += `Total Pesanan Selesai,${monthlyStats.totalOrders}\n`;
    csvContent += `Total Item Terjual,${monthlyStats.totalItems}\n`;
    csvContent += `Total Pembatalan,${monthlyStats.totalCancelled}\n\n`;
    
    csvContent += `PENJUALAN PER ITEM\n`;
    csvContent += `Nama Item,Jumlah Terjual,Total Pendapatan\n`;
    monthlyStats.itemSales.forEach((item: any) => {
      csvContent += `"${item.name}",${item.quantity},Rp ${item.revenue.toLocaleString()}\n`;
    });
    csvContent += `\n`;
    
    csvContent += `PENGGUNAAN METODE PEMBAYARAN\n`;
    csvContent += `Metode Pembayaran,Jumlah Transaksi,Total Nilai\n`;
    Object.entries(monthlyStats.paymentMethods).forEach(([method, data]: [string, any]) => {
      const methodLabels: {[key: string]: string} = {
        'cash': 'Tunai',
        'e-money': 'E-Money',
        'transfer': 'Transfer Bank',
        'shopeepay': 'ShopeePay',
        'manual': 'Manual'
      };
      csvContent += `"${methodLabels[method] || method}",${data.count},Rp ${data.amount.toLocaleString()}\n`;
    });
    csvContent += `\n`;
    
    csvContent += `PENDAPATAN HARIAN\n`;
    csvContent += `Tanggal,Pendapatan\n`;
    monthlyStats.dailyRevenue.forEach((day: any) => {
      csvContent += `${day.date},Rp ${day.amount.toLocaleString()}\n`;
    });
    csvContent += `\n`;
    
    csvContent += `DETAIL TRANSAKSI\n`;
    csvContent += `Tanggal,Nama Pelanggan,Item,Total,Metode Pembayaran,Status\n`;
    monthlyOrders.forEach((order: any) => {
      const date = order.completedAt?.toDate?.().toLocaleString('id-ID') || order.createdAt?.toDate?.().toLocaleString('id-ID') || '-';
      const items = (order.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join('; ');
      const methodLabels: {[key: string]: string} = {
        'cash': 'Tunai',
        'e-money': 'E-Money',
        'transfer': 'Transfer Bank',
        'shopeepay': 'ShopeePay',
        'manual': 'Manual'
      };
      const status = order.status === 'completed' ? 'Selesai' : 'Dibatalkan';
      csvContent += `"${date}","${order.userName || '-'}","${items}",Rp ${(order.totalAmount || 0).toLocaleString()},"${methodLabels[order.paymentMethod] || order.paymentMethod || '-'}","${status}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addMenuItem({
      name: newMenu.name,
      description: newMenu.description,
      price: parseInt(newMenu.price),
      category: newMenu.category as 'food' | 'drink',
      image: newMenu.image,
      stock: parseInt(newMenu.stock) || 0
    });
    if (result.success) {
      setShowAddMenu(false);
      setNewMenu({ name: '', description: '', price: '', category: 'food', image: '', stock: '' });
      loadMenu();
    }
  };

  const handleEditMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu?.id) return;
    
    const result = await updateMenuItem(editingMenu.id, {
      name: editingMenu.name,
      description: editingMenu.description,
      price: parseInt(editingMenu.price),
      category: editingMenu.category,
      image: editingMenu.image,
      stock: parseInt(editingMenu.stock) || 0
    });
    
    if (result.success) {
      setShowEditMenu(false);
      setEditingMenu(null);
      loadMenu();
    } else {
      alert('Gagal mengupdate menu: ' + result.error);
    }
  };

  const handleDeleteMenu = async (itemId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus menu ini?')) return;
    const result = await deleteMenuItem(itemId);
    if (result.success) {
      loadMenu();
    } else {
      alert('Gagal menghapus menu: ' + result.error);
    }
  };

  const openEditModal = (item: any) => {
    setEditingMenu({
      ...item,
      price: item.price?.toString() || '',
      stock: item.stock?.toString() || '0'
    });
    setShowEditMenu(true);
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!confirm('Tandai pesanan ini sebagai selesai?')) return;
    
    const result = await completeOrder(orderId);
    if (result.success) {
      alert('Pesanan berhasil diselesaikan!');
    } else {
      alert('Gagal: ' + result.error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Batalkan pesanan ini?')) return;
    await updateOrderStatus(orderId, 'cancelled');
  };

  const handleConfirmPaymentAndMoveToQueue = async (orderId: string) => {
    if (!confirm('Konfirmasi pembayaran dan pindahkan ke antrian?')) return;
    
    const result = await moveToQueue(orderId);
    if (result.success) {
      alert('Pembayaran dikonfirmasi! Pesanan dipindahkan ke antrian.');
    } else {
      alert('Gagal: ' + result.error);
    }
  };

  const handleDeleteHistoryOrder = async (orderId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus riwayat pesanan ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    const result = await deleteOrder(orderId);
    if (result.success) {
      alert('Riwayat pesanan berhasil dihapus!');
      if (showHistoryTable) {
        handleViewHistory();
      }
    } else {
      alert('Gagal menghapus riwayat: ' + result.error);
    }
  };

  const getAvailableStock = (menuId: string) => {
    const menuItem = menuItems.find(item => item.id === menuId);
    if (!menuItem) return 0;
    
    const usedInCart = manualOrder.items.find(i => i.menuId === menuId)?.quantity || 0;
    return Math.max(0, (menuItem.stock || 0) - usedInCart);
  };

  const handleAddToManualCart = (item: any) => {
    const availableStock = getAvailableStock(item.id);
    if (availableStock <= 0) {
      alert(`Stok ${item.name} habis!`);
      return;
    }

    const existingItem = manualOrder.items.find(i => i.menuId === item.id);
    if (existingItem) {
      if (existingItem.quantity >= item.stock) {
        alert(`Stok ${item.name} tidak mencukupi! Tersisa: ${item.stock}`);
        return;
      }
      setManualOrder(prev => ({
        ...prev,
        items: prev.items.map(i => 
          i.menuId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }));
    } else {
      setManualOrder(prev => ({
        ...prev,
        items: [...prev.items, { 
          menuId: item.id, 
          quantity: 1, 
          name: item.name, 
          price: item.price,
          maxStock: item.stock || 0
        }]
      }));
    }
  };

  const handleRemoveFromManualCart = (menuId: string) => {
    setManualOrder(prev => ({
      ...prev,
      items: prev.items.filter(i => i.menuId !== menuId)
    }));
  };

  const handleUpdateQuantity = (menuId: string, quantity: number) => {
    const item = manualOrder.items.find(i => i.menuId === menuId);
    if (!item) return;

    if (quantity <= 0) {
      handleRemoveFromManualCart(menuId);
      return;
    }

    if (quantity > item.maxStock) {
      alert(`Stok ${item.name} tidak mencukupi! Maksimum: ${item.maxStock}`);
      return;
    }

    setManualOrder(prev => ({
      ...prev,
      items: prev.items.map(i => 
        i.menuId === menuId ? { ...i, quantity } : i
      )
    }));
  };

  const calculateManualTotal = () => {
    return manualOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSaveManualOrder = async () => {
    if (!manualOrder.customerName.trim()) {
      alert('Silakan masukkan nama pelanggan');
      return;
    }
    if (manualOrder.items.length === 0) {
      alert('Silakan pilih minimal satu item');
      return;
    }
    
    if (!isAdmin) {
      alert('Anda tidak memiliki izin untuk membuat pesanan manual');
      return;
    }

    try {
      const result = await createManualOrder({
        customerName: manualOrder.customerName,
        items: manualOrder.items.map(item => ({
          ...item,
          subtotal: item.price * item.quantity
        })),
        totalAmount: calculateManualTotal(),
        notes: manualOrder.notes,
        paymentMethod: manualOrder.paymentMethod
      });
      
      if (result.success) {
        alert('Pesanan manual berhasil dibuat!');
        setManualOrder({ customerName: '', items: [], notes: '', paymentMethod: 'cash' });
        
        if (['e-money', 'transfer', 'shopeepay'].includes(manualOrder.paymentMethod)) {
          setActiveTab('payment');
        } else {
          setActiveTab('queue');
        }
      } else {
        alert('Gagal menyimpan pesanan manual: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating manual order:', error);
      alert('Gagal menyimpan pesanan manual');
    }
  };

  const openEditOrderModal = (order: any) => {
    setEditingOrder({
      ...order,
      paymentMethod: order.paymentMethod || 'cash'
    });
    setShowEditOrder(true);
  };

  const handleUpdateOrderPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder?.id) return;
    
    const result = await updateOrderPaymentMethod(editingOrder.id, editingOrder.paymentMethod);
    if (result.success) {
      alert('Metode pembayaran berhasil diupdate!');
      setShowEditOrder(false);
      setEditingOrder(null);
      if (showHistoryTable) {
        handleViewHistory();
      }
    } else {
      alert('Gagal mengupdate metode pembayaran: ' + result.error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingOrder?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      const result = await updateOrderPaymentProof(editingOrder.id, base64String);
      if (result.success) {
        alert('Bukti pembayaran berhasil diupload!');
        setEditingOrder({
          ...editingOrder,
          paymentProof: base64String,
          paymentStatus: 'paid'
        });
      } else {
        alert('Gagal mengupload bukti pembayaran: ' + result.error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleViewHistory = async () => {
    if (!historyStartDate || !historyEndDate) {
      alert('Silakan pilih rentang tanggal terlebih dahulu');
      return;
    }

    setHistoryLoading(true);
    const result = await getOrdersByDateRange(historyStartDate, historyEndDate);
    if (result.success) {
      setHistoryOrders(result.orders);
      setShowHistoryTable(true);
    } else {
      alert('Gagal memuat data: ' + result.error);
    }
    setHistoryLoading(false);
  };

  const downloadExcel = (type: 'daily' | 'monthly' | 'yearly') => {
    let filteredOrders: any[] = [];
    let filename = '';

    const now = new Date();

    switch (type) {
      case 'daily':
        const today = now.toISOString().split('T')[0];
        filteredOrders = todayCompletedOrders;
        filename = `penjualan-harian-${today}.csv`;
        break;
      case 'monthly':
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        filteredOrders = completedOrders.filter(order => {
          const completedDate = order.completedAt?.toDate?.();
          if (!completedDate) return false;
          return completedDate.getMonth() + 1 === currentMonth && completedDate.getFullYear() === currentYear;
        });
        filename = `penjualan-bulanan-${currentYear}-${currentMonth.toString().padStart(2, '0')}.csv`;
        break;
      case 'yearly':
        const year = now.getFullYear();
        filteredOrders = completedOrders.filter(order => {
          const completedDate = order.completedAt?.toDate?.();
          if (!completedDate) return false;
          return completedDate.getFullYear() === year;
        });
        filename = `penjualan-tahunan-${year}.csv`;
        break;
    }

    if (filteredOrders.length === 0) {
      alert('Tidak ada data untuk diunduh');
      return;
    }

    const headers = ['Waktu Selesai', 'Nama Pelanggan', 'Email', 'Item Pesanan', 'Total (Rp)', 'Metode Pembayaran', 'Catatan'];
    const rows = filteredOrders.map(order => {
      const items = order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join('; ') || '';
      return [
        order.completedAt?.toDate?.().toLocaleString('id-ID') || '-',
        order.userName || '-',
        order.userEmail || '-',
        items,
        order.totalAmount || 0,
        order.paymentMethod || '-',
        order.notes || '-'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return '⏰ EXPIRED';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: {[key: string]: string} = {
      'cash': '💵 Tunai',
      'e-money': '💳 E-Money',
      'transfer': '🏦 Transfer',
      'shopeepay': '🧡 ShopeePay',
      'manual': '✍️ Manual'
    };
    return labels[method] || method;
  };

  const getPaymentMethodColor = (method: string) => {
    const colors: {[key: string]: string} = {
      'cash': 'bg-green-500',
      'e-money': 'bg-blue-500',
      'transfer': 'bg-purple-500',
      'shopeepay': 'bg-orange-500',
      'manual': 'bg-gray-500'
    };
    return colors[method] || 'bg-gray-500';
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
      await logoutUser();
      router.push('/');
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="text-indigo-400">Loading...</span>
      </div>
    </div>
  );
  
  if (!isAdmin) return null;

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-3 rounded-xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <span className="text-xl sm:text-2xl">🍵</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent truncate">
                Admin Command Center
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm font-medium hidden sm:block">NeedTea Management System</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto justify-center sm:justify-end">
            <div className="flex items-center space-x-2 px-3 py-2 bg-slate-800/50 rounded-full border border-slate-700 min-w-0">
              <span className="text-indigo-400 flex-shrink-0">👑</span>
              <span className="text-slate-300 font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">{userData?.name}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="group flex items-center space-x-1 sm:space-x-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all duration-300 hover:scale-105 flex-shrink-0"
            >
              <span className="text-red-400 group-hover:text-red-300">🚪</span>
              <span className="text-red-400 font-medium text-sm hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border-b border-slate-800 overflow-x-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex space-x-1 min-w-max">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'manual', label: 'Buat Pesanan', icon: '✍️' },
            { key: 'queue', label: `Antrian`, icon: '⏳', count: pendingOrders.length },
            { key: 'payment', label: `Konfirmasi Bayar`, icon: '💳', count: awaitingPaymentOrders.length },
            { key: 'menu', label: 'Kelola Menu', icon: '🍽️' },
            { key: 'history', label: 'Riwayat', icon: '📜' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`relative px-3 sm:px-6 py-3 sm:py-4 font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 whitespace-nowrap group text-sm sm:text-base ${
                activeTab === tab.key 
                  ? 'text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="group-hover:scale-110 transition-transform">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-8">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Ringkasan Operasional</h2>
              <span className="text-slate-500 text-sm sm:text-base">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700 hover:border-green-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1 sm:mb-2">Antrian Menunggu</p>
                  <p className="text-3xl sm:text-5xl font-bold text-green-400">{pendingOrders.length}</p>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700 hover:border-orange-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1 sm:mb-2">Menunggu Pembayaran</p>
                  <p className="text-3xl sm:text-5xl font-bold text-orange-400">{awaitingPaymentOrders.length}</p>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1 sm:mb-2">Total Menu Aktif</p>
                  <p className="text-3xl sm:text-5xl font-bold text-blue-400">{menuItems.length}</p>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1 sm:mb-2">Pendapatan Hari Ini</p>
                  <p className="text-xl sm:text-3xl font-bold text-emerald-400">
                    Rp {todayStats.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 text-slate-200">Total Penjualan Hari Ini</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700">
                  <p className="text-slate-400 text-xs sm:text-sm mb-2">Total Pesanan Selesai</p>
                  <p className="text-2xl sm:text-4xl font-bold text-indigo-400">{todayStats.totalOrders}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700">
                  <p className="text-slate-400 text-xs sm:text-sm mb-2">Total Item Terjual</p>
                  <p className="text-2xl sm:text-4xl font-bold text-purple-400">{todayStats.totalItems}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700">
                  <p className="text-slate-400 text-xs sm:text-sm mb-2">Rata-rata Nilai Pesanan</p>
                  <p className="text-2xl sm:text-4xl font-bold text-pink-400">
                    Rp {todayStats.totalOrders > 0 ? Math.round(todayStats.totalRevenue / todayStats.totalOrders).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-slate-700/50 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
                <h3 className="text-base sm:text-lg font-bold text-slate-200">Statistik Bulanan</h3>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  >
                    {[2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <button
                    onClick={downloadMonthlyReport}
                    disabled={statsLoading || !monthlyStats}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-lg font-medium text-sm transition-all flex items-center space-x-2"
                  >
                    <span>📥</span>
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {statsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : monthlyStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Total Pendapatan</p>
                      <p className="text-xl font-bold text-emerald-400">Rp {monthlyStats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Total Pesanan</p>
                      <p className="text-xl font-bold text-blue-400">{monthlyStats.totalOrders}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Total Item</p>
                      <p className="text-xl font-bold text-purple-400">{monthlyStats.totalItems}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Pembatalan</p>
                      <p className="text-xl font-bold text-red-400">{monthlyStats.totalCancelled}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <h4 className="font-semibold mb-4 text-slate-200">Penjualan per Item</h4>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {monthlyStats.itemSales.length > 0 ? monthlyStats.itemSales.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                            <div>
                              <p className="font-medium text-slate-200 text-sm">{item.name}</p>
                              <p className="text-xs text-slate-500">{item.quantity} terjual</p>
                            </div>
                            <p className="font-bold text-emerald-400 text-sm">Rp {item.revenue.toLocaleString()}</p>
                          </div>
                        )) : (
                          <p className="text-slate-500 text-center py-4">Tidak ada data penjualan</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <h4 className="font-semibold mb-4 text-slate-200">Metode Pembayaran</h4>
                      <div className="space-y-3">
                        {Object.entries(monthlyStats.paymentMethods).length > 0 ? Object.entries(monthlyStats.paymentMethods).map(([method, data]: [string, any], idx: number) => (
                          <div key={idx} className="p-3 bg-slate-900/50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-slate-200 text-sm">{getPaymentMethodLabel(method)}</span>
                              <span className="text-xs text-slate-400">{data.count} transaksi</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                              <div 
                                className={`h-2 rounded-full ${getPaymentMethodColor(method)}`}
                                style={{ width: `${monthlyStats.totalOrders > 0 ? (data.count / monthlyStats.totalOrders) * 100 : 0}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-emerald-400 font-medium">Rp {data.amount.toLocaleString()}</p>
                          </div>
                        )) : (
                          <p className="text-slate-500 text-center py-4">Tidak ada data pembayaran</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <h4 className="font-semibold mb-4 text-slate-200">Pendapatan Harian</h4>
                    <div className="h-64 flex items-end space-x-2 overflow-x-auto pb-2">
                      {monthlyStats.dailyRevenue.length > 0 ? monthlyStats.dailyRevenue.map((day: any, idx: number) => {
                        const maxAmount = Math.max(...monthlyStats.dailyRevenue.map((d: any) => d.amount));
                        const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                        return (
                          <div key={idx} className="flex flex-col items-center min-w-[40px] flex-1">
                            <div 
                              className="w-full bg-indigo-500/50 hover:bg-indigo-500 rounded-t transition-all relative group"
                              style={{ height: `${Math.max(height, 5)}%` }}
                            >
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700">
                                Rp {day.amount.toLocaleString()}
                              </div>
                            </div>
                            <span className="text-xs text-slate-500 mt-2">{day.date.split('-')[2]}</span>
                          </div>
                        );
                      }) : (
                        <div className="w-full flex items-center justify-center text-slate-500">Tidak ada data harian</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p>Tidak ada data untuk bulan ini</p>
                </div>
              )}
            </div>

            <div className="bg-slate-800/30 rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 text-slate-200">Aksi Cepat</h3>
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <button 
                  onClick={() => setActiveTab('manual')}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-indigo-500/25 flex items-center space-x-2 text-sm sm:text-base"
                >
                  <span>✍️</span>
                  <span>Buat Pesanan Manual</span>
                </button>
                <button 
                  onClick={() => setActiveTab('queue')}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2 text-sm sm:text-base"
                >
                  <span>⏳</span>
                  <span>Kelola Antrian</span>
                </button>
                <button 
                  onClick={() => setActiveTab('payment')}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2 text-sm sm:text-base ${
                    awaitingPaymentOrders.length > 0 
                      ? 'bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-500/25' 
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <span>💳</span>
                  <span>Konfirmasi Pembayaran {awaitingPaymentOrders.length > 0 && `(${awaitingPaymentOrders.length})`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                Buat Pesanan Manual
              </h2>
              <p className="text-slate-500 text-sm sm:text-base px-4">Buat pesanan untuk pelanggan. Pesanan non-tunai akan masuk ke konfirmasi pembayaran.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
              <div className="space-y-4 sm:space-y-6 order-2 md:order-1">
                <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Nama Pelanggan *</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama pelanggan..."
                    value={manualOrder.customerName}
                    onChange={(e) => setManualOrder(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm sm:text-base"
                  />
                </div>

                <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Metode Pembayaran</label>
                  <select
                    value={manualOrder.paymentMethod}
                    onChange={(e) => setManualOrder(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm sm:text-base"
                  >
                    <option value="cash">💵 Tunai (Langsung ke Antrian)</option>
                    <option value="e-money">💳 E-Money (Perlu Konfirmasi)</option>
                    <option value="transfer">🏦 Transfer Bank (Perlu Konfirmasi)</option>
                    <option value="shopeepay">🧡 ShopeePay (Perlu Konfirmasi)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    {['e-money', 'transfer', 'shopeepay'].includes(manualOrder.paymentMethod) 
                      ? 'Pesanan akan masuk ke halaman Konfirmasi Pembayaran dengan timer 30 menit' 
                      : 'Pesanan akan langsung masuk ke Antrian'}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Catatan (Opsional)</label>
                  <textarea
                    placeholder="Catatan khusus untuk pesanan..."
                    value={manualOrder.notes}
                    onChange={(e) => setManualOrder(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none text-sm sm:text-base"
                    rows={3}
                  />
                </div>

                {manualOrder.items.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-indigo-500/30">
                    <h3 className="font-bold text-base sm:text-lg mb-4 text-indigo-300">Ringkasan Pesanan</h3>
                    <div className="space-y-3 mb-4">
                      {manualOrder.items.map((item) => (
                        <div key={item.menuId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/50 p-3 rounded-lg gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-200 text-sm sm:text-base truncate">{item.name}</p>
                            <p className="text-xs sm:text-sm text-slate-500">Rp {item.price.toLocaleString()} x {item.quantity}</p>
                          </div>
                          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-800 rounded-lg p-1">
                              <button
                                onClick={() => handleUpdateQuantity(item.menuId, item.quantity - 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors text-sm"
                              >
                                -
                              </button>
                              <span className="w-6 sm:w-8 text-center font-medium text-sm">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item.menuId, item.quantity + 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors text-sm"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => handleRemoveFromManualCart(item.menuId)}
                              className="text-red-400 hover:text-red-300 p-2"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-indigo-500/30 pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-400 text-sm sm:text-base">Total</span>
                        <span className="text-xl sm:text-2xl font-bold text-indigo-400">Rp {calculateManualTotal().toLocaleString()}</span>
                      </div>
                      <button
                        onClick={handleSaveManualOrder}
                        className="w-full py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                      >
                        🚀 Buat Pesanan
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700/50 max-h-[500px] sm:max-h-[600px] overflow-y-auto order-1 md:order-2">
                <h3 className="font-bold text-base sm:text-lg mb-4 text-slate-200">Pilih Menu</h3>
                <div className="space-y-2 sm:space-y-3">
                  {menuItems.map((item) => {
                    const availableStock = getAvailableStock(item.id);
                    const isOutOfStock = availableStock <= 0;
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between p-3 sm:p-4 bg-slate-800 rounded-xl border transition-all ${
                          isOutOfStock 
                            ? 'border-slate-700 opacity-50 cursor-not-allowed' 
                            : 'border-slate-700 hover:border-indigo-500/50 cursor-pointer group'
                        }`}
                        onClick={() => !isOutOfStock && handleAddToManualCart(item)}
                      >
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-700 rounded-lg flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <span>{item.category === 'food' ? '🍰' : '🥤'}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-200 group-hover:text-indigo-400 transition-colors text-sm sm:text-base truncate">{item.name}</p>
                            <p className="text-xs sm:text-sm text-slate-500">Rp {item.price?.toLocaleString()}</p>
                            <p className={`text-xs mt-1 ${isOutOfStock ? 'text-red-400' : availableStock < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                              Stok: {availableStock}
                            </p>
                          </div>
                        </div>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                          isOutOfStock 
                            ? 'bg-slate-700 text-slate-500' 
                            : 'bg-slate-700 group-hover:bg-indigo-600'
                        }`}>
                          <span className="text-lg sm:text-xl">{isOutOfStock ? '✕' : '+'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-2">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Antrian Pesanan</h2>
                <p className="text-slate-500 mt-1 text-sm sm:text-base">{pendingOrders.length} pesanan menunggu diproses</p>
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="bg-slate-800/30 rounded-2xl sm:rounded-3xl p-8 sm:p-16 text-center border border-slate-700/50 border-dashed">
                <div className="text-4xl sm:text-6xl mb-4 opacity-50">✨</div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-400">Tidak ada antrian</h3>
                <p className="text-slate-600 mt-2 text-sm sm:text-base">Semua pesanan telah diproses</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6">
                {pendingOrders.map((order, index) => (
                  <div 
                    key={order.id} 
                    className={`relative overflow-hidden bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 transition-all duration-300 ${
                      index === 0 
                        ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10' 
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {index === 0 && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                    )}
                    
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 sm:space-x-3 mb-2 flex-wrap gap-y-2">
                          <span className="text-2xl sm:text-3xl font-bold text-yellow-400">#{index + 1}</span>
                          {index === 0 && (
                            <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 sm:px-3 py-1 rounded-full font-bold border border-yellow-500/30">
                              SEDANG DIPROSES
                            </span>
                          )}
                          {order.isManualOrder && (
                            <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 sm:px-3 py-1 rounded-full font-bold border border-indigo-500/30">
                              MANUAL
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-slate-500 text-xs sm:text-sm mb-2">{order.id.slice(-8)}</p>
                        <p className="text-white font-bold text-lg sm:text-xl">{order.userName}</p>
                        <p className="text-slate-400 text-xs sm:text-sm truncate">{order.userEmail}</p>
                      </div>

                      <div className="text-left lg:text-right w-full lg:w-auto">
                        <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                          Rp {order.totalAmount?.toLocaleString()}
                        </p>
                        <div className="mt-2 inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-slate-700 text-slate-300">
                          {getPaymentMethodLabel(order.paymentMethod)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-6 bg-slate-900/50 rounded-xl p-3 sm:p-4">
                      <p className="text-slate-500 text-xs sm:text-sm mb-2 sm:mb-3 font-medium">Detail Pesanan:</p>
                      <div className="space-y-1 sm:space-y-2">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs sm:text-sm py-1.5 sm:py-2 border-b border-slate-800 last:border-0">
                            <span className="text-slate-300">{item.quantity}x {item.name}</span>
                            <span className="text-slate-400">Rp {item.subtotal?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <div className="mt-3 p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-yellow-400 text-xs sm:text-sm">📝 {order.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                      <button
                        onClick={() => handleCompleteOrder(order.id)}
                        className="flex-1 py-3 sm:py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 shadow-lg shadow-green-500/20 text-sm sm:text-base"
                      >
                        <span>✅</span>
                        <span>Pesanan Selesai</span>
                      </button>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="px-4 sm:px-8 py-3 sm:py-4 bg-slate-700 hover:bg-red-600/20 hover:text-red-400 rounded-xl transition-all duration-300 border border-slate-600 hover:border-red-500/30 text-sm sm:text-base"
                      >
                        ❌ Batal
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payment' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Konfirmasi Pembayaran</h2>
                <p className="text-slate-500 mt-1 text-sm sm:text-base">{awaitingPaymentOrders.length} pesanan menunggu pembayaran (30 menit)</p>
              </div>
              <button 
                onClick={() => cancelExpiredAwaitingPaymentOrders()}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 transition-all duration-300 flex items-center space-x-2 text-sm sm:text-base"
              >
                <span>🧹</span>
                <span>Bersihkan Expired</span>
              </button>
            </div>

            {awaitingPaymentOrders.length === 0 ? (
              <div className="bg-slate-800/30 rounded-2xl sm:rounded-3xl p-8 sm:p-16 text-center border border-slate-700/50 border-dashed">
                <div className="text-4xl sm:text-6xl mb-4 opacity-50">💳</div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-400">Tidak ada pesanan menunggu</h3>
                <p className="text-slate-600 mt-2 text-sm sm:text-base">Semua pembayaran telah dikonfirmasi atau belum ada pesanan non-tunai</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6">
                {awaitingPaymentOrders.map((order, index) => {
                  const remainingSeconds = paymentTimers[order.id] || 0;
                  const isExpired = remainingSeconds <= 0;
                  
                  return (
                    <div 
                      key={order.id} 
                      className={`relative overflow-hidden bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 transition-all duration-300 ${
                        isExpired 
                          ? 'border-red-500/30 opacity-75' 
                          : remainingSeconds < 300 
                            ? 'border-red-500/50 shadow-lg shadow-red-500/10' 
                            : 'border-orange-500/30 hover:border-orange-500/50'
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-full h-1 ${
                        isExpired 
                          ? 'bg-red-500' 
                          : remainingSeconds < 300 
                            ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                            : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                      }`}></div>
                      
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 sm:space-x-3 mb-2 flex-wrap gap-y-2">
                            <span className="text-2xl sm:text-3xl font-bold text-orange-400">#{index + 1}</span>
                            <span className="bg-orange-500/20 text-orange-400 text-xs px-2 sm:px-3 py-1 rounded-full font-bold border border-orange-500/30">
                              MENUNGGU PEMBAYARAN
                            </span>
                            {order.isManualOrder && (
                              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 sm:px-3 py-1 rounded-full font-bold border border-indigo-500/30">
                                MANUAL
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-slate-500 text-xs sm:text-sm mb-2">{order.id.slice(-8)}</p>
                          <p className="text-white font-bold text-lg sm:text-xl">{order.userName}</p>
                          <p className="text-slate-400 text-xs sm:text-sm truncate">{order.userEmail}</p>
                        </div>

                        <div className="text-left lg:text-right w-full lg:w-auto">
                          <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                            Rp {order.totalAmount?.toLocaleString()}
                          </p>
                          <div className="mt-2 inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-slate-700 text-slate-300">
                            {getPaymentMethodLabel(order.paymentMethod)}
                          </div>
                          <div className={`mt-2 sm:mt-3 font-mono font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg inline-block text-xs sm:text-sm ${
                            isExpired 
                              ? 'bg-red-500/20 text-red-400' 
                              : remainingSeconds < 300 
                                ? 'bg-red-500/20 text-red-400 animate-pulse' 
                                : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            ⏱️ {formatTimeRemaining(remainingSeconds)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-6 bg-slate-900/50 rounded-xl p-3 sm:p-4">
                        <p className="text-slate-500 text-xs sm:text-sm mb-2 sm:mb-3 font-medium">Detail Pesanan:</p>
                        <div className="space-y-1 sm:space-y-2">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs sm:text-sm py-1.5 sm:py-2 border-b border-slate-800 last:border-0">
                              <span className="text-slate-300">{item.quantity}x {item.name}</span>
                              <span className="text-slate-400">Rp {item.subtotal?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        {order.notes && (
                          <div className="mt-3 p-2 sm:p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-yellow-400 text-xs sm:text-sm">📝 {order.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                        {!isExpired ? (
                          <button
                            onClick={() => handleConfirmPaymentAndMoveToQueue(order.id)}
                            className="flex-1 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20 text-sm sm:text-base"
                          >
                            <span>✅</span>
                            <span>Konfirmasi & Pindahkan ke Antrian</span>
                          </button>
                        ) : (
                          <div className="flex-1 py-3 sm:py-4 bg-red-500/20 text-red-400 rounded-xl font-bold flex items-center justify-center space-x-2 border border-red-500/30 text-sm sm:text-base">
                            <span>⏰</span>
                            <span>Pesanan Kedaluwarsa</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-4 sm:px-8 py-3 sm:py-4 bg-slate-700 hover:bg-red-600/20 hover:text-red-400 rounded-xl transition-all duration-300 border border-slate-600 hover:border-red-500/30 text-sm sm:text-base"
                        >
                          ❌ Batal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Kelola Menu</h2>
              <button
                onClick={() => setShowAddMenu(true)}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg sm:rounded-xl font-bold transition-all duration-300 hover:scale-105 shadow-lg shadow-indigo-500/25 flex items-center space-x-2 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <span>+</span>
                <span>Tambah Menu</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {menuItems.map((item) => (
                <div key={item.id} className="group bg-slate-800 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
                  <div className="h-40 sm:h-48 bg-slate-700 relative overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl sm:text-6xl bg-slate-800">
                        {item.category === 'food' ? '🍰' : '🥤'}
                      </div>
                    )}
                    <div className={`absolute top-3 sm:top-4 right-3 sm:right-4 px-2 sm:px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md ${
                      (item.stock || 0) > 10 
                        ? 'bg-green-500/80 text-white' 
                        : (item.stock || 0) > 0 
                          ? 'bg-yellow-500/80 text-black' 
                          : 'bg-red-500/80 text-white'
                    }`}>
                      Stok: {item.stock || 0}
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="flex justify-between items-start mb-2 sm:mb-3 gap-2">
                      <h3 className="font-bold text-lg sm:text-xl text-slate-100 truncate flex-1">{item.name}</h3>
                      <span className="text-indigo-400 font-bold text-base sm:text-lg flex-shrink-0">Rp {item.price?.toLocaleString()}</span>
                    </div>
                    <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{item.description}</p>
                    
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                        item.category === 'food' 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {item.category === 'food' ? '🍰 Makanan' : '🥤 Minuman'}
                      </span>
                      <span className={`text-xs font-medium ${
                        (item.stock || 0) === 0 ? 'text-red-400' : (item.stock || 0) < 5 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {(item.stock || 0) === 0 ? '❌ Habis' : (item.stock || 0) < 5 ? '⚠️ Hampir Habis' : '✅ Tersedia'}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2 sm:space-x-3">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex-1 py-2 sm:py-3 bg-slate-700 hover:bg-blue-600/20 hover:text-blue-400 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 border border-slate-600 hover:border-blue-500/30"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMenu(item.id)}
                        className="flex-1 py-2 sm:py-3 bg-slate-700 hover:bg-red-600/20 hover:text-red-400 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 border border-slate-600 hover:border-red-500/30"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">Riwayat Pesanan</h2>
              <p className="text-slate-500 text-sm sm:text-base">Pilih rentang tanggal untuk melihat riwayat transaksi.</p>
            </div>

            <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700 mb-6 sm:mb-8">
              <h3 className="font-bold text-base sm:text-lg mb-4 text-slate-200">Filter & Export</h3>
              <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs sm:text-sm text-slate-400 mb-2">Dari Tanggal</label>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => {
                      setHistoryStartDate(e.target.value);
                      setShowHistoryTable(false);
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs sm:text-sm text-slate-400 mb-2">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => {
                      setHistoryEndDate(e.target.value);
                      setShowHistoryTable(false);
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
                  />
                </div>
                <button
                  onClick={handleViewHistory}
                  disabled={historyLoading}
                  className="w-full md:w-auto px-6 sm:px-8 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-bold transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 text-sm sm:text-base disabled:opacity-50"
                >
                  <span>🔍</span>
                  <span>{historyLoading ? 'Memuat...' : 'Lihat Riwayat'}</span>
                </button>
              </div>

              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700">
                <p className="text-xs sm:text-sm text-slate-400 mb-3">Export Data:</p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={() => downloadExcel('daily')}
                    className="px-3 sm:px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg transition-all text-xs sm:text-sm border border-emerald-500/30"
                  >
                    📥 Harian
                  </button>
                  <button
                    onClick={() => downloadExcel('monthly')}
                    className="px-3 sm:px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-all text-xs sm:text-sm border border-blue-500/30"
                  >
                    📥 Bulanan
                  </button>
                  <button
                    onClick={() => downloadExcel('yearly')}
                    className="px-3 sm:px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition-all text-xs sm:text-sm border border-purple-500/30"
                  >
                    📥 Tahunan
                  </button>
                </div>
              </div>
            </div>

            {showHistoryTable && (
              <div className="bg-slate-800/30 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700/50">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-400">Waktu Selesai</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-400">Pelanggan</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-400">Item</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-slate-400">Total</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-slate-400">Metode</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-slate-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {historyOrders.map((order) => (
                        <tr 
                          key={order.id} 
                          className="hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-400 text-xs sm:text-sm">
                            {order.completedAt?.toDate?.().toLocaleString('id-ID') || '-'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <p className="font-medium text-slate-200 text-sm sm:text-base">{order.userName}</p>
                            <p className="text-slate-500 text-xs sm:text-sm truncate max-w-[150px]">{order.userEmail}</p>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-400">
                            {order.items?.length} item
                            <div className="text-xs text-slate-600 mt-1 truncate max-w-[200px]">
                              {order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-emerald-400 text-sm sm:text-base">
                            Rp {order.totalAmount?.toLocaleString()}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-medium">
                              {getPaymentMethodLabel(order.paymentMethod)}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                            <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                              <button
                                onClick={() => openEditOrderModal(order)}
                                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleDeleteHistoryOrder(order.id)}
                                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs sm:text-sm font-medium transition-colors border border-red-500/30"
                              >
                                🗑️ Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historyOrders.length === 0 && (
                  <div className="p-8 sm:p-12 text-center text-slate-500">
                    <div className="text-3xl sm:text-4xl mb-4">📭</div>
                    <p className="text-sm sm:text-base">Tidak ada riwayat pesanan pada rentang tanggal tersebut</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

{showAddMenu && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
    <div className="bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-8 w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-slate-100">Tambah Menu Baru</h3>
      <form onSubmit={handleAddMenu} className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Nama Menu</label>
          <input
            type="text"
            placeholder="Nama menu"
            value={newMenu.name}
            onChange={(e) => setNewMenu({...newMenu, name: e.target.value})}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
            required
          />
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Deskripsi</label>
          <textarea
            placeholder="Deskripsi menu"
            value={newMenu.description}
            onChange={(e) => setNewMenu({...newMenu, description: e.target.value})}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none resize-none text-sm sm:text-base"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm text-slate-400 mb-2">Harga (Rp)</label>
            <input
              type="number"
              placeholder="Harga"
              value={newMenu.price}
              onChange={(e) => setNewMenu({...newMenu, price: e.target.value})}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm text-slate-400 mb-2">Stok</label>
            <input
              type="number"
              placeholder="Jumlah stok"
              value={newMenu.stock}
              onChange={(e) => setNewMenu({...newMenu, stock: e.target.value})}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
              min="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Kategori</label>
          <select
            value={newMenu.category}
            onChange={(e) => setNewMenu({...newMenu, category: e.target.value})}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
          >
            <option value="food">🍰 Makanan</option>
            <option value="drink">🥤 Minuman</option>
          </select>
        </div>

        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Gambar (Opsional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleMenuImageUpload(e, 'add')}
            className="hidden"
            id="menu-image-add"
          />
          
          {newMenu.image ? (
            <div className="space-y-3">
              <div className="relative w-full h-40 sm:h-48 bg-slate-900 rounded-xl overflow-hidden">
                <img 
                  src={newMenu.image} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex space-x-2 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('menu-image-add')?.click()}
                  className="flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base"
                >
                  🔄 Ganti Gambar
                </button>
                <button
                  type="button"
                  onClick={() => setNewMenu({...newMenu, image: ''})}
                  className="flex-1 py-2.5 sm:py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base"
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          ) : (
            <label 
              htmlFor="menu-image-add"
              className="w-full py-6 sm:py-8 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl text-slate-400 hover:text-indigo-400 transition-all flex flex-col items-center space-y-2 cursor-pointer"
            >
              <span className="text-2xl sm:text-3xl">📷</span>
              <span className="text-sm sm:text-base">Klik untuk upload gambar</span>
              <span className="text-xs text-slate-500">Maksimal 2MB</span>
            </label>
          )}
        </div>

        <div className="flex space-x-2 sm:space-x-3 pt-2 sm:pt-4">
          <button type="submit" className="flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-bold transition-all text-sm sm:text-base">
            Simpan
          </button>
          <button 
            type="button" 
            onClick={() => {
              setShowAddMenu(false);
              setNewMenu({ name: '', description: '', price: '', category: 'food', image: '', stock: '' });
            }} 
            className="flex-1 py-2.5 sm:py-3 bg-slate-700 hover:bg-slate-600 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {showEditMenu && editingMenu && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
    <div className="bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-8 w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-slate-100">Edit Menu</h3>
      <form onSubmit={handleEditMenu} className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Nama Menu</label>
          <input
            type="text"
            value={editingMenu.name}
            onChange={(e) => setEditingMenu({...editingMenu, name: e.target.value})}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
            required
          />
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Deskripsi</label>
          <textarea
            value={editingMenu.description || ''}
            onChange={(e) => setEditingMenu({...editingMenu, description: e.target.value})}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none resize-none text-sm sm:text-base"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm text-slate-400 mb-2">Harga (Rp)</label>
            <input
              type="number"
              value={editingMenu.price}
              onChange={(e) => setEditingMenu({...editingMenu, price: e.target.value})}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm text-slate-400 mb-2">Stok</label>
            <input
              type="number"
              value={editingMenu.stock}
              onChange={(e) => setEditingMenu({...editingMenu, stock: e.target.value})}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
              min="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Kategori</label>
          <select
            value={editingMenu.category}
            onChange={(e) => setEditingMenu({...editingMenu, category: e.target.value})}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
          >
            <option value="food">🍰 Makanan</option>
            <option value="drink">🥤 Minuman</option>
          </select>
        </div>

        <div>
          <label className="block text-xs sm:text-sm text-slate-400 mb-2">Gambar (Opsional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleMenuImageUpload(e, 'edit')}
            className="hidden"
            id="menu-image-edit"
          />
          
          {editingMenu.image ? (
            <div className="space-y-3">
              <div className="relative w-full h-40 sm:h-48 bg-slate-900 rounded-xl overflow-hidden">
                <img 
                  src={editingMenu.image} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex space-x-2 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('menu-image-edit')?.click()}
                  className="flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base"
                >
                  🔄 Ganti Gambar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMenu({...editingMenu, image: ''})}
                  className="flex-1 py-2.5 sm:py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base"
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          ) : (
            <label 
              htmlFor="menu-image-edit"
              className="w-full py-6 sm:py-8 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl text-slate-400 hover:text-indigo-400 transition-all flex flex-col items-center space-y-2 cursor-pointer"
            >
              <span className="text-2xl sm:text-3xl">📷</span>
              <span className="text-sm sm:text-base">Klik untuk upload gambar</span>
              <span className="text-xs text-slate-500">Maksimal 2MB</span>
            </label>
          )}
        </div>

        <div className="flex space-x-2 sm:space-x-3 pt-2 sm:pt-4">
          <button type="submit" className="flex-1 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 rounded-lg sm:rounded-xl font-bold transition-all text-sm sm:text-base">
            Update
          </button>
          <button 
            type="button" 
            onClick={() => {
              setShowEditMenu(false);
              setEditingMenu(null);
            }} 
            className="flex-1 py-2.5 sm:py-3 bg-slate-700 hover:bg-slate-600 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {showEditOrder && editingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-8 w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-slate-100">Edit Detail Pembayaran</h3>
            
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-900/50 rounded-xl">
              <p className="text-slate-400 text-xs sm:text-sm mb-1">Pesanan</p>
              <p className="text-white font-bold text-sm sm:text-base">{editingOrder.userName}</p>
              <p className="text-emerald-400 font-bold text-base sm:text-lg">Rp {editingOrder.totalAmount?.toLocaleString()}</p>
            </div>

            <form onSubmit={handleUpdateOrderPaymentMethod} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs sm:text-sm text-slate-400 mb-2">Metode Pembayaran</label>
                <select
                  value={editingOrder.paymentMethod}
                  onChange={(e) => setEditingOrder({...editingOrder, paymentMethod: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl text-white focus:border-indigo-500 outline-none text-sm sm:text-base"
                >
                  <option value="cash">💵 Tunai (Cash)</option>
                  <option value="transfer">🏦 Transfer Bank</option>
                  <option value="e-money">💳 E-Money (OVO, GoPay, dll)</option>
                  <option value="shopeepay">🧡 ShopeePay</option>
                  <option value="manual">✍️ Manual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-slate-400 mb-2">Bukti Pembayaran</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                {editingOrder.paymentProof ? (
                  <div className="space-y-3">
                    <div className="relative w-full h-40 sm:h-48 bg-slate-900 rounded-xl overflow-hidden">
                      <img 
                        src={editingOrder.paymentProof} 
                        alt="Bukti Pembayaran" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex space-x-2 sm:space-x-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base"
                      >
                        🔄 Ganti Foto
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await updateOrderPaymentProof(editingOrder.id, '');
                          if (result.success) {
                            setEditingOrder({...editingOrder, paymentProof: '', paymentStatus: 'pending'});
                          }
                        }}
                        className="flex-1 py-2.5 sm:py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 sm:py-8 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl text-slate-400 hover:text-indigo-400 transition-all flex flex-col items-center space-y-2"
                  >
                    <span className="text-2xl sm:text-3xl">📷</span>
                    <span className="text-sm sm:text-base">Klik untuk upload bukti pembayaran</span>
                    <span className="text-xs text-slate-600">Maksimal 5MB</span>
                  </button>
                )}
              </div>

              <div className="flex space-x-2 sm:space-x-3 pt-2 sm:pt-4">
                <button type="submit" className="flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg sm:rounded-xl font-bold transition-all text-sm sm:text-base">
                  Simpan Perubahan
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditOrder(false);
                    setEditingOrder(null);
                  }} 
                  className="flex-1 py-2.5 sm:py-3 bg-slate-700 hover:bg-slate-600 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base"
                >
                  Tutup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}