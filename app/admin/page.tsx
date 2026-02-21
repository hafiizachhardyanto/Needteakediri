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
  db
} from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

export default function AdminDashboard() {
  const router = useRouter();
  const { userData, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'daily' | 'menu' | 'history'>('dashboard');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form tambah menu
  const [newMenu, setNewMenu] = useState({
    name: '',
    description: '',
    price: '',
    category: 'food',
    image: '',
    stock: ''
  });

  // State untuk edit menu
  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadInitialData();
      
      // Realtime subscription untuk antrian
      const unsubscribe = subscribeToPendingOrders((orders) => {
        setPendingOrders(orders);
        checkExpiredOrders(orders);
      });
      
      // Auto refresh setiap menit untuk cek expiry
      const interval = setInterval(() => {
        cancelExpiredOrders();
      }, 60000);
      
      return () => {
        unsubscribe();
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
          // Auto cancel akan dihandle oleh interval
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
    category: newMenu.category as 'food' | 'drink', // <-- Tambahkan type assertion
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

  if (authLoading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🍵</span>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm">NeedTea Management System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-yellow-400">👑 {userData?.name}</span>
            <button 
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'queue', label: `Antrian (${pendingOrders.length})`, icon: '⏳', count: pendingOrders.length },
            { key: 'daily', label: 'Pesanan Harian', icon: '📅' },
            { key: 'menu', label: 'Kelola Menu', icon: '🍽️' },
            { key: 'history', label: 'Riwayat', icon: '📜' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-4 font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === tab.key 
                  ? 'bg-gray-700 text-yellow-400 border-b-2 border-yellow-400' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">📊 Ringkasan Hari Ini</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Antrian Menunggu</p>
                <p className="text-4xl font-bold text-yellow-400">{pendingOrders.length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Pesanan Selesai</p>
                <p className="text-4xl font-bold text-green-400">{completedOrders.filter(o => {
                  const today = new Date().toDateString();
                  const completed = o.completedAt?.toDate?.();
                  return completed?.toDateString() === today;
                }).length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Total Menu</p>
                <p className="text-4xl font-bold text-blue-400">{menuItems.length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Pendapatan Hari Ini</p>
                <p className="text-2xl font-bold text-green-400">
                  Rp {dailyStats?.totalRevenue?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">Aksi Cepat</h3>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setActiveTab('queue')}
                  className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-bold transition-all"
                >
                  Lihat Antrian
                </button>
                <button 
                  onClick={() => setActiveTab('daily')}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold transition-all"
                >
                  Lihat Pesanan Harian
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ANTRIAN (QUEUE) */}
        {activeTab === 'queue' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">⏳ Antrian Pesanan ({pendingOrders.length})</h2>
              <button 
                onClick={() => cancelExpiredOrders()}
                className="px-4 py-2 bg-red-500/50 hover:bg-red-500 rounded-lg text-sm transition-all"
              >
                Bersihkan Expired
              </button>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-12 text-center text-gray-400">
                <div className="text-6xl mb-4">✅</div>
                <p>Tidak ada antrian pesanan</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOrders.map((order, index) => (
                  <div key={order.id} className={`bg-gray-800 rounded-xl p-6 border-2 ${
                    index === 0 ? 'border-yellow-500' : 'border-gray-700'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl font-bold text-yellow-400">#{index + 1}</span>
                          {index === 0 && <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded font-bold">SELANJUTNYA</span>}
                        </div>
                        <p className="font-mono text-gray-400 text-sm mt-1">{order.id}</p>
                        <p className="text-white font-bold text-lg">{order.userName}</p>
                        <p className="text-gray-400 text-sm">{order.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-green-400">
                          Rp {order.totalAmount?.toLocaleString()}
                        </p>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                          order.paymentMethod === 'cash' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {order.paymentMethod === 'cash' ? '💵 Tunai' : '🧡 ShopeePay'}
                        </div>
                        <div className="mt-2 text-red-400 font-mono font-bold">
                          ⏱️ {formatTimeRemaining(order.expiryTime)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                      <p className="text-gray-400 text-sm mb-2">Detail Pesanan:</p>
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span>{item.quantity}x {item.name}</span>
                          <span>Rp {item.subtotal?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleCompleteOrder(order.id)}
                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-all flex items-center justify-center space-x-2"
                      >
                        <span>✅</span>
                        <span>Pesanan Selesai</span>
                      </button>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="px-6 py-3 bg-red-600/50 hover:bg-red-600 rounded-lg transition-all"
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

        {/* PESANAN HARIAN */}
        {activeTab === 'daily' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">📅 Pesanan Harian</h2>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  getDailyStats(e.target.value).then(r => {
                    if (r.success) setDailyStats(r.stats);
                  });
                }}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
                <p className="text-gray-400 text-sm">Total Pesanan</p>
                <p className="text-3xl font-bold text-blue-400">{dailyStats?.totalOrders || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
                <p className="text-gray-400 text-sm">Total Item</p>
                <p className="text-3xl font-bold text-purple-400">{dailyStats?.totalItems || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
                <p className="text-gray-400 text-sm">Total Pendapatan</p>
                <p className="text-2xl font-bold text-green-400">
                  Rp {dailyStats?.totalRevenue?.toLocaleString() || 0}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
                <p className="text-gray-400 text-sm">Rata-rata Order</p>
                <p className="text-2xl font-bold text-yellow-400">
                  Rp {Math.round(dailyStats?.averageOrderValue || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
              <p>📊 Statistik detail per item akan ditampilkan di sini</p>
              <p className="text-sm mt-2">Pilih tanggal untuk melihat data</p>
            </div>
          </div>
        )}

        {/* MENU */}
        {activeTab === 'menu' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">🍽️ Kelola Menu</h2>
              <button
                onClick={() => setShowAddMenu(true)}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-bold transition-all"
              >
                + Tambah Menu
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <div key={item.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  <div className="h-40 bg-gray-700 flex items-center justify-center text-4xl relative">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{item.category === 'food' ? '🍰' : '🥤'}</span>
                    )}
                    {/* Stock Badge */}
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
                      (item.stock || 0) > 10 
                        ? 'bg-green-500 text-white' 
                        : (item.stock || 0) > 0 
                          ? 'bg-yellow-500 text-black' 
                          : 'bg-red-500 text-white'
                    }`}>
                      Stok: {item.stock || 0}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{item.name}</h3>
                      <span className="text-yellow-400 font-bold">Rp {item.price?.toLocaleString()}</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{item.description}</p>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs ${
                        item.category === 'food' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {item.category === 'food' ? '🍰 Makanan' : '🥤 Minuman'}
                      </span>
                      {/* Status Stok */}
                      <span className={`text-xs ${
                        (item.stock || 0) === 0 ? 'text-red-400' : (item.stock || 0) < 5 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {(item.stock || 0) === 0 ? '❌ Habis' : (item.stock || 0) < 5 ? '⚠️ Hampir Habis' : '✅ Tersedia'}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex-1 py-2 bg-blue-600/50 hover:bg-blue-600 rounded-lg text-sm transition-all"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMenu(item.id)}
                        className="flex-1 py-2 bg-red-600/50 hover:bg-red-600 rounded-lg text-sm transition-all"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Menu Modal */}
            {showAddMenu && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4">Tambah Menu Baru</h3>
                  <form onSubmit={handleAddMenu} className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Nama Menu</label>
                      <input
                        type="text"
                        placeholder="Nama menu"
                        value={newMenu.name}
                        onChange={(e) => setNewMenu({...newMenu, name: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                      <textarea
                        placeholder="Deskripsi menu"
                        value={newMenu.description}
                        onChange={(e) => setNewMenu({...newMenu, description: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Harga (Rp)</label>
                        <input
                          type="number"
                          placeholder="Harga"
                          value={newMenu.price}
                          onChange={(e) => setNewMenu({...newMenu, price: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Stok</label>
                        <input
                          type="number"
                          placeholder="Jumlah stok"
                          value={newMenu.stock}
                          onChange={(e) => setNewMenu({...newMenu, stock: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                          min="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                      <select
                        value={newMenu.category}
                        onChange={(e) => setNewMenu({...newMenu, category: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                      >
                        <option value="food">🍰 Makanan</option>
                        <option value="drink">🥤 Minuman</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">URL Gambar (opsional)</label>
                      <input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={newMenu.image}
                        onChange={(e) => setNewMenu({...newMenu, image: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button type="submit" className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-bold">
                        Simpan
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowAddMenu(false);
                          setNewMenu({ name: '', description: '', price: '', category: 'food', image: '', stock: '' });
                        }} 
                        className="flex-1 py-3 bg-gray-700 rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Menu Modal */}
            {showEditMenu && editingMenu && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4">Edit Menu</h3>
                  <form onSubmit={handleEditMenu} className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Nama Menu</label>
                      <input
                        type="text"
                        placeholder="Nama menu"
                        value={editingMenu.name}
                        onChange={(e) => setEditingMenu({...editingMenu, name: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                      <textarea
                        placeholder="Deskripsi menu"
                        value={editingMenu.description || ''}
                        onChange={(e) => setEditingMenu({...editingMenu, description: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Harga (Rp)</label>
                        <input
                          type="number"
                          placeholder="Harga"
                          value={editingMenu.price}
                          onChange={(e) => setEditingMenu({...editingMenu, price: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Stok</label>
                        <input
                          type="number"
                          placeholder="Jumlah stok"
                          value={editingMenu.stock}
                          onChange={(e) => setEditingMenu({...editingMenu, stock: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                          min="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                      <select
                        value={editingMenu.category}
                        onChange={(e) => setEditingMenu({...editingMenu, category: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                      >
                        <option value="food">🍰 Makanan</option>
                        <option value="drink">🥤 Minuman</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">URL Gambar (opsional)</label>
                      <input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={editingMenu.image || ''}
                        onChange={(e) => setEditingMenu({...editingMenu, image: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button type="submit" className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold">
                        Update
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowEditMenu(false);
                          setEditingMenu(null);
                        }} 
                        className="flex-1 py-3 bg-gray-700 rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RIWAYAT */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">📜 Riwayat Pesanan</h2>
            
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu Selesai</th>
                    <th className="px-4 py-3 text-left">Pelanggan</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrders.slice(0, 50).map((order) => (
                    <tr key={order.id} className="border-b border-gray-700">
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {order.completedAt?.toDate?.().toLocaleString('id-ID') || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.userName}</p>
                        <p className="text-gray-400 text-sm">{order.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {order.items?.length} item
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-400">
                        Rp {order.totalAmount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                          ✅ Selesai
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}