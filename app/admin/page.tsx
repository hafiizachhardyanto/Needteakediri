'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getMenuItems, 
  addMenuItem, 
  deleteMenuItem,
  updateMenuItem,
  completeOrder,
  updateOrderStatus,
  getDailyStats,
  cancelExpiredOrders,
  subscribeToPendingOrders,
  createManualOrder,
  db,
  logoutUser
} from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { collection, getDocs, query, where, orderBy, Timestamp, addDoc } from 'firebase/firestore';

export default function AdminDashboard() {
  const router = useRouter();
  const { userData, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'daily' | 'menu' | 'history' | 'manual'>('dashboard');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
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

  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);

  const [manualOrder, setManualOrder] = useState({
    customerName: '',
    items: [] as { menuId: string; quantity: number; name: string; price: number }[],
    notes: ''
  });

  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');

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
        checkExpiredOrders(orders);
      });
      
      const interval = setInterval(() => {
        cancelExpiredOrders();
      }, 60000);
      
      return () => {
        unsubscribePending();
        clearInterval(interval);
      };
    }
  }, [isAdmin]);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      loadMenu(),
      loadCompletedOrders(),
      loadDailyStats()
    ]);
    setLoading(false);
  };

  const loadMenu = async () => {
    const result = await getMenuItems();
    if (result.success) {
      setMenuItems(result.items || []);
    }
  };

  const loadCompletedOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompletedOrders(orders);
    } catch (error) {
      console.error('Error loading completed orders:', error);
    }
  };

  const loadDailyStats = async () => {
    const result = await getDailyStats(selectedDate);
    if (result.success) {
      setDailyStats(result.stats);
    }
  };

  const checkExpiredOrders = (orders: any[]) => {
    const now = new Date();
    orders.forEach(order => {
      if (order.expiryTime?.toDate) {
        const expiry = order.expiryTime.toDate();
        if (now > expiry && order.status === 'pending') {
        }
      }
    });
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
      loadCompletedOrders();
      loadDailyStats();
    } else {
      alert('Gagal: ' + result.error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Batalkan pesanan ini?')) return;
    await updateOrderStatus(orderId, 'cancelled');
  };

  const handleAddToManualCart = (item: any) => {
    const existingItem = manualOrder.items.find(i => i.menuId === item.id);
    if (existingItem) {
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
          price: item.price 
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
    if (quantity <= 0) {
      handleRemoveFromManualCart(menuId);
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
      });
      
      if (result.success) {
        alert('Pesanan manual berhasil dibuat dan masuk ke antrian!');
        setManualOrder({ customerName: '', items: [], notes: '' });
        setActiveTab('queue');
      } else {
        alert('Gagal menyimpan pesanan manual: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating manual order:', error);
      alert('Gagal menyimpan pesanan manual');
    }
  };

  const downloadExcel = () => {
    let filteredOrders = completedOrders;
    
    if (historyStartDate && historyEndDate) {
      const start = new Date(historyStartDate);
      const end = new Date(historyEndDate);
      end.setHours(23, 59, 59, 999);
      
      filteredOrders = completedOrders.filter(order => {
        const completedDate = order.completedAt?.toDate?.();
        if (!completedDate) return false;
        return completedDate >= start && completedDate <= end;
      });
    }

    if (filteredOrders.length === 0) {
      alert('Tidak ada data untuk diunduh pada rentang tanggal tersebut');
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
    link.setAttribute('download', `riwayat-pesanan-${historyStartDate || 'all'}-to-${historyEndDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimeRemaining = (expiryTime: any) => {
    if (!expiryTime?.toDate) return '-';
    const now = new Date();
    const expiry = expiryTime.toDate();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return '⏰ EXPIRED';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
      await logoutUser();
      router.push('/');
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="text-indigo-400">Loading...</span>
      </div>
    </div>
  );
  
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-500/20">
              <span className="text-2xl">🍵</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Admin Command Center
              </h1>
              <p className="text-slate-500 text-sm font-medium">NeedTea Management System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <span className="text-indigo-400">👑</span>
              <span className="text-slate-300 font-medium">{userData?.name}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="group flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all duration-300 hover:scale-105"
            >
              <span className="text-red-400 group-hover:text-red-300">🚪</span>
              <span className="text-red-400 font-medium text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border-b border-slate-800 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex space-x-1">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'manual', label: 'Buat Pesanan', icon: '✍️' },
            { key: 'queue', label: `Antrian`, icon: '⏳', count: pendingOrders.length },
            { key: 'daily', label: 'Pesanan Harian', icon: '📅' },
            { key: 'menu', label: 'Kelola Menu', icon: '🍽️' },
            { key: 'history', label: 'Riwayat', icon: '📜' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`relative px-6 py-4 font-medium transition-all duration-300 flex items-center space-x-2 whitespace-nowrap group ${
                activeTab === tab.key 
                  ? 'text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="group-hover:scale-110 transition-transform">{tab.icon}</span>
              <span>{tab.label}</span>
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-slate-100">Ringkasan Operasional</h2>
              <span className="text-slate-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-green-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-sm font-medium mb-2">Antrian Menunggu</p>
                  <p className="text-5xl font-bold text-green-400">{pendingOrders.length}</p>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-sm font-medium mb-2">Total Menu Aktif</p>
                  <p className="text-5xl font-bold text-blue-400">{menuItems.length}</p>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                <div className="relative">
                  <p className="text-slate-400 text-sm font-medium mb-2">Pendapatan Hari Ini</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    Rp {dailyStats?.totalRevenue?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-6 text-slate-200">Aksi Cepat</h3>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setActiveTab('manual')}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
                >
                  <span>✍️</span>
                  <span>Buat Pesanan Manual</span>
                </button>
                <button 
                  onClick={() => setActiveTab('queue')}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2"
                >
                  <span>⏳</span>
                  <span>Kelola Antrian</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                Buat Pesanan Manual
              </h2>
              <p className="text-slate-500">Buat pesanan untuk pelanggan. Pesanan akan langsung masuk ke antrian.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Nama Pelanggan</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama pelanggan..."
                    value={manualOrder.customerName}
                    onChange={(e) => setManualOrder(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Catatan (Opsional)</label>
                  <textarea
                    placeholder="Catatan khusus untuk pesanan..."
                    value={manualOrder.notes}
                    onChange={(e) => setManualOrder(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    rows={3}
                  />
                </div>

                {manualOrder.items.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-2xl p-6 border border-indigo-500/30">
                    <h3 className="font-bold text-lg mb-4 text-indigo-300">Ringkasan Pesanan</h3>
                    <div className="space-y-3 mb-4">
                      {manualOrder.items.map((item) => (
                        <div key={item.menuId} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-200">{item.name}</p>
                            <p className="text-sm text-slate-500">Rp {item.price.toLocaleString()} x {item.quantity}</p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-slate-800 rounded-lg p-1">
                              <button
                                onClick={() => handleUpdateQuantity(item.menuId, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item.menuId, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
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
                        <span className="text-slate-400">Total</span>
                        <span className="text-2xl font-bold text-indigo-400">Rp {calculateManualTotal().toLocaleString()}</span>
                      </div>
                      <button
                        onClick={handleSaveManualOrder}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                      >
                        🚀 Buat Pesanan & Masukkan ke Antrian
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 max-h-[600px] overflow-y-auto">
                <h3 className="font-bold text-lg mb-4 text-slate-200">Pilih Menu</h3>
                <div className="space-y-3">
                  {menuItems.filter(item => (item.stock || 0) > 0).map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer group"
                      onClick={() => handleAddToManualCart(item)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center text-2xl">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <span>{item.category === 'food' ? '🍰' : '🥤'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">{item.name}</p>
                          <p className="text-sm text-slate-500">Rp {item.price?.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-slate-700 group-hover:bg-indigo-600 rounded-full flex items-center justify-center transition-all">
                        <span className="text-xl">+</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-100">Antrian Pesanan</h2>
                <p className="text-slate-500 mt-1">{pendingOrders.length} pesanan menunggu</p>
              </div>
              <button 
                onClick={() => cancelExpiredOrders()}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 transition-all duration-300 flex items-center space-x-2"
              >
                <span>🧹</span>
                <span>Bersihkan Expired</span>
              </button>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="bg-slate-800/30 rounded-3xl p-16 text-center border border-slate-700/50 border-dashed">
                <div className="text-6xl mb-4 opacity-50">✨</div>
                <h3 className="text-xl font-semibold text-slate-400">Tidak ada antrian</h3>
                <p className="text-slate-600 mt-2">Semua pesanan telah diproses</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {pendingOrders.map((order, index) => (
                  <div 
                    key={order.id} 
                    className={`relative overflow-hidden bg-slate-800 rounded-2xl p-6 border-2 transition-all duration-300 ${
                      index === 0 
                        ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10' 
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {index === 0 && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                    )}
                    
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-3xl font-bold text-yellow-400">#{index + 1}</span>
                          {index === 0 && (
                            <span className="bg-yellow-500/20 text-yellow-400 text-xs px-3 py-1 rounded-full font-bold border border-yellow-500/30">
                              SEDANG DIPROSES
                            </span>
                          )}
                          {order.isManualOrder && (
                            <span className="bg-indigo-500/20 text-indigo-400 text-xs px-3 py-1 rounded-full font-bold border border-indigo-500/30">
                              MANUAL
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-slate-500 text-sm mb-2">{order.id.slice(-8)}</p>
                        <p className="text-white font-bold text-xl">{order.userName}</p>
                        <p className="text-slate-400 text-sm">{order.userEmail}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-400">
                          Rp {order.totalAmount?.toLocaleString()}
                        </p>
                        <div className="mt-2 inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-slate-700 text-slate-300">
                          {order.paymentMethod === 'manual' ? '✍️ Manual' : order.paymentMethod === 'cash' ? '💵 Tunai' : '🧡 ShopeePay'}
                        </div>
                        <div className="mt-3 text-red-400 font-mono font-bold bg-red-500/10 px-4 py-2 rounded-lg inline-block">
                          ⏱️ {formatTimeRemaining(order.expiryTime)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 bg-slate-900/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-3 font-medium">Detail Pesanan:</p>
                      <div className="space-y-2">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm py-2 border-b border-slate-800 last:border-0">
                            <span className="text-slate-300">{item.quantity}x {item.name}</span>
                            <span className="text-slate-400">Rp {item.subtotal?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-yellow-400 text-sm">📝 {order.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => handleCompleteOrder(order.id)}
                        className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 shadow-lg shadow-green-500/20"
                      >
                        <span>✅</span>
                        <span>Pesanan Selesai</span>
                      </button>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="px-8 py-4 bg-slate-700 hover:bg-red-600/20 hover:text-red-400 rounded-xl transition-all duration-300 border border-slate-600 hover:border-red-500/30"
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

        {activeTab === 'daily' && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h2 className="text-3xl font-bold text-slate-100">Pesanan Harian</h2>
              <div className="flex items-center space-x-4 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    getDailyStats(e.target.value).then(r => {
                      if (r.success) setDailyStats(r.stats);
                    });
                  }}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Total Pesanan', value: dailyStats?.totalOrders || 0, color: 'blue', icon: '📋' },
                { label: 'Total Item', value: dailyStats?.totalItems || 0, color: 'purple', icon: '📦' },
                { label: 'Total Pendapatan', value: `Rp ${(dailyStats?.totalRevenue || 0).toLocaleString()}`, color: 'emerald', icon: '💰' },
                { label: 'Rata-rata Order', value: `Rp ${Math.round(dailyStats?.averageOrderValue || 0).toLocaleString()}`, color: 'yellow', icon: '📊' }
              ].map((stat, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">{stat.icon}</span>
                    <div className={`w-2 h-2 rounded-full bg-${stat.color}-500`}></div>
                  </div>
                  <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50 border-dashed">
              <div className="text-4xl mb-4">📈</div>
              <p className="text-slate-400">Statistik detail akan ditampilkan di sini</p>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-slate-100">Kelola Menu</h2>
              <button
                onClick={() => setShowAddMenu(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold transition-all duration-300 hover:scale-105 shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
              >
                <span>+</span>
                <span>Tambah Menu</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map((item) => (
                <div key={item.id} className="group bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
                  <div className="h-48 bg-slate-700 relative overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-slate-800">
                        {item.category === 'food' ? '🍰' : '🥤'}
                      </div>
                    )}
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md ${
                      (item.stock || 0) > 10 
                        ? 'bg-green-500/80 text-white' 
                        : (item.stock || 0) > 0 
                          ? 'bg-yellow-500/80 text-black' 
                          : 'bg-red-500/80 text-white'
                    }`}>
                      Stok: {item.stock || 0}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-xl text-slate-100">{item.name}</h3>
                      <span className="text-indigo-400 font-bold text-lg">Rp {item.price?.toLocaleString()}</span>
                    </div>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{item.description}</p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
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
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex-1 py-3 bg-slate-700 hover:bg-blue-600/20 hover:text-blue-400 rounded-xl text-sm font-medium transition-all duration-300 border border-slate-600 hover:border-blue-500/30"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMenu(item.id)}
                        className="flex-1 py-3 bg-slate-700 hover:bg-red-600/20 hover:text-red-400 rounded-xl text-sm font-medium transition-all duration-300 border border-slate-600 hover:border-red-500/30"
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
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-100 mb-2">Riwayat Pesanan</h2>
              <p className="text-slate-500">Kelola dan unduh riwayat transaksi</p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-8">
              <h3 className="font-bold text-lg mb-4 text-slate-200">Filter & Export</h3>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm text-slate-400 mb-2">Dari Tanggal</label>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-slate-400 mb-2">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <button
                  onClick={downloadExcel}
                  className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-xl font-bold transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 shadow-lg shadow-green-500/20"
                >
                  <span>📥</span>
                  <span>Unduh Excel</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-700/50">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Waktu Selesai</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Pelanggan</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Item</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Total</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {completedOrders.slice(0, 50).map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-slate-400 text-sm">
                          {order.completedAt?.toDate?.().toLocaleString('id-ID') || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-200">{order.userName}</p>
                          <p className="text-slate-500 text-sm">{order.userEmail}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {order.items?.length} item
                          <div className="text-xs text-slate-600 mt-1">
                            {order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-400">
                          Rp {order.totalAmount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium border border-emerald-500/20">
                            ✅ Selesai
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {completedOrders.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <div className="text-4xl mb-4">📭</div>
                  <p>Belum ada riwayat pesanan</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {showAddMenu && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 text-slate-100">Tambah Menu Baru</h3>
            <form onSubmit={handleAddMenu} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Nama Menu</label>
                <input
                  type="text"
                  placeholder="Nama menu"
                  value={newMenu.name}
                  onChange={(e) => setNewMenu({...newMenu, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Deskripsi</label>
                <textarea
                  placeholder="Deskripsi menu"
                  value={newMenu.description}
                  onChange={(e) => setNewMenu({...newMenu, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Harga (Rp)</label>
                  <input
                    type="number"
                    placeholder="Harga"
                    value={newMenu.price}
                    onChange={(e) => setNewMenu({...newMenu, price: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Stok</label>
                  <input
                    type="number"
                    placeholder="Jumlah stok"
                    value={newMenu.stock}
                    onChange={(e) => setNewMenu({...newMenu, stock: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Kategori</label>
                <select
                  value={newMenu.category}
                  onChange={(e) => setNewMenu({...newMenu, category: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                >
                  <option value="food">🍰 Makanan</option>
                  <option value="drink">🥤 Minuman</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">URL Gambar (opsional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={newMenu.image}
                  onChange={(e) => setNewMenu({...newMenu, image: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all">
                  Simpan
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddMenu(false);
                    setNewMenu({ name: '', description: '', price: '', category: 'food', image: '', stock: '' });
                  }} 
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditMenu && editingMenu && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 text-slate-100">Edit Menu</h3>
            <form onSubmit={handleEditMenu} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Nama Menu</label>
                <input
                  type="text"
                  value={editingMenu.name}
                  onChange={(e) => setEditingMenu({...editingMenu, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Deskripsi</label>
                <textarea
                  value={editingMenu.description || ''}
                  onChange={(e) => setEditingMenu({...editingMenu, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Harga (Rp)</label>
                  <input
                    type="number"
                    value={editingMenu.price}
                    onChange={(e) => setEditingMenu({...editingMenu, price: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Stok</label>
                  <input
                    type="number"
                    value={editingMenu.stock}
                    onChange={(e) => setEditingMenu({...editingMenu, stock: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Kategori</label>
                <select
                  value={editingMenu.category}
                  onChange={(e) => setEditingMenu({...editingMenu, category: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                >
                  <option value="food">🍰 Makanan</option>
                  <option value="drink">🥤 Minuman</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">URL Gambar (opsional)</label>
                <input
                  type="url"
                  value={editingMenu.image || ''}
                  onChange={(e) => setEditingMenu({...editingMenu, image: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all">
                  Update
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditMenu(false);
                    setEditingMenu(null);
                  }} 
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}