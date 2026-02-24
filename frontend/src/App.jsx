import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Heart, Upload, LogIn, CheckCircle, Clock, XCircle, FileText,
  Plus, Minus, ChevronRight, User, LogOut, Settings,
  Activity, History, Megaphone, Trash2, Edit3, MessageSquare,
  ShoppingCart, Package, Truck, AlertTriangle, Send, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const API_BASE = "http://localhost:5000";

function App() {
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [losses, setLosses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [giftIds, setGiftIds] = useState(() => {
    const saved = localStorage.getItem('giftIds');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('giftIds', JSON.stringify(Array.from(giftIds)));
  }, [giftIds]);

  const [view, setView] = useState('products');
  const [loading, setLoading] = useState(false);
  const [importType, setImportType] = useState('products');

  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  const [chatResponse, setChatResponse] = useState(null);

  // Forms
  const [showProductForm, setShowProductForm] = useState(false);
  const [productFormData, setProductFormData] = useState({
    name: '', supplier_id: '', available_stock: 0, stock: 0, safety_stock: 0, unit: '斤', price: 0, description: ''
  });
  const [editingProductId, setEditingProductId] = useState(null);

  const [showLossForm, setShowLossForm] = useState(false);
  const [lossFormData, setLossFormData] = useState({ p_id: '', qty: 0, reason: '損毀', date: new Date().toISOString().split('T')[0] });

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileFormData, setProfileFormData] = useState({ display_name: '', phone: '', shipping_address: '' });

  const [confirmOrderData, setConfirmOrderData] = useState(null);
  const [shippingInfo, setShippingInfo] = useState({ phone: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState('轉帳');
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);

  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annFormData, setAnnFormData] = useState({ title: '', content: '', date: new Date().toISOString().split('T')[0] });
  const [editingAnnId, setEditingAnnId] = useState(null);

  const [chatHistory, setChatHistory] = useState([]);
  const hasCalledCallback = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !hasCalledCallback.current) {
      hasCalledCallback.current = true;
      handleCallback(code);
    }
  }, []); // Only run once on mount to catch the code

  useEffect(() => {
    fetchProducts();
    fetchAnnouncements();
    if (token) {
      fetchMyProfile();
      fetchMyOrders();
      fetchCart();
      if (isAdmin) {
        fetchAdminData();
      }
    }
  }, [token, isAdmin]);

  const fetchAdminData = () => {
    fetchSuppliers();
    fetchAllOrders();
    fetchLosses();
  };

  const handleLogin = async () => {
    const res = await axios.get(`${API_BASE}/auth/login-url`);
    window.location.href = res.data.url;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    setToken(null);
    setIsAdmin(false);
    setCurrentUserProfile(null);
    setView('products');
  };

  const handleCallback = async (code) => {
    window.history.replaceState({}, document.title, "/");
    try {
      const res = await axios.get(`${API_BASE}/auth/callback?code=${code}`);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('isAdmin', res.data.is_admin);
      setToken(res.data.access_token);
      setIsAdmin(res.data.is_admin);
      setCurrentUserProfile(res.data.user);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const fetchMyProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
      setCurrentUserProfile(res.data);
      if (res.data.is_admin !== undefined) {
        setIsAdmin(res.data.is_admin);
        localStorage.setItem('isAdmin', res.data.is_admin);
      }
      setProfileFormData({
        display_name: res.data.display_name || '',
        phone: res.data.phone || '',
        shipping_address: res.data.shipping_address || ''
      });
    } catch (err) { console.error("Fetch profile failed", err); }
  };

  const fetchProducts = async () => {
    const res = await axios.get(`${API_BASE}/products`);
    setProducts(res.data);
  };

  const fetchSuppliers = async () => {
    const res = await axios.get(`${API_BASE}/admin/suppliers`, { headers: { Authorization: `Bearer ${token}` } });
    setSuppliers(res.data);
  };

  const fetchMyOrders = async () => {
    const res = await axios.get(`${API_BASE}/my-orders`, { headers: { Authorization: `Bearer ${token}` } });
    setMyOrders(res.data);
  };

  const fetchAllOrders = async () => {
    const res = await axios.get(`${API_BASE}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
    setAllOrders(res.data);
  };

  const fetchLosses = async () => {
    const res = await axios.get(`${API_BASE}/admin/losses`, { headers: { Authorization: `Bearer ${token}` } });
    setLosses(res.data);
  };

  const fetchAnnouncements = async () => {
    const res = await axios.get(`${API_BASE}/announcements`);
    setAnnouncements(res.data);
  };

  const fetchCart = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cart`, { headers: { Authorization: `Bearer ${token}` } });
      setCartItems(res.data);
      // 從後端同步贈品清單
      const gifts = new Set(res.data.filter(it => it.is_gift).map(it => it.product_id));
      setGiftIds(gifts);
    } catch (err) { console.error("Fetch cart failed", err); }
  };
  const handleClearCart = async () => {
    if (!window.confirm("確定要清空購物車嗎？")) return;
    try {
      await axios.post(`${API_BASE}/cart`, { items: [] }, { headers: { Authorization: `Bearer ${token}` } });
      setCartItems([]);
      setGiftIds(new Set());
    } catch (err) { console.error("Clear cart failed", err); }
  };

  const updateCartQuantity = async (productId, newQuantity) => {
    if (newQuantity < 0) return;

    // 立即更新本地狀態提升響應感
    const updatedItems = cartItems.map(it =>
      it.product_id === productId ? { ...it, quantity: newQuantity } : it
    ).filter(it => it.quantity > 0);

    setCartItems(updatedItems);

    try {
      await axios.post(`${API_BASE}/cart`, {
        items: updatedItems.map(it => ({
          product_id: it.product_id,
          quantity: it.quantity
        }))
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error("Sync cart failed", err);
      fetchCart(); // 失敗時回滾
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = { role: 'user', content: text };
    setChatHistory(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyToSend = chatHistory.slice(-12).map(h => ({
        role: h.role,
        content: h.content,
        tool_calls: h.tool_calls,
        tool_call_id: h.tool_call_id,
        name: h.name
      }));

      const res = await axios.post(`${API_BASE}/chat-order`, {
        message: text,
        history: historyToSend
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const aiResponse = {
        role: 'assistant',
        content: res.data.response,
        intent: res.data.intent,
        data: res.data.data
      };

      setChatHistory(prev => [...prev, aiResponse]);

      if (res.data.intent === 'ORDER') {
        setChatResponse(res.data.data);
        if (res.data.data.gift_ids) {
          setGiftIds(new Set(res.data.data.gift_ids));
        }
        fetchCart();
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: '抱歉，我暫時斷線了，請稍後再試。' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatOrder = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatMessage('');
    sendMessage(msg);
  };

  const handleConfirmOrder = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/confirm-order`, {
        items: confirmOrderData.items.map(it => ({
          product_id: it.product_id,
          quantity: it.quantity,
          price_at_order: it.price,
          is_gift: giftIds.has(it.product_id)
        })),
        payment_method: paymentMethod,
        receiver_phone: shippingInfo.phone,
        receiver_address: shippingInfo.address,
        total_amount: Number(confirmOrderData.total_amount).toFixed(0)
      }, { headers: { Authorization: `Bearer ${token}` } });

      alert("訂單已成功送出！");
      setConfirmOrderData(null);
      setChatResponse(null);
      fetchProducts();
      fetchMyOrders();
      fetchCart(); // 結帳後清空或更新購物車
    } catch (err) {
      alert(err.response?.data?.detail || "確認訂單失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleShipOrder = async (orderId) => {
    try {
      await axios.post(`${API_BASE}/admin/orders/${orderId}/ship`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("出貨成功！實體庫存已扣除。");
      fetchAllOrders();
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.detail || "出貨操作失敗");
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_BASE}/me`, profileFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowProfileForm(false);
      fetchMyProfile();
      alert("個人資料已更新");
    } catch (err) { alert("更新失敗"); }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProductId) {
        await axios.patch(`${API_BASE}/admin/products/${editingProductId}`, productFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/admin/products`, productFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowProductForm(false);
      fetchProducts();
    } catch (err) { alert("儲存失敗"); }
  };

  const handleLossSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/admin/losses`, null, {
        params: lossFormData,
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowLossForm(false);
      fetchProducts();
      fetchLosses();
      alert("損耗已紀錄並扣除庫存");
    } catch (err) { alert(err.response?.data?.detail || "紀錄失敗"); }
  };

  const updateShipping = async (orderId, date) => {
    try {
      await axios.patch(`${API_BASE}/admin/orders/${orderId}/shipping?shipping_date=${date}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllOrders();
    } catch (err) { alert("更新失敗"); }
  };

  const updatePaymentStatus = async (orderId, status) => {
    try {
      await axios.patch(`${API_BASE}/admin/orders/${orderId}/payment?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllOrders();
    } catch (err) { alert("更新失敗"); }
  };

  const handleAnnSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAnnId) {
        await axios.patch(`${API_BASE}/admin/announcements/${editingAnnId}`, annFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/admin/announcements`, annFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowAnnForm(false);
      fetchAnnouncements();
    } catch (err) { alert("儲存失敗"); }
  };

  const deleteAnn = async (id) => {
    if (!confirm("確定要刪除這條公告嗎？")) return;
    try {
      await axios.delete(`${API_BASE}/admin/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnnouncements();
    } catch (err) { alert("刪除失敗"); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE}/upload-csv?import_type=${importType}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert(`匯入 ${importType} 成功！`);
      fetchProducts();
      fetchAllOrders();
      fetchProducts();
      if (isAdmin) {
        fetchAdminData();
      }
    } catch (err) {
      alert("匯入失敗: " + (err.response?.data?.detail || "請求錯誤"));
    }
  };

  const isAdminView = ['products-admin', 'losses-admin', 'announcements-admin'].includes(view);

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isAdminView ? 'bg-zinc-950 text-white' : 'bg-orange-50/30'}`}>
      {/* Top Navbar */}
      <header className={`h-16 border-b flex items-center justify-between px-8 shrink-0 z-50 ${isAdminView ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-orange-100 shadow-sm'}`}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('products')}>
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white">
              <Package size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-orange-800 leading-none">新鮮農產</h1>
              <p className="text-[8px] uppercase tracking-widest opacity-40">Farm Direct Produce</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <button onClick={() => setView('products')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${view === 'products' ? 'bg-orange-100 text-orange-800 font-bold' : 'opacity-60 hover:bg-orange-50'}`}>
              <ShoppingCart size={16} /> 農產市集
            </button>

            {token && (
              <button onClick={() => setView('my-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${view === 'my-orders' ? 'bg-orange-100 text-orange-800 font-bold' : 'opacity-60 hover:bg-orange-50'}`}>
                <History size={16} /> {isAdmin ? "所有顧客訂單" : "我的訂單"}
              </button>
            )}

            {token && !isAdmin && (
              <button onClick={() => setView('cart')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all relative ${view === 'cart' ? 'bg-orange-100 text-orange-800 font-bold' : 'opacity-60 hover:bg-orange-50'}`}>
                <ShoppingCart size={16} /> 購物車
                {cartItems.length > 0 && (
                  <span className="absolute -right-1 -top-1 bg-orange-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white font-bold">{cartItems.length}</span>
                )}
              </button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-1 border-l border-zinc-700/50 ml-2 pl-2">
                <button onClick={() => setView('shipping')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${view === 'shipping' ? 'bg-zinc-800 text-white font-bold' : 'opacity-60 hover:bg-zinc-800'}`}>
                  <Truck size={16} /> 出貨
                </button>
                <button onClick={() => setView('products-admin')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${view === 'products-admin' ? 'bg-zinc-800 text-white font-bold' : 'opacity-60 hover:bg-zinc-800'}`}>
                  <Settings size={16} /> 產品庫存
                </button>
                <button onClick={() => setView('announcements-admin')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${view === 'announcements-admin' ? 'bg-zinc-800 text-white font-bold' : 'opacity-60 hover:bg-zinc-800'}`}>
                  <Megaphone size={16} /> 公告
                </button>
              </div>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700">
              <p className="text-[10px] font-bold opacity-30 uppercase whitespace-nowrap">匯入</p>
              <select
                value={importType}
                onChange={e => setImportType(e.target.value)}
                className="bg-transparent text-[10px] border-none rounded-lg p-0 text-white focus:ring-0 cursor-pointer"
              >
                <option value="products">產品</option>
                <option value="losses">損耗</option>
              </select>
              <label className="text-orange-500 cursor-pointer hover:text-orange-400">
                <Upload size={14} />
                <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {!token ? (
            <button onClick={handleLogin} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-green-700 transition-all flex items-center gap-2">
              <LogIn size={16} /> 登入
            </button>
          ) : (
            <div className="flex items-center gap-3 pl-4 border-l border-orange-100">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-zinc-800">{currentUserProfile?.display_name}</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowProfileForm(true)} className="text-[9px] text-orange-600 font-bold hover:underline">設定</button>
                  <button onClick={handleLogout} className="text-[9px] text-red-500 font-bold hover:underline">登出</button>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-800 border border-orange-200">
                <User size={18} />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-12">
          {view === 'products' && (
            <div className="max-w-6xl mx-auto">
              <header className="mb-12 flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-zinc-800 mb-2">新鮮農產</h2>
                  <p className="text-zinc-500">直採產地，新鮮直送</p>
                </div>
              </header>

              {/* 最新公告區塊 */}
              {announcements.length > 0 && (
                <div className="mb-12 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-orange-600 p-2 rounded-xl text-white shadow-lg shadow-orange-900/10">
                      <Megaphone size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-800">最新公告</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {announcements.slice(0, 4).map(ann => (
                      <motion.div
                        key={ann.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white border border-orange-100 p-6 rounded-[24px] shadow-sm hover:border-orange-200 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded uppercase tracking-wider">{ann.date}</span>
                          <ChevronRight size={14} className="text-orange-200 group-hover:text-orange-500 transition-colors" />
                        </div>
                        <h4 className="font-bold text-zinc-800 mb-1">{ann.title}</h4>
                        <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">{ann.content}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map(p => (
                  <motion.div key={p.id} whileHover={{ y: -5 }} className="bg-white border border-orange-100 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
                    <div className="mb-6 flex justify-between items-start">
                      <span className="bg-orange-50 text-orange-700 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {p.supplier_name}
                      </span>
                      <p className="text-2xl font-bold text-orange-800">${p.price}<span className="text-xs text-zinc-400 font-normal"> / {p.unit}</span></p>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-800 mb-2">{p.name}</h3>
                    <p className="text-sm text-zinc-500 mb-6">{p.description || "友善農法栽種，自然鮮甜。"}</p>

                    <div className="flex items-center justify-between text-xs font-bold pt-6 border-t border-orange-50">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-zinc-400" />
                        {isAdmin ? (
                          <span className={p.stock <= p.safety_stock ? "text-red-500 font-bold" : "text-zinc-500"}>
                            庫存: {p.stock} {p.unit}
                          </span>
                        ) : (
                          p.stock < 10 ? (
                            <span className="text-red-500 font-bold animate-pulse">
                              僅剩 {p.stock} {p.unit}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">庫存充足</span>
                          )
                        )}
                        {isAdmin && p.stock <= p.safety_stock && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {view === 'my-orders' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-zinc-800">{isAdmin ? "全站顧客訂單總覽" : "我的訂單紀錄"}</h2>

              <div className="space-y-4">
                {isAdmin ? (
                  // 管理員分層顯示
                  Object.entries(
                    allOrders.reduce((acc, o) => {
                      if (!acc[o.user_email]) acc[o.user_email] = [];
                      acc[o.user_email].push(o);
                      return acc;
                    }, {})
                  ).map(([email, orders]) => (
                    <div key={email} className="bg-white rounded-[24px] border border-orange-100 shadow-sm overflow-hidden">
                      <button
                        onClick={() => setExpandedUser(expandedUser === email ? null : email)}
                        className="w-full p-6 flex justify-between items-center hover:bg-orange-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-800">
                            <User size={20} />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-zinc-800">{email}</p>
                            <p className="text-xs text-zinc-400">{orders.length} 筆訂單</p>
                          </div>
                        </div>
                        <ChevronRight className={`transition-transform ${expandedUser === email ? 'rotate-90' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {expandedUser === email && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-orange-50 bg-orange-50/10">
                            {orders.map(o => (
                              <div key={o.id} className="border-b border-orange-50 last:border-none">
                                <button
                                  onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                                  className="w-full px-8 py-4 flex justify-between items-center hover:bg-white transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Clock size={14} className="text-orange-400" />
                                    <span className="text-sm font-bold">{new Date(o.created_at).toLocaleString()}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${o.payment_status === '已付款' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {o.payment_status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-sm font-bold text-orange-800">${o.total_amount}</span>
                                    <ChevronRight size={14} className={`transition-transform ${expandedOrder === o.id ? 'rotate-90' : ''}`} />
                                  </div>
                                </button>

                                {expandedOrder === o.id && (
                                  <div className="px-12 pb-6 pt-2 space-y-4">
                                    <div className="overflow-hidden rounded-xl border border-orange-100 bg-white">
                                      <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                          <tr className="bg-orange-50/50 text-orange-400 font-bold">
                                            <th className="px-3 py-2 border-b border-orange-50">產品 (供應商)</th>
                                            <th className="px-3 py-2 border-b border-orange-50 text-right">單價</th>
                                            <th className="px-3 py-2 border-b border-orange-50 text-center">數量</th>
                                            <th className="px-3 py-2 border-b border-orange-50 text-right">小計</th>
                                          </tr>
                                        </thead>
                                        <tbody className="text-zinc-600">
                                          {o.items.map((it, idx) => (
                                            <tr key={idx}>
                                              <td className="px-3 py-2 border-b border-orange-50">
                                                <div className="font-bold text-zinc-800">{it.product_name}</div>
                                                <div className="text-[11px] opacity-60">[{it.supplier}]</div>
                                              </td>
                                              <td className="px-3 py-2 border-b border-orange-50 text-right">${it.price_at_order} /{it.unit}</td>
                                              <td className="px-3 py-2 border-b border-orange-50 text-center font-bold text-orange-700">{it.quantity}</td>
                                              <td className="px-3 py-2 border-b border-orange-50 text-right font-bold text-zinc-800">${it.subtotal}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm text-zinc-500 bg-white p-6 rounded-xl border border-orange-50 shadow-sm">
                                      <div>
                                        <p className="font-bold uppercase opacity-40 mb-1 text-[10px] tracking-widest">付款與運送</p>
                                        <p className="text-zinc-800 font-medium">{o.payment_method} / {o.receiver_phone}</p>
                                      </div>
                                      <div>
                                        <p className="font-bold uppercase opacity-40 mb-1 text-[10px] tracking-widest">預計出貨</p>
                                        <p className="text-zinc-800 font-medium">{o.shipping_date || "安排中"}</p>
                                      </div>
                                      <div className="col-span-2">
                                        <p className="font-bold uppercase opacity-40 mb-1 text-[10px] tracking-widest">配送地址</p>
                                        <p className="text-zinc-800 font-medium">{o.receiver_address}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  // 一般用戶顯示
                  myOrders.map(o => (
                    <div key={o.id} className="bg-white p-8 rounded-[32px] border border-orange-100 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Order #{o.id}</p>
                          <p className="text-lg font-bold">{new Date(o.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${o.payment_status === '已付款' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {o.payment_status}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-[24px] border border-orange-100 bg-white mb-6">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-orange-50/50 text-orange-400 font-bold">
                              <th className="px-4 py-3 border-b border-orange-50">產品 (供應商)</th>
                              <th className="px-4 py-3 border-b border-orange-50 text-right">單價</th>
                              <th className="px-4 py-3 border-b border-orange-50 text-center">數量</th>
                              <th className="px-4 py-3 border-b border-orange-50 text-right">小計</th>
                            </tr>
                          </thead>
                          <tbody className="text-zinc-600">
                            {o.items.map((it, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 border-b border-orange-50">
                                  <div className="font-bold text-zinc-800">{it.product_name}</div>
                                  <div className="text-[9px] opacity-60">[{it.supplier}]</div>
                                </td>
                                <td className="px-4 py-3 border-b border-orange-50 text-right">${it.price_at_order} /{it.unit}</td>
                                <td className="px-4 py-3 border-b border-orange-50 text-center font-bold text-orange-700">{it.quantity}</td>
                                <td className="px-4 py-3 border-b border-orange-50 text-right font-bold text-zinc-800">${it.subtotal}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-[10px] text-zinc-500 mb-6 bg-orange-50/30 p-4 rounded-2xl">
                        <div>
                          <p className="font-bold uppercase opacity-40 mb-1">付款方式</p>
                          <p className="text-zinc-800">{o.payment_method}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase opacity-40 mb-1">聯繫電話</p>
                          <p className="text-zinc-800">{o.receiver_phone}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="font-bold uppercase opacity-40 mb-1">配送地址</p>
                          <p className="text-zinc-800">{o.receiver_address}</p>
                        </div>
                      </div>
                      <div className="border-t border-orange-50 pt-4 flex justify-between items-center">
                        <span className="text-xs text-zinc-400 font-bold">預計出貨: {o.shipping_date || "安排中"}</span>
                        <p className="text-xl font-bold text-orange-800">Total: ${o.total_amount}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'cart' && (
            <div className="max-w-4xl mx-auto pb-20">
              <header className="mb-12 flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-zinc-800 mb-2">我的購物車</h2>
                  <p className="text-zinc-500">確認品項後即可進行結帳</p>
                </div>
                <button
                  onClick={handleClearCart}
                  className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-all font-bold text-sm bg-zinc-100/50 hover:bg-red-50 px-5 py-2.5 rounded-2xl"
                >
                  <Trash2 size={16} /> 清空購物車
                </button>
              </header>

              {cartItems.length > 0 ? (
                <div className="bg-white rounded-[40px] border border-orange-100 shadow-xl overflow-hidden p-8">
                  <table className="w-full text-left mb-8">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-orange-50">
                        <th className="pb-6 px-4">產品內容</th>
                        <th className="pb-6 text-right px-4">單價</th>
                        <th className="pb-6 text-center px-4">數量</th>
                        <th className="pb-6 text-right px-4">小計</th>
                        <th className="pb-6 text-center px-4">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-50 text-zinc-700">
                      {cartItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-orange-50/20 transition-colors">
                          <td className="py-6 px-4">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-lg">{it.product_name}</p>
                              {giftIds.has(it.product_id) && (
                                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-orange-200">
                                  贈品
                                </span>
                              )}
                            </div>
                            <p className="text-xs opacity-40">[{it.supplier}]</p>
                          </td>
                          <td className="py-6 text-right px-4 font-medium font-mono">
                            {giftIds.has(it.product_id) ? (
                              <span className="line-through text-zinc-400 opacity-50 text-sm">${it.price}</span>
                            ) : (
                              `$${it.price}`
                            )} /{it.unit}
                          </td>
                          <td className="py-6 text-center px-4">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => updateCartQuantity(it.product_id, Number(it.quantity) - 1)}
                                className="w-8 h-8 rounded-full border border-orange-200 flex items-center justify-center text-orange-600 hover:bg-orange-50 transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="bg-orange-50 text-orange-800 px-4 py-2 rounded-xl font-bold min-w-[3rem]">{it.quantity}</span>
                              <button
                                onClick={() => updateCartQuantity(it.product_id, Number(it.quantity) + 1)}
                                className="w-8 h-8 rounded-full border border-orange-200 flex items-center justify-center text-orange-600 hover:bg-orange-50 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="py-6 text-right px-4 font-bold text-lg font-mono text-orange-900">
                            ${giftIds.has(it.product_id) ? 0 : (it.price * it.quantity).toFixed(0)}
                          </td>
                          <td className="py-6 text-center px-4">
                            <button
                              onClick={() => updateCartQuantity(it.product_id, 0)}
                              className="text-zinc-300 hover:text-red-500 transition-colors p-2"
                              title="移除此項目"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="bg-orange-50/50 rounded-[32px] p-8 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-zinc-500 mb-1">本次結帳總金額</p>
                      <p className="text-4xl font-black text-orange-800 font-mono">
                        ${cartItems.reduce((acc, it) => acc + (giftIds.has(it.product_id) ? 0 : it.price * it.quantity), 0).toFixed(0)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const total = cartItems.reduce((acc, it) =>
                          acc + (giftIds.has(it.product_id) ? 0 : it.price * it.quantity), 0
                        );
                        setConfirmOrderData({
                          items: cartItems,
                          total_amount: total
                        });
                        setShippingInfo({
                          phone: currentUserProfile?.phone || '',
                          address: currentUserProfile?.shipping_address || ''
                        });
                        setIsChatMinimized(false);
                        // 如果在手機版可能需要滾動到對話視窗
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="bg-orange-800 text-white px-12 py-5 rounded-[24px] font-bold text-lg hover:shadow-2xl hover:bg-orange-900 transition-all flex items-center gap-2 transform active:scale-95"
                    >
                      <CheckCircle size={20} /> 前往結帳
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-32 bg-white rounded-[40px] border border-orange-100 border-dashed">
                  <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-300">
                    <ShoppingCart size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-300">您的購物車是空的</h3>
                  <button onClick={() => setView('products')} className="mt-6 text-orange-600 font-bold hover:underline">去產品市集逛逛吧</button>
                </div>
              )}
            </div>
          )}

          {view === 'shipping' && (
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-zinc-800">出貨管理控制台</h2>
              <div className="grid grid-cols-1 gap-4">
                {allOrders.map(o => (
                  <div key={o.id} className="bg-white border border-orange-100 p-8 rounded-[32px] shadow-sm space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-orange-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-800">
                          <Package size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Order #{o.id}</p>
                          <p className="font-bold text-zinc-800">{o.user_email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${o.status === '已出貨' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                          {o.status}
                        </span>
                        {o.status !== '已出貨' && o.status !== '已取消' && (
                          <button
                            onClick={() => handleShipOrder(o.id)}
                            className="bg-orange-600 text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-orange-700 transition-colors shadow-sm"
                          >
                            確認出貨 (扣實體庫存)
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">支付狀態</p>
                        <select
                          value={o.payment_status}
                          onChange={(e) => updatePaymentStatus(o.id, e.target.value)}
                          className="bg-orange-50 border-orange-100 rounded-lg text-sm font-bold text-orange-800 p-2"
                        >
                          <option>待付款</option>
                          <option>已付款</option>
                        </select>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">預計出貨</p>
                        <input
                          type="date"
                          value={o.shipping_date || ""}
                          onChange={(e) => updateShipping(o.id, e.target.value)}
                          className="bg-white border border-orange-200 rounded-lg text-sm p-2 text-zinc-800 focus:ring-2 focus:ring-orange-200"
                        />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-orange-50 bg-orange-50/10">
                      <table className="w-full text-left text-base border-collapse">
                        <thead>
                          <tr className="bg-orange-50/50 text-orange-400 font-bold">
                            <th className="px-4 py-3 border-b border-orange-50">產品 (供應商)</th>
                            <th className="px-4 py-3 border-b border-orange-50 text-right">單價</th>
                            <th className="px-4 py-3 border-b border-orange-50 text-center">數量</th>
                            <th className="px-4 py-3 border-b border-orange-50 text-right">小計</th>
                          </tr>
                        </thead>
                        <tbody className="text-zinc-600">
                          {o.items.map((it, idx) => (
                            <tr key={idx} className="bg-white/50">
                              <td className="px-4 py-3 border-b border-orange-50">
                                <div className="font-bold text-zinc-800">{it.product_name}</div>
                                <div className="text-xs opacity-60">[{it.supplier}]</div>
                              </td>
                              <td className="px-4 py-3 border-b border-orange-50 text-right">${it.price_at_order} /{it.unit}</td>
                              <td className="px-4 py-3 border-b border-orange-50 text-center font-bold text-orange-700">{it.quantity}</td>
                              <td className="px-4 py-3 border-b border-orange-50 text-right font-bold text-zinc-800">${it.subtotal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-8 text-[18px] text-zinc-700 font-medium">
                        <span><User size={18} className="inline mr-2 opacity-40 text-orange-800" /> {o.receiver_phone}</span>
                        <span><Truck size={18} className="inline mr-2 opacity-40 text-orange-800" /> {o.receiver_address}</span>
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold text-sm self-center">{o.payment_method}</span>
                      </div>
                      <p className="text-4xl font-black text-orange-800">Total: ${o.total_amount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'products-admin' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold">庫存與產品設定</h2>
                <button onClick={() => setShowProductForm(true)} className="bg-orange-600 px-6 py-3 rounded-xl font-bold">+ 新增產品</button>
              </div>
              <table className="w-full text-left">
                <thead className="text-zinc-500 uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="pb-4">產品名稱</th>
                    <th className="pb-4">供應商</th>
                    <th className="pb-4">可購買 (預扣)</th>
                    <th className="pb-4">實體庫存</th>
                    <th className="pb-4">安全線</th>
                    <th className="pb-4">單價</th>
                    <th className="pb-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="py-4 font-bold">{p.name}</td>
                      <td className="py-4">{p.supplier_name}</td>
                      <td className={`py-4 font-bold ${p.available_stock <= p.safety_stock ? "text-orange-500" : "text-green-600"}`}>{p.available_stock}</td>
                      <td className={`py-4 ${p.stock <= p.safety_stock ? "text-red-500" : "text-zinc-400"}`}>{p.stock}</td>
                      <td className="py-4 text-zinc-500">{p.safety_stock}</td>
                      <td className="py-4">${p.price}</td>
                      <td className="py-4">
                        <button className="p-2 text-zinc-500 hover:text-white" onClick={() => {
                          setEditingProductId(p.id);
                          setProductFormData(p);
                          setShowProductForm(true);
                        }}><Edit3 size={16} /></button>
                        <button className="p-2 text-red-500 hover:text-red-400 ml-2" onClick={() => {
                          setLossFormData({ ...lossFormData, p_id: p.id });
                          setShowLossForm(true);
                        }} title="紀錄損耗"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'losses-admin' && (
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-white">產品損耗紀錄中心</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="p-6">日期</th>
                      <th className="p-6">產品</th>
                      <th className="p-6">供應商</th>
                      <th className="p-6">損耗數量</th>
                      <th className="p-6">原因</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {losses.map(l => (
                      <tr key={l.id} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="p-6 text-zinc-400">{l.loss_date}</td>
                        <td className="p-6 font-bold">{l.product_name}</td>
                        <td className="p-6 text-zinc-500">{l.supplier_name}</td>
                        <td className="p-6 text-red-400">-{l.quantity}</td>
                        <td className="p-6"><span className="bg-zinc-800 px-3 py-1 rounded-full text-[10px]">{l.reason}</span></td>
                      </tr>
                    ))}
                    {losses.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-12 text-center text-zinc-600">目前尚無損耗紀錄</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'announcements-admin' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white">公告管理中心</h2>
                <button
                  onClick={() => { setEditingAnnId(null); setAnnFormData({ title: '', content: '', date: new Date().toISOString().split('T')[0] }); setShowAnnForm(true); }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all"
                >
                  <Plus size={18} /> 發布新公告
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {announcements.map(ann => (
                  <div key={ann.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[24px] flex items-center justify-between group hover:border-orange-900/50 transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded uppercase tracking-widest">{ann.date}</span>
                        <h3 className="font-bold text-zinc-100">{ann.title}</h3>
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-1">{ann.content}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingAnnId(ann.id); setAnnFormData({ title: ann.title, content: ann.content, date: ann.date }); setShowAnnForm(true); }}
                        className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => deleteAnn(ann.id)}
                        className="p-3 bg-red-900/20 hover:bg-red-900/40 rounded-xl text-red-400 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && <p className="text-center py-20 text-zinc-600">目前的公告列表為空</p>}
              </div>
            </div>
          )}
        </div>

        <div className={`fixed bottom-8 right-8 flex flex-col shadow-2xl overflow-hidden bg-white border border-orange-100 transition-all duration-500 ease-in-out z-50 ${isChatMinimized ? 'w-16 h-16 rounded-full shadow-lg' : 'w-[400px] h-[650px] rounded-[32px]'}`}>
          <div
            className={`bg-orange-800 text-white flex items-center cursor-pointer hover:bg-orange-900 transition-all duration-500 select-none ${isChatMinimized ? 'w-full h-full justify-center' : 'p-5 justify-between'}`}
            onClick={() => setIsChatMinimized(!isChatMinimized)}
          >
            <h3 className={`font-bold flex items-center gap-2 ${isChatMinimized ? 'w-full h-full flex items-center justify-center' : ''}`}>
              <div className={`${isChatMinimized ? 'flex items-center justify-center' : 'bg-white/20 p-1.5 rounded-lg'}`}>
                <MessageSquare size={isChatMinimized ? 24 : 18} className="text-white" />
              </div>
              {!isChatMinimized && <span>農小助 (Llama 3.3)</span>}
              {!isChatMinimized && <ChevronRight size={16} className="rotate-90" />}
            </h3>
            {!isChatMinimized && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">Groq AI</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!isChatMinimized && (
              <motion.div
                key="chat-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col flex-1 overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-6 bg-orange-50/20 space-y-4">
                  <div className="bg-white p-5 rounded-3xl rounded-tl-none border border-orange-100 shadow-sm">
                    <p className="text-zinc-800 font-bold mb-3 flex items-center gap-2">
                      <span className="text-xl">👨‍🌾</span> 您好！我是您的農產特助。
                    </p>
                    <p className="text-zinc-500 text-[13px] leading-relaxed mb-4">
                      除了幫您下單，我還能為您媒合當季最鮮甜的農產與專屬優惠！您可以試試點擊下方的建議：
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { text: "現在有什麼滿額贈品或限時優惠？💰", icon: "🎁" },
                        { text: "推薦今天最新鮮的當季蔬菜 🥬", icon: "✨" },
                        { text: "我想再訂一次之前的訂單 📋", icon: "🔄" },
                        { text: "查詢我的購物車總金額 💰", icon: "🛒" }
                      ].map((btn, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(btn.text)}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-800 text-[11px] font-bold px-3 py-2 rounded-xl border border-orange-200/50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <span className="text-sm">{btn.icon}</span> {btn.text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {chatHistory.map((chat, idx) => (
                    <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm whitespace-pre-wrap ${chat.role === 'user'
                        ? 'bg-orange-800 text-white rounded-tr-none'
                        : 'bg-white border border-orange-100 text-zinc-700 rounded-tl-none shadow-sm'
                        }`}>
                        <div className="prose prose-sm max-w-none prose-zinc">
                          <ReactMarkdown components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            strong: ({ children }) => <strong className="font-bold text-orange-950">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-[13px]">{children}</li>,
                            h3: ({ children }) => <h3 className="text-base font-bold text-orange-900 mt-2 mb-1">{children}</h3>
                          }}>
                            {chat.content}
                          </ReactMarkdown>
                        </div>

                        {chat.role === 'assistant' && chat.intent === 'ORDER' && chat.data?.items?.length > 0 && (
                          <div className="mt-4 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
                            <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                              <p className="font-bold text-orange-800 text-xs">特助建議採購方案</p>
                            </div>
                            <table className="w-full text-left text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-orange-50/50 text-orange-400 font-bold uppercase tracking-wider">
                                  <th className="px-3 py-2 border-b border-orange-100">產品 (供應商)</th>
                                  <th className="px-3 py-2 border-b border-orange-100 text-right">單價</th>
                                  <th className="px-3 py-2 border-b border-orange-100 text-center">數量</th>
                                  <th className="px-3 py-2 border-b border-orange-100 text-right">小計</th>
                                </tr>
                              </thead>
                              <tbody className="text-zinc-600">
                                {chat.data.items.map((it, i) => (
                                  <tr key={i} className="hover:bg-orange-50/30 transition-all">
                                    <td className="px-3 py-2 border-b border-orange-50">
                                      <div className="font-medium text-zinc-800">{it.product_name}</div>
                                      <div className="text-[9px] opacity-60">[{it.supplier}]</div>
                                    </td>
                                    <td className="px-3 py-2 border-b border-orange-50 text-right">${it.price} /{it.unit}</td>
                                    <td className="px-3 py-2 border-b border-orange-50 text-center font-bold text-orange-700">{it.quantity}</td>
                                    <td className="px-3 py-2 border-b border-orange-50 text-right font-bold text-zinc-800">${it.subtotal}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="px-4 py-3 bg-white flex justify-between items-center">
                              <div className="text-xs">
                                <span className="opacity-50">本次訂單總計: </span>
                                <span className="font-bold text-orange-800 text-base ml-1">${chat.data.total_amount}</span>
                              </div>
                              <button
                                onClick={() => { setConfirmOrderData(chat.data); setShippingInfo(chat.data.default_shipping); }}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold text-xs hover:bg-orange-700 transition-all shadow-md shadow-orange-900/10"
                              >
                                立即結帳
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-orange-100 flex gap-1">
                        <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}

                  {confirmOrderData && (
                    <div className="bg-orange-800 text-white p-5 rounded-3xl shadow-xl space-y-4">
                      <p className="font-bold text-lg border-b border-orange-700 pb-2">最後結帳確認</p>
                      <div className="space-y-3 bg-orange-900/40 p-3 rounded-2xl border border-orange-700">
                        <div>
                          <label className="text-[10px] font-bold opacity-60 uppercase block mb-1">付款方式</label>
                          <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full bg-orange-800 border-none rounded-lg text-xs p-2 text-white"
                          >
                            <option>現金</option>
                            <option>轉帳</option>
                            <option>LINE Pay</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold opacity-60 uppercase block mb-1">收件電話</label>
                          <input
                            type="text"
                            value={shippingInfo.phone}
                            onChange={e => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                            className="w-full bg-orange-800 border-none rounded-lg text-xs p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold opacity-60 uppercase block mb-1">配送地址</label>
                          <input
                            type="text"
                            value={shippingInfo.address}
                            onChange={e => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                            className="w-full bg-orange-800 border-none rounded-lg text-xs p-2 text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => setConfirmOrderData(null)} className="flex-1 py-3 bg-red-900/50 rounded-xl font-bold text-xs hover:bg-red-900 transition-all">取消</button>
                        <button onClick={handleConfirmOrder} className="flex-2 py-3 bg-green-500 rounded-xl font-bold text-xs text-green-950 hover:bg-green-400 transition-all">確認下單</button>
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleChatOrder} className="p-4 border-t border-orange-100 flex gap-2 bg-white">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="輸入您的需求..."
                    className="flex-1 bg-orange-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-200 transition-all text-zinc-800"
                  />
                  <button type="submit" disabled={loading} className="bg-orange-800 text-white p-3 rounded-xl hover:bg-orange-900 transition-all disabled:opacity-50 flex items-center justify-center">
                    <Send size={18} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main >

      {/* Product Form Modal (Simplified) */}
      < AnimatePresence >
        {showProductForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 p-8 rounded-[40px] w-full max-w-md border border-zinc-800 shadow-2xl">
              <h3 className="text-2xl font-bold mb-6 text-white text-center">產品資料編輯</h3>
              <form onSubmit={handleProductSubmit} className="space-y-4">
                <input placeholder="產品名稱" className="w-full bg-zinc-800 border-none rounded-xl p-4 text-white" value={productFormData.name} onChange={e => setProductFormData({ ...productFormData, name: e.target.value })} />
                <select className="w-full bg-zinc-800 border-none rounded-xl p-4 text-white" value={productFormData.supplier_id} onChange={e => setProductFormData({ ...productFormData, supplier_id: e.target.value })}>
                  <option value="">選擇供應商</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4 text-white">
                  <div>
                    <label className="text-[10px] font-bold uppercase opacity-30 px-1">實體庫存 (倉庫)</label>
                    <input type="number" className="w-full bg-zinc-800 border-none rounded-xl p-4 mt-1" value={productFormData.stock} onChange={e => setProductFormData({ ...productFormData, stock: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase opacity-30 px-1">可購庫存 (預扣)</label>
                    <input type="number" className="w-full bg-zinc-800 border-none rounded-xl p-4 mt-1" value={productFormData.available_stock} onChange={e => setProductFormData({ ...productFormData, available_stock: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-white">
                  <input type="number" placeholder="安全庫存" className="bg-zinc-800 border-none rounded-xl p-4" value={productFormData.safety_stock} onChange={e => setProductFormData({ ...productFormData, safety_stock: parseFloat(e.target.value) })} />
                  <input placeholder="單位 (斤/盒)" className="bg-zinc-800 border-none rounded-xl p-4" value={productFormData.unit} onChange={e => setProductFormData({ ...productFormData, unit: e.target.value })} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowProductForm(false)} className="flex-1 py-4 text-zinc-500 font-bold hover:text-white transition-all">取消</button>
                  <button type="submit" className="flex-1 py-4 bg-orange-600 rounded-2xl font-bold text-white shadow-lg shadow-orange-900/20">儲存產品</button>
                </div>
              </form>
            </motion.div>
          </div>
        )
        }

        {
          showProfileForm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[40px] w-full max-w-md border border-orange-100 shadow-2xl">
                <h3 className="text-2xl font-bold mb-6 text-orange-800 flex items-center gap-2"><User /> 編輯個人資料</h3>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-orange-300 uppercase mb-2 block tracking-widest">顯示名稱</label>
                    <input
                      className="w-full bg-orange-50 border-none rounded-2xl p-4"
                      value={profileFormData.display_name}
                      onChange={e => setProfileFormData({ ...profileFormData, display_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-orange-300 uppercase mb-2 block tracking-widest">聯絡電話</label>
                    <input
                      placeholder="例如: 0912345678"
                      className="w-full bg-orange-50 border-none rounded-2xl p-4"
                      value={profileFormData.phone}
                      onChange={e => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-orange-300 uppercase mb-2 block tracking-widest">預設配送地址</label>
                    <input
                      placeholder="請輸入完整收件地址"
                      className="w-full bg-orange-50 border-none rounded-2xl p-4"
                      value={profileFormData.shipping_address}
                      onChange={e => setProfileFormData({ ...profileFormData, shipping_address: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowProfileForm(false)} className="flex-1 py-4 text-orange-300 font-bold hover:text-orange-500 transition-all">取消</button>
                    <button type="submit" className="flex-1 py-4 bg-orange-800 rounded-2xl font-bold text-white shadow-lg shadow-orange-900/20">儲存更新</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )
        }
      </AnimatePresence >
      {/* Loss Form Modal */}
      < AnimatePresence >
        {showLossForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 p-8 rounded-[40px] w-full max-w-md border border-zinc-800 shadow-2xl">
              <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-2"><Trash2 className="text-red-500" /> 紀錄產品損耗</h3>
              <p className="text-zinc-500 text-sm mb-6">產品：{products.find(p => p.id === lossFormData.p_id)?.name}</p>
              <form onSubmit={handleLossSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">損耗數量</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-zinc-800 border-none rounded-xl p-4"
                    value={lossFormData.qty}
                    onChange={e => setLossFormData({ ...lossFormData, qty: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">損耗原因</label>
                  <select
                    className="w-full bg-zinc-800 border-none rounded-xl p-4"
                    value={lossFormData.reason}
                    onChange={e => setLossFormData({ ...lossFormData, reason: e.target.value })}
                  >
                    <option>損毀</option>
                    <option>過期</option>
                    <option>遺失</option>
                    <option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">紀錄日期</label>
                  <input
                    type="date"
                    className="w-full bg-zinc-800 border-none rounded-xl p-4"
                    value={lossFormData.date}
                    onChange={e => setLossFormData({ ...lossFormData, date: e.target.value })}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowLossForm(false)} className="flex-1 py-4 text-zinc-500 font-bold hover:text-white transition-all">取消</button>
                  <button type="submit" className="flex-1 py-4 bg-red-600 rounded-2xl font-bold text-white shadow-lg shadow-red-900/20">確認扣除庫存</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence >
      {/* Announcement Form Modal */}
      < AnimatePresence >
        {showAnnForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 p-8 rounded-[40px] w-full max-w-lg border border-zinc-800 shadow-2xl">
              <h3 className="text-2xl font-bold mb-6 text-white text-center">{editingAnnId ? '編輯公告' : '發布全站公告'}</h3>
              <form onSubmit={handleAnnSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-30 px-1">公告標題</label>
                  <input
                    placeholder="例如：春節連假出貨通知"
                    className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white mt-1 border border-zinc-700 focus:ring-2 focus:ring-orange-500 transition-all"
                    value={annFormData.title}
                    onChange={e => setAnnFormData({ ...annFormData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-30 px-1">公告日期</label>
                  <input
                    type="date"
                    className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white mt-1 border border-zinc-700 focus:ring-2 focus:ring-orange-500 transition-all"
                    value={annFormData.date}
                    onChange={e => setAnnFormData({ ...annFormData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-30 px-1">公告內容</label>
                  <textarea
                    placeholder="請輸入詳盡的公告內容..."
                    className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white h-32 mt-1 border border-zinc-700 focus:ring-2 focus:ring-orange-500 transition-all"
                    value={annFormData.content}
                    onChange={e => setAnnFormData({ ...annFormData, content: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAnnForm(false)} className="flex-1 py-4 text-zinc-500 font-bold hover:text-white transition-all">取消</button>
                  <button type="submit" className="flex-1 py-4 bg-orange-600 rounded-2xl font-bold text-white shadow-lg shadow-orange-900/20">
                    {editingAnnId ? '更新公告' : '立即發布'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence >
    </div >
  );
}

export default App;
