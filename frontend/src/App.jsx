import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Upload, LogIn, CheckCircle, Clock, XCircle, FileText, Calendar, Plus, Minus, ChevronRight, User, PenTool, LogOut, Info, Mail, Gift, Settings, BarChart2, Users, History, Activity, TrendingUp, Award, Sparkles, Compass, Bell, Megaphone, Trash2, Edit3, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE || "";

function App() {
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [memberStats, setMemberStats] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('events');
  const [showRegForm, setShowRegForm] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [showWishForm, setShowWishForm] = useState(false);
  const [wishes, setWishes] = useState([]);
  const [annFormData, setAnnFormData] = useState({ title: '', content: '', date: new Date().toISOString().split('T')[0], event_link_id: null });
  const [wishFormData, setWishFormData] = useState({ content: '', category: '活動希望' });
  const [editingAnnId, setEditingAnnId] = useState(null);
  const [regFormData, setRegFormData] = useState({
    user_name: '',
    birthday: '',
    participant_count: 1,
    notes: ''
  });
  const [profileFormData, setProfileFormData] = useState({ display_name: '', birthday: '' });
  const [selectedRegDetails, setSelectedRegDetails] = useState(null);
  const [expandedMember, setExpandedMember] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormData, setEventFormData] = useState({ name: '', date: '', amount: 0, description: '', reminder_date: '', reminder_deadline: '' });
  const [editingEventId, setEditingEventId] = useState(null);
  const [marketingMails, setMarketingMails] = useState([]);
  const [showMarketingForm, setShowMarketingForm] = useState(false);
  const [editingMarketingId, setEditingMarketingId] = useState(null);
  const [marketingFormData, setMarketingFormData] = useState({ subject: '', content: '', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '09:00' });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const eventIdParam = urlParams.get('event');

    if (code) {
      handleCallback(code);
    }

    if (eventIdParam && events.length > 0) {
      const target = events.find(e => e.id === parseInt(eventIdParam));
      if (target) {
        setSelectedEvent(target);
        if (isAdmin) fetchAdminRegistrations(target.id);

        // 檢查是否有登入後待處理的報名
        const pendingEventId = sessionStorage.getItem('pending_registration_event_id');
        if (pendingEventId && parseInt(pendingEventId) === target.id && token) {
          setRegFormData({
            user_name: currentUserProfile?.display_name || '',
            birthday: currentUserProfile?.birthday || '',
            participant_count: 1,
            notes: ''
          });
          setShowRegForm(true);
          sessionStorage.removeItem('pending_registration_event_id');
        }
      }
    }

    fetchEvents();
    fetchAnnouncements();
    if (token) {
      fetchMyProfile();
      fetchMyRegistrations();
      if (isAdmin) {
        fetchMemberStats();
        fetchWishes();
      }
    }
  }, [token, isAdmin, events.length]); // 加入 events.length 確保資料載入後才解析參數

  const handleLogin = async (eventId = null) => {
    if (eventId) {
      sessionStorage.setItem('pending_registration_event_id', eventId);
    }
    const res = await axios.get(`${API_BASE}/auth/login-url`);
    window.location.href = res.data.url;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    setToken(null);
    setIsAdmin(false);
    setCurrentUserProfile(null);
    setView('events');
    setSelectedEvent(null);
  };

  const handleCallback = async (code) => {
    try {
      const res = await axios.get(`${API_BASE}/auth/callback?code=${code}`);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('isAdmin', res.data.is_admin);
      setToken(res.data.access_token);
      setIsAdmin(res.data.is_admin);
      setCurrentUserProfile(res.data.user);

      // 如果有待處理的報名，確保選取該活動
      const pendingEventId = sessionStorage.getItem('pending_registration_event_id');
      if (pendingEventId) {
        window.history.replaceState({}, document.title, `/?event=${pendingEventId}`);
      } else {
        window.history.replaceState({}, document.title, "/");
      }
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const fetchMyProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUserProfile(res.data);
      setProfileFormData({ display_name: res.data.display_name || '', birthday: res.data.birthday || '' });

      // 自動校準權限：確保 .env 修改後重新整理即可生效
      if (res.data.is_admin !== undefined) {
        setIsAdmin(res.data.is_admin);
        localStorage.setItem('isAdmin', res.data.is_admin);
      }
    } catch (err) {
      console.error("Fetch profile failed", err.response?.data || err);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.patch(`${API_BASE}/me`,
        {
          display_name: profileFormData.display_name,
          birthday: profileFormData.birthday
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setCurrentUserProfile(res.data);
      setShowProfileEdit(false);
      alert("個人資料已更新");
      fetchMyRegistrations();
      if (isAdmin) fetchMemberStats();
    } catch (err) {
      console.error("Update failed", err.response?.data || err);
      alert("更新失敗");
    }
  };

  const fetchEvents = async () => {
    const res = await axios.get(`${API_BASE}/events`);
    const sorted = res.data.sort((a, b) => new Date(a.date) - new Date(b.date));
    setEvents(sorted);
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get(`${API_BASE}/announcements`);
      setAnnouncements(res.data);
    } catch (err) {
      console.error("Fetch announcements failed", err);
    }
  };

  const fetchMyRegistrations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my-registrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyRegistrations(res.data);
    } catch (err) {
      console.error("Fetch my registrations failed", err);
    }
  };

  const fetchAdminRegistrations = async (eventId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/events/${eventId}/registrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRegistrations(res.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchMemberStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/member-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMemberStats(res.data);
    } catch (err) {
      console.error("Fetch stats failed", err);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!token) return handleLogin();

    try {
      await axios.post(`${API_BASE}/events/${selectedEvent.id}/register`, null, {
        params: {
          user_name: regFormData.user_name,
          birthday: regFormData.birthday,
          participant_count: regFormData.participant_count,
          notes: regFormData.notes
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('報名成功！感謝參與，我們已發送確認信件至您的信箱，請查收明細。');
      setShowRegForm(false);
      fetchEvents();
      fetchMyRegistrations();
      if (isAdmin) fetchMemberStats();
    } catch (err) {
      alert(err.response?.data?.detail || '報名失敗');
    }
  };

  const handleAnnSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...annFormData, event_link_id: annFormData.event_link_id ? parseInt(annFormData.event_link_id) : null };
      if (editingAnnId) {
        await axios.patch(`${API_BASE}/admin/announcements/${editingAnnId}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/admin/announcements`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowAnnForm(false);
      setEditingAnnId(null);
      setAnnFormData({ title: '', content: '', date: new Date().toISOString().split('T')[0], event_link_id: null });
      fetchAnnouncements();
    } catch (err) {
      alert("儲存失敗");
    }
  };

  const fetchWishes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/wishes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWishes(res.data);
    } catch (err) {
      console.error("Fetch wishes failed", err);
    }
  };

  const handleWishSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/wishes`, wishFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowWishForm(false);
      setWishFormData({ content: '', category: '活動希望' });
      alert("願望已投遞至許願池！✨");
    } catch (err) {
      alert("投遞失敗");
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm("確定要刪除此公告嗎？")) return;
    try {
      await axios.delete(`${API_BASE}/admin/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnnouncements();
    } catch (err) {
      alert("刪除失敗");
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEventId) {
        await axios.patch(`${API_BASE}/admin/events/${editingEventId}`, eventFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE}/admin/events`, eventFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowEventForm(false);
      setEditingEventId(null);
      setEventFormData({ name: '', date: '', amount: 0, description: '', reminder_date: '', reminder_deadline: '' });
      fetchEvents();
      alert("活動已成功儲存");
    } catch (err) {
      alert("儲存活動失敗");
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("確定要刪除此活動嗎？這將會刪除所有相關的報名資料！")) return;
    try {
      await axios.delete(`${API_BASE}/admin/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEvents();
      if (selectedEvent?.id === id) setSelectedEvent(null);
      alert("活動已刪除");
    } catch (err) {
      alert("刪除活動失敗");
    }
  };

  const openEditEvent = (event) => {
    setEditingEventId(event.id);
    setEventFormData({
      name: event.name,
      date: new Date(event.date).toISOString().slice(0, 16),
      amount: event.amount,
      description: event.description || '',
      reminder_date: event.reminder_date || '',
      reminder_deadline: event.reminder_deadline || ''
    });
    setShowEventForm(true);
  };

  const handleTriggerReminders = async () => {
    if (!window.confirm("確定要對所有當前符合催繳日期（今日）的活動發送提醒信嗎？")) return;
    try {
      const res = await axios.post(`${API_BASE}/admin/reminders/trigger`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
    } catch (err) {
      alert("觸發失敗: " + (err.response?.data?.detail || "伺服器錯誤"));
    }
  };

  const toggleVipStatus = async (email, currentVip) => {
    try {
      const newVip = currentVip === 1 ? 0 : 1;
      await axios.patch(`${API_BASE}/admin/users/${email}/vip?is_vip=${newVip}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMemberStats();
    } catch (err) {
      alert("更新 VIP 狀態失敗");
    }
  };

  const fetchMarketingMails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/marketing-mails`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMarketingMails(res.data);
    } catch (err) {
      console.error("Fetch marketing mails failed", err);
    }
  };

  const handleMarketingSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMarketingId) {
        await axios.patch(`${API_BASE}/admin/marketing-mails/${editingMarketingId}`, marketingFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("行銷郵件排程已更新");
      } else {
        await axios.post(`${API_BASE}/admin/marketing-mails`, marketingFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("行銷郵件排程已儲存");
      }
      setShowMarketingForm(false);
      setEditingMarketingId(null);
      setMarketingFormData({ subject: '', content: '', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '09:00' });
      fetchMarketingMails();
    } catch (err) {
      alert(err.response?.data?.detail || "儲存排程失敗");
    }
  };

  const openEditMarketing = (mail) => {
    setEditingMarketingId(mail.id);
    setMarketingFormData({
      subject: mail.subject,
      content: mail.content,
      scheduled_date: mail.scheduled_date,
      scheduled_time: mail.scheduled_time || '09:00'
    });
    setShowMarketingForm(true);
  };

  const deleteMarketingMail = async (id) => {
    if (!window.confirm("確定要刪除此排程嗎？")) return;
    try {
      await axios.delete(`${API_BASE}/admin/marketing-mails/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMarketingMails();
    } catch (err) {
      alert("刪除失敗");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE}/upload-csv`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert("匯入成功！");
      fetchEvents();
      fetchMemberStats();
    } catch (err) {
      alert("匯入失敗: " + (err.response?.data?.detail || "只有管理員可以匯入"));
    }
  };

  const updatePaymentStatus = async (regId, status) => {
    try {
      await axios.patch(`${API_BASE}/registrations/${regId}/payment?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, payment_status: status } : r));
      if (selectedRegDetails?.id === regId) {
        setSelectedRegDetails(prev => ({ ...prev, payment_status: status }));
      }
      if (isAdmin) fetchMemberStats();
    } catch (err) {
      alert("更新失敗");
    }
  };

  const handleSelectMyRegistration = (reg) => {
    const event = events.find(e => e.id === reg.event_id);
    if (event) {
      setSelectedEvent(event);
    }
  };

  const today = new Date().setHours(0, 0, 0, 0);

  const activeEvents = events.filter(e => new Date(e.date) >= today);
  const historyEvents = events.filter(e => new Date(e.date) < today).sort((a, b) => new Date(b.date) - new Date(a.date));

  const eventsToShow = view === 'events' ? activeEvents : (view === 'history' ? historyEvents : []);

  // 檢查當前使用者是否已報名目前的 selectedEvent
  const checkRegistrationStatus = () => {
    if (!selectedEvent || !token) return null;
    return myRegistrations.find(r => r.event_id === selectedEvent.id);
  };

  const userRegInfo = checkRegistrationStatus();
  const isAdminView = ['stats', 'ann-admin', 'wish-admin', 'marketing'].includes(view);

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 ${isAdminView ? 'bg-[#11110F]' : 'bg-[#F9F7F2]'}`}>
      {/* Sidebar */}
      {/* Sidebar */}
      <aside className={`w-64 flex-shrink-0 border-r transition-all duration-500 flex flex-col shadow-sm relative z-50 ${isAdminView ? 'bg-[#141411] border-[#363632]' : 'bg-white border-[#D2B48C]/20'}`}>
        <div className="p-8">
          <h1 className={`text-2xl font-serif font-bold flex items-center gap-2 text-nowrap transition-colors ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>
            <span className="text-[#B87333]">✦</span> {isAdmin ? '管理平台' : '活動總覽'}
          </h1>
          <p className={`text-[10px] mt-1 uppercase tracking-widest font-bold transition-colors ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>Activity & Membership</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="space-y-1">
            <p className={`text-[9px] font-bold uppercase tracking-widest px-6 mb-2 transition-colors ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/30'}`}>主選單</p>
            <button
              onClick={() => { setView('events'); setSelectedEvent(null); }}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'events' ? 'bg-[#8FBC8F]/10 text-[#8FBC8F] font-bold' : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
            >
              <Activity size={18} /> {isAdmin ? '活動管理' : '當前項目'}
            </button>

            <button
              onClick={() => { setView('history'); setSelectedEvent(null); }}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'history' ? 'bg-amber-50 text-amber-600 font-bold' : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
            >
              <History size={18} /> 歷史回顧
            </button>

            <button
              onClick={() => { setView('ann-board'); setSelectedEvent(null); fetchAnnouncements(); }}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'ann-board' ? 'bg-indigo-50 text-indigo-600 font-bold' : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
            >
              <Megaphone size={18} /> 最新公告
            </button>

            {token && !isAdmin && (
              <>
                <button
                  onClick={() => { setView('my-registrations'); setSelectedEvent(null); }}
                  className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'my-registrations' ? 'bg-[#B87333]/10 text-[#B87333] font-bold' : 'text-[#4A4A4A]/60 hover:bg-gray-50'}`}
                >
                  <FileText size={18} /> 我的參與
                </button>

                <button
                  onClick={() => { setShowWishForm(true); }}
                  className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl text-[#4A4A4A]/60 hover:bg-gray-50 transition-all`}
                >
                  <PenTool size={18} /> 許願池
                </button>
              </>
            )}
          </div>

          {isAdmin && (
            <div className="pt-8 space-y-2">
              <p className={`text-[9px] font-bold uppercase tracking-widest px-6 mb-2 transition-colors ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/30'}`}>管理控制台</p>

              <button
                onClick={() => { setView('stats'); setSelectedEvent(null); fetchMemberStats(); }}
                className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'stats' ? (isAdminView ? 'bg-[#242421] text-[#F5F5F0] font-bold shadow-lg shadow-black/20' : 'bg-stone-100 text-[#4A4A4A] font-bold') : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
              >
                <Users size={18} /> 成員統計報告
              </button>

              <button
                onClick={() => { setView('ann-admin'); setSelectedEvent(null); fetchAnnouncements(); }}
                className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'ann-admin' ? (isAdminView ? 'bg-red-500/10 text-red-400 font-bold' : 'bg-red-50 text-red-600 font-bold') : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
              >
                <Bell size={18} /> 公告中心管理
              </button>

              <button
                onClick={() => { setView('marketing'); setSelectedEvent(null); fetchMarketingMails(); }}
                className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'marketing' ? (isAdminView ? 'bg-pink-500/10 text-pink-400 font-bold' : 'bg-pink-50 text-pink-600 font-bold') : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
              >
                <Mail size={18} /> 行銷郵件中心
              </button>

              <button
                onClick={() => { setView('wish-admin'); setSelectedEvent(null); fetchWishes(); }}
                className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all ${view === 'wish-admin' ? (isAdminView ? 'bg-purple-500/10 text-purple-400 font-bold' : 'bg-purple-50 text-purple-600 font-bold') : (isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50')}`}
              >
                <Award size={18} /> 許願池管理
              </button>

              <label className={`flex items-center gap-3 px-6 py-4 rounded-3xl cursor-pointer transition-all ${isAdminView ? 'text-[#A0A095] hover:bg-[#242421]' : 'text-[#4A4A4A]/60 hover:bg-gray-50'}`}>
                <Upload size={18} /> <span className="text-nowrap">匯入 CSV 名冊</span>
                <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </nav>

        {/* Member Section */}
        <div className={`p-6 border-t transition-all duration-500 ${isAdminView ? 'bg-[#1A1A17] border-[#363632]' : 'bg-gray-50/30 border-[#D2B48C]/10'}`}>
          {!token ? (
            <button onClick={handleLogin} className="w-full bg-[#8FBC8F] text-white py-4 rounded-3xl font-bold hover:bg-[#8FBC8F]/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100">
              <LogIn size={18} /> Google 登入
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[#B87333] shadow-sm flex-shrink-0 border transition-colors ${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/20'}`}>
                  <User size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-black truncate transition-colors ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>{currentUserProfile?.display_name || '探索者'}</p>
                    <button
                      onClick={() => setShowProfileEdit(true)}
                      className={`hover:bg-[#B87333]/10 p-1.5 rounded-lg transition-colors ml-1 flex-shrink-0 ${isAdminView ? 'text-stone-500' : 'text-[#B87333]'}`}
                    >
                      <Settings size={14} />
                    </button>
                  </div>
                  <p className={`text-[10px] font-mono truncate transition-colors ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>{currentUserProfile?.email}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all border shadow-sm ${isAdminView ? 'bg-red-900/10 text-red-400 border-red-900/20 hover:bg-red-900/30' : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-500 hover:text-white'}`}
              >
                <LogOut size={16} /> 登出系統
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* List Column (Side Panel) */}
        {!['stats', 'ann-admin', 'ann-board', 'wish-admin', 'marketing'].includes(view) && (
          <section className="w-80 flex-shrink-0 border-r border-[#D2B48C]/10 flex flex-col p-8 bg-[#FDFCF9]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-serif font-bold text-[#4A4A4A]">
                {view === 'events' ? '當前項目' : (view === 'history' ? '歷史回顧' : '參與足跡')}
              </h2>
              {isAdmin && (view === 'events' || view === 'history') && (
                <div className="flex gap-2">
                  <button
                    onClick={handleTriggerReminders}
                    className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-all shadow-md"
                    title="立即執行全站催繳檢查"
                  >
                    <Bell size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingEventId(null);
                      setEventFormData({ name: '', date: '', amount: 0, description: '', reminder_date: '', reminder_deadline: '' });
                      setShowEventForm(true);
                    }}
                    className="w-8 h-8 rounded-full bg-[#4A4A4A] text-white flex items-center justify-center hover:bg-black transition-all shadow-md"
                    title="發佈新活動"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {(view === 'events' || view === 'history') ? (
                eventsToShow.map(event => (
                  <motion.div
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      if (isAdmin) fetchAdminRegistrations(event.id);
                    }}
                    className={`group bg-white p-5 rounded-[24px] border transition-all duration-300 cursor-pointer ${selectedEvent?.id === event.id ? 'border-[#B87333] shadow-md ring-1 ring-[#B87333]/10' : 'border-[#D2B48C]/10 hover:border-[#D2B48C]/40 bg-white/50'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-base leading-tight text-[#4A4A4A] flex-1 line-clamp-2">{event.name}</h3>
                      {new Date(event.date) < today && (
                        <span className="text-[8px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-md font-bold ml-2 flex-shrink-0">已結束</span>
                      )}
                    </div>
                    <div className="mt-4 flex justify-between items-center text-[10px] font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-[#4A4A4A]/30 uppercase tracking-widest">{new Date(event.date).toLocaleDateString()}</span>
                        {isAdmin && (
                          <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditEvent(event); }}
                              className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-[#B87333] font-serif">${event.amount}</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                myRegistrations.map(reg => (
                  <motion.div
                    key={reg.id}
                    onClick={() => handleSelectMyRegistration(reg)}
                    className={`bg-white p-5 rounded-[24px] border transition-all duration-300 cursor-pointer ${selectedEvent?.id === reg.event_id ? 'border-[#B87333] shadow-md ring-1 ring-[#B87333]/10' : 'border-[#D2B48C]/10 hover:border-[#D2B48C]/40 bg-white/50'}`}
                  >
                    <h3 className="font-bold text-[#4A4A4A] text-sm leading-tight">{events.find(e => e.id === reg.event_id)?.name || '讀取中...'}</h3>
                    <div className="mt-4 flex justify-between items-center">
                      <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-widest ${reg.payment_status === '已付款' ? 'bg-[#8FBC8F]/10 text-[#8FBC8F]' : 'bg-[#B87333]/10 text-[#B87333]'
                        }`}>
                        {reg.payment_status}
                      </span>
                      <span className="text-[10px] text-[#4A4A4A]/40 font-bold">{new Date(reg.registration_date).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Content Column */}
        <section className={`flex-1 p-12 overflow-y-auto relative min-w-0 transition-colors duration-500 ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0]' : (['stats', 'ann-admin', 'ann-board'].includes(view) ? 'bg-white' : '')}`}>
          <AnimatePresence mode="wait">
            {view === 'stats' ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto py-8">
                <div className="mb-12">
                  <h2 className={`text-4xl font-serif font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>成員活動分析</h2>
                  <p className={`${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'} mt-3 font-bold uppercase tracking-widest`}>Membership Engagement Reports</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {memberStats.map(member => (
                    <div key={member.email} className={`${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'} rounded-[32px] border shadow-sm overflow-hidden transition-all hover:shadow-md`}>
                      <div className="p-8 flex items-center gap-6">
                        <div className={`w-16 h-16 ${isAdminView ? 'bg-[#1A1A17]' : 'bg-gray-50'} rounded-2xl flex items-center justify-center text-[#B87333] flex-shrink-0 shadow-inner`}>
                          <User size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h3 className={`text-2xl font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'} truncate`}>{member.display_name}</h3>
                            <div className="flex gap-2">
                              {member.is_vip === 1 && (
                                <span className="bg-pink-500/10 text-pink-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap flex items-center gap-1">
                                  <Heart size={10} fill="currentColor" /> 好顧客
                                </span>
                              )}
                              <span className="bg-[#8FBC8F]/10 text-[#8FBC8F] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">已參展: {member.paid_count}</span>
                              <span className="bg-[#B87333]/10 text-[#B87333] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">待處理: {member.pending_count}</span>
                            </div>
                          </div>
                          <p className={`text-sm ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'} font-mono mt-1`}>{member.email} • {member.birthday || '未填寫生日'}</p>
                        </div>
                        <button
                          onClick={() => toggleVipStatus(member.email, member.is_vip)}
                          className={`p-4 rounded-2xl transition-all shadow-sm ${member.is_vip === 1 ? 'bg-pink-500 text-white' : (isAdminView ? 'bg-[#1A1A17] text-[#A0A095]' : 'bg-gray-50 text-[#4A4A4A]/20')}`}
                          title={member.is_vip === 1 ? "取消好顧客標記" : "標記為好顧客"}
                        >
                          <Heart size={20} fill={member.is_vip === 1 ? "currentColor" : "none"} />
                        </button>
                        <button
                          onClick={() => setExpandedMember(expandedMember === member.email ? null : member.email)}
                          className={`p-4 rounded-2xl transition-all ${expandedMember === member.email ? (isAdminView ? 'bg-[#F5F5F0] text-[#1A1A17]' : 'bg-[#4A4A4A] text-white') : (isAdminView ? 'bg-[#1A1A17] text-[#A0A095]' : 'bg-gray-50 text-[#4A4A4A]/20 hover:text-[#4A4A4A]')} rotate-90`}
                        >
                          <ChevronRight size={24} className={`${expandedMember === member.email ? '' : '-rotate-90'}`} />
                        </button>
                      </div>

                      <AnimatePresence>
                        {expandedMember === member.email && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className={`overflow-hidden ${isAdminView ? 'bg-[#1A1A17] border-[#363632]' : 'bg-[#FDFCF9] border-[#D2B48C]/10'} border-t`}>
                            <div className="p-8 space-y-4">
                              <p className={`text-[10px] font-black ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/30'} uppercase tracking-widest`}>全期參與清單</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {member.registrations.map((reg, idx) => (
                                  <div key={idx} className={`${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'} p-5 rounded-[24px] border shadow-sm`}>
                                    <h4 className={`font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'} leading-tight mb-3 line-clamp-1`}>{reg.event_name}</h4>
                                    <div className="flex justify-between items-center">
                                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${reg.payment_status === '已付款' ? 'bg-[#8FBC8F]/10 text-[#8FBC8F]' : 'bg-[#B87333]/10 text-[#8FBC8F]/10'
                                        }`}>{reg.payment_status}</span>
                                      <span className={`text-[10px] ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'} font-bold`}>{new Date(reg.registration_date).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : view === 'marketing' ? (
              /* 行銷中心管理介面 */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto py-8">
                <div className="flex justify-between items-center mb-12">
                  <div>
                    <h2 className={`text-4xl font-serif font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>行銷郵件中心</h2>
                    <p className={`${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'} mt-3 font-bold uppercase tracking-widest`}>VIP Automated Marketing Scheduler</p>
                  </div>
                  <button
                    onClick={() => { setEditingMarketingId(null); setMarketingFormData({ subject: '', content: '', scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '09:00' }); setShowMarketingForm(true); }}
                    className={`px-8 py-4 rounded-3xl font-bold flex items-center gap-2 transition-all shadow-lg ${isAdminView ? 'bg-pink-500 text-white hover:bg-pink-400' : 'bg-pink-600 text-white hover:bg-pink-700'}`}
                  >
                    <Plus size={20} /> 新增活動排程
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {marketingMails.map(mail => (
                    <div key={mail.id} className={`${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'} rounded-[32px] border shadow-sm p-8 flex flex-col`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${mail.is_sent === 1 ? 'bg-[#8FBC8F]/10 text-[#8FBC8F]' : 'bg-pink-500/10 text-pink-400'
                          }`}>
                          {mail.is_sent === 1 ? '已發送' : '排程中'}
                        </span>
                        <div className="flex gap-2">
                          {mail.is_sent === 0 && (
                            <button onClick={() => openEditMarketing(mail)} className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all">
                              <Edit3 size={16} />
                            </button>
                          )}
                          <button onClick={() => deleteMarketingMail(mail.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <h3 className={`text-xl font-bold mb-3 ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>{mail.subject}</h3>
                      <p className={`text-sm flex-1 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/60'} line-clamp-3 mb-6`}>{mail.content}</p>
                      <div className="pt-6 border-t border-[#363632] flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={`text-[11px] font-bold uppercase tracking-widest ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>日期: {mail.scheduled_date}</span>
                          <span className="text-xl font-serif font-bold text-pink-400">{mail.scheduled_time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#B87333]">
                          對象: 指定 VIP 好顧客
                        </div>
                      </div>
                    </div>
                  ))}
                  {marketingMails.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-30">
                      <Mail size={48} className="mx-auto mb-4" />
                      <p className="font-serif">尚無排程紀錄</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : view === 'ann-admin' ? (
              /* 公告管理介面 */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto py-8">
                <div className="flex justify-between items-center mb-12">
                  <div>
                    <h2 className={`text-4xl font-serif font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>公告中心管理</h2>
                    <p className={`${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'} mt-3 font-bold uppercase tracking-widest`}>Announcement Control Center</p>
                  </div>
                  <button
                    onClick={() => { setEditingAnnId(null); setAnnFormData({ title: '', content: '', date: new Date().toISOString().split('T')[0], event_link_id: null }); setShowAnnForm(true); }}
                    className={`px-8 py-4 rounded-3xl font-bold flex items-center gap-2 transition-all shadow-lg ${isAdminView ? 'bg-[#F5F5F0] text-[#1A1A17] hover:bg-white' : 'bg-[#4A4A4A] text-white hover:bg-black'}`}
                  >
                    <Plus size={20} /> 發佈新公告
                  </button>
                </div>

                <div className="space-y-6">
                  {announcements.map(ann => (
                    <div key={ann.id} className={`${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'} p-8 rounded-[32px] border shadow-sm flex items-center justify-between group`}>
                      <div className="flex-1 min-w-0 mr-8">
                        <div className="flex items-center gap-4 mb-2">
                          <span className={`text-[10px] font-mono px-3 py-1 rounded-full font-bold uppercase tracking-widest ${isAdminView ? 'bg-[#1A1A17] text-[#A0A095]' : 'bg-stone-100 text-[#4A4A4A]/40'}`}>{ann.date}</span>
                          <h3 className={`text-xl font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'} truncate`}>{ann.title}</h3>
                        </div>
                        <p className={`text-sm line-clamp-1 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/60'}`}>{ann.content}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingAnnId(ann.id); setAnnFormData({ title: ann.title, content: ann.content, date: ann.date, event_link_id: ann.event_link_id }); setShowAnnForm(true); }}
                          className={`p-3 rounded-2xl transition-all ${isAdminView ? 'bg-[#1A1A17] text-indigo-400 hover:bg-indigo-400 hover:text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className={`p-3 rounded-2xl transition-all ${isAdminView ? 'bg-[#1A1A17] text-red-400 hover:bg-red-400 hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : view === 'wish-admin' ? (
              /* 許願池管理介面 */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto py-8">
                <div className="mb-12">
                  <h2 className={`text-4xl font-serif font-bold ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>許願池管理</h2>
                  <p className={`${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'} mt-3 font-bold uppercase tracking-widest`}>Community Wishes & Feedback</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {wishes.map(wish => (
                    <div key={wish.id} className={`${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'} p-8 rounded-[32px] border shadow-sm relative overflow-hidden group`}>
                      <div className="absolute top-0 right-0 p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${wish.category === '活動希望' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-500/20 text-orange-400'}`}>
                          {wish.category}
                        </span>
                      </div>
                      <p className={`text-lg leading-relaxed mb-6 font-medium italic ${isAdminView ? 'text-[#F5F5F0]' : 'text-[#4A4A4A]'}`}>"{wish.content}"</p>
                      <div className={`flex items-center gap-3 pt-6 border-t ${isAdminView ? 'border-[#363632]' : 'border-[#D2B48C]/5'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[#B87333] ${isAdminView ? 'bg-[#1A1A17]' : 'bg-gray-50'}`}>
                          <User size={14} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>{wish.user_email} • {new Date(wish.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (selectedEvent || view === 'ann-board') ? (
              <motion.div
                key={selectedEvent?.id || 'ann-board'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl"
              >
                {view === 'ann-board' ? (
                  <div className="space-y-12">
                    <div className="mb-16">
                      <h2 className="text-5xl font-serif font-bold text-[#4A4A4A] leading-tight">佈告欄</h2>
                      <p className="text-[#4A4A4A]/40 mt-3 font-bold uppercase tracking-widest">Platform Announcements & Updates</p>
                    </div>

                    <div className="space-y-10">
                      {announcements.map(ann => (
                        <div key={ann.id} className="bg-[#FDFCF9] p-10 rounded-[40px] border border-[#D2B48C]/10 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[#B87333]/5 rounded-bl-[100px] -z-0 transition-all group-hover:scale-110" />
                          <div className="relative z-10">
                            <span className="text-[10px] font-black text-[#B87333] uppercase tracking-[0.3em] mb-4 block">{ann.date}</span>
                            <h3 className="text-3xl font-serif font-bold text-[#4A4A4A] mb-6">{ann.title}</h3>
                            <p className="text-[#4A4A4A]/70 leading-relaxed whitespace-pre-line text-lg mb-8">
                              {ann.content}
                            </p>
                            {ann.event_link_id && (
                              <button
                                onClick={() => {
                                  const target = events.find(e => e.id === ann.event_link_id);
                                  if (target) {
                                    setView('events');
                                    setSelectedEvent(target);
                                  }
                                }}
                                className="flex items-center gap-2 text-[#8FBC8F] font-bold border-b border-[#8FBC8F] pb-1 hover:gap-4 transition-all"
                              >
                                查看關聯活動詳情 <ChevronRight size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {announcements.length === 0 && (
                        <div className="text-center py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
                          <p className="text-[#4A4A4A]/40 font-bold uppercase tracking-widest italic">目前尚無公告內容</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-[#B87333] font-bold text-[10px] mb-4 uppercase tracking-[0.2em]">
                      <span className="bg-[#B87333]/10 px-3 py-1 rounded-full">System Record</span>
                      <span>•</span>
                      <span>{new Date(selectedEvent.date).toLocaleDateString()}</span>
                    </div>
                    <h2 className="text-5xl font-serif font-bold text-[#4A4A4A] leading-[1.15] mb-8">{selectedEvent.name}</h2>
                    <div className="prose prose-lg prose-stone max-w-none">
                      <p className="text-[#4A4A4A]/70 text-xl leading-relaxed whitespace-pre-line border-l-4 border-[#8FBC8F]/30 pl-6 italic mb-12">
                        {selectedEvent.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-8 bg-white rounded-[32px] border border-[#D2B48C]/10 shadow-sm mb-12">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[#4A4A4A]/40 font-bold uppercase tracking-widest mb-1">費用 / 點數相關</span>
                        <span className="text-4xl font-serif font-bold text-[#B87333]">${selectedEvent.amount}</span>
                      </div>

                      {!isAdmin && new Date(selectedEvent.date) >= today && (
                        <>
                          {userRegInfo ? (
                            <div className="flex items-center gap-3 bg-[#F9F7F2] border border-[#8FBC8F]/30 px-8 py-4 rounded-[20px] font-black text-lg text-[#8FBC8F] shadow-sm">
                              <CheckCircle size={24} /> {userRegInfo.payment_status === '已付款' ? '已報名 (已付款)' : '已報名 (待付款)'}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (!token) return handleLogin(selectedEvent.id);
                                setRegFormData({
                                  user_name: currentUserProfile?.display_name || '',
                                  birthday: currentUserProfile?.birthday || '',
                                  participant_count: 1,
                                  notes: ''
                                });
                                setShowRegForm(true);
                              }}
                              className="bg-[#8FBC8F] text-white px-12 py-4 rounded-[20px] font-bold text-lg shadow-xl shadow-green-100 hover:bg-[#76a076] active:scale-95 transition-all flex items-center gap-2"
                            >
                              <Plus size={20} /> 立即報名
                            </button>
                          )}
                        </>
                      )}

                      {!isAdmin && new Date(selectedEvent.date) < today && (
                        <span className="bg-gray-100 text-gray-400 px-8 py-4 rounded-[20px] font-bold text-lg cursor-not-allowed border border-gray-200">活動已回顧</span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="mt-16 pt-16 border-t border-[#D2B48C]/10">
                        <div className="flex justify-between items-end mb-10">
                          <div>
                            <h3 className="text-3xl font-serif font-bold text-[#4A4A4A]">參與名冊</h3>
                            <p className="text-sm text-[#4A4A4A]/40 mt-2 font-bold uppercase tracking-widest">Administrative Access Only</p>
                          </div>
                          <div className="bg-[#8FBC8F]/5 px-5 py-2 rounded-2xl border border-[#8FBC8F]/20">
                            <span className="text-xl font-bold text-[#8FBC8F]">{registrations.length}</span> <span className="text-[10px] font-bold text-[#4A4A4A]/40">位登錄成員</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {registrations.map(reg => (
                            <div key={reg.id} className="group bg-white p-6 rounded-[28px] border border-[#D2B48C]/10 shadow-sm hover:shadow-md transition-all flex items-center gap-4 overflow-hidden">
                              <div className="flex flex-1 min-w-0 items-center gap-4 cursor-pointer" onClick={() => setSelectedRegDetails(reg)}>
                                <div className="w-12 h-12 bg-[#F9F7F2] rounded-2xl flex items-center justify-center text-[#B87333] flex-shrink-0">
                                  <User size={24} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-[#4A4A4A] truncate text-base">{reg.user_name}</h4>
                                  <p className="text-[10px] text-[#4A4A4A]/40 font-mono truncate">{reg.email}</p>
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => updatePaymentStatus(reg.id, '已付款')} title="標記已付款" className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${reg.payment_status === '已付款' ? 'bg-[#8FBC8F] text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-200 hover:text-[#8FBC8F]'}`}><CheckCircle size={22} /></button>
                                <button onClick={() => updatePaymentStatus(reg.id, '待付款')} title="標記待付款" className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${reg.payment_status === '待付款' ? 'bg-[#B87333] text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-200 hover:text-[#B87333]'}`}><Clock size={22} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              /* 空狀態：顯示佈告欄精華 */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full max-w-5xl mx-auto flex flex-col pt-12">
                <div className="mb-20 text-center">
                  <h2 className="text-6xl font-serif font-bold text-[#4A4A4A] mb-6">歡迎探索本平台</h2>
                  <p className="text-xl text-[#4A4A4A]/40 font-medium">請從左側列表選取活動，或查看下方最新公告資訊</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-8">
                    <Bell className="text-[#B87333]" size={32} />
                    <h3 className="text-3xl font-serif font-bold text-[#4A4A4A]">最新消息</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {announcements.slice(0, 4).map(ann => (
                      <motion.div
                        key={ann.id}
                        onClick={() => { setView('ann-board'); fetchAnnouncements(); }}
                        className="bg-white p-8 rounded-[40px] border border-[#D2B48C]/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-bold text-[#B87333] uppercase tracking-widest">{ann.date}</span>
                          <ChevronRight size={16} className="text-[#4A4A4A]/20" />
                        </div>
                        <h4 className="text-xl font-bold text-[#4A4A4A] mb-4 truncate">{ann.title}</h4>
                        <p className="text-sm text-[#4A4A4A]/40 line-clamp-2 leading-relaxed">{ann.content}</p>
                      </motion.div>
                    ))}
                    {announcements.length === 0 && (
                      <div className="col-span-2 py-16 bg-white/50 rounded-[40px] border-2 border-dashed border-[#D2B48C]/10 flex flex-col items-center justify-center text-[#4A4A4A]/20">
                        <Megaphone size={48} className="mb-4 opacity-50" />
                        <p className="font-bold uppercase tracking-widest">目前沒有發佈任何公告</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {/* Announcement CRUD Form */}
        {showAnnForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`w-full max-w-2xl rounded-[48px] shadow-2xl border transition-colors duration-500 overflow-hidden ${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'}`}>
              <div className={`p-10 flex items-center justify-between ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0]' : 'bg-[#4A4A4A] text-white'}`}>
                <h3 className="text-3xl font-serif font-bold">{editingAnnId ? '修改公告內容' : '發佈新公告'}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAdminView ? 'bg-[#242421]' : 'bg-white/10'}`}>
                  <Bell size={24} />
                </div>
              </div>
              <form onSubmit={handleAnnSubmit} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>發佈日期</label>
                    <input type="date" value={annFormData.date} required className={`w-full px-6 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold font-mono ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setAnnFormData({ ...annFormData, date: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>公告標題</label>
                    <input type="text" placeholder="輸入亮眼的標題..." value={annFormData.title} required className={`w-full px-8 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setAnnFormData({ ...annFormData, title: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>連結至特定活動 (可選)</label>
                    <select
                      value={annFormData.event_link_id || ''}
                      className={`w-full px-8 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`}
                      onChange={e => setAnnFormData({ ...annFormData, event_link_id: e.target.value || null })}
                    >
                      <option value="">無連結</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({new Date(e.date).toLocaleDateString()})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>詳細內容</label>
                  <textarea rows={8} placeholder="描述公告詳情..." value={annFormData.content} required className={`w-full px-8 py-6 rounded-[32px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold resize-none ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setAnnFormData({ ...annFormData, content: e.target.value })} />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowAnnForm(false)} className={`flex-1 py-4 font-bold rounded-2xl transition-colors ${isAdminView ? 'text-[#A0A095] hover:bg-[#1A1A17]' : 'text-[#4A4A4A]/40 hover:bg-gray-50'}`}>取消</button>
                  <button type="submit" className={`flex-[2] py-4 rounded-[32px] text-lg font-bold shadow-xl transition-all ${isAdminView ? 'bg-[#F5F5F0] text-[#1A1A17] hover:bg-white' : 'bg-[#4A4A4A] text-white hover:bg-black'}`}>立即儲存公告</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Event CRUD Form */}
        {showEventForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`w-full max-w-2xl rounded-[48px] shadow-2xl border transition-colors duration-500 overflow-hidden ${isAdminView ? 'bg-[#242421] border-[#363632]' : 'bg-white border-[#D2B48C]/10'}`}>
              <div className={`p-10 flex items-center justify-between ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0]' : 'bg-[#4A4A4A] text-white'}`}>
                <h3 className="text-3xl font-serif font-bold">{editingEventId ? '修改活動資訊' : '發佈新活動'}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAdminView ? 'bg-[#242421]' : 'bg-white/10'}`}>
                  <Calendar size={24} />
                </div>
              </div>
              <form onSubmit={handleEventSubmit} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>活動名稱</label>
                    <input type="text" placeholder="輸入活動名稱..." value={eventFormData.name} required className={`w-full px-8 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setEventFormData({ ...eventFormData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>活動日期與時間</label>
                    <input type="datetime-local" value={eventFormData.date} required className={`w-full px-6 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold font-mono ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setEventFormData({ ...eventFormData, date: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>報名費用 (TWD)</label>
                    <input type="number" placeholder="0" value={eventFormData.amount} required className={`w-full px-8 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setEventFormData({ ...eventFormData, amount: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>催繳執行日期</label>
                    <input
                      type="date"
                      value={eventFormData.reminder_date}
                      className={`w-full px-8 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`}
                      onChange={e => setEventFormData({ ...eventFormData, reminder_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>最後繳費截止日</label>
                    <input
                      type="date"
                      value={eventFormData.reminder_deadline}
                      className={`w-full px-8 py-4 rounded-[24px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`}
                      onChange={e => setEventFormData({ ...eventFormData, reminder_deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isAdminView ? 'text-[#A0A095]' : 'text-[#4A4A4A]/40'}`}>活動介紹</label>
                  <textarea rows={6} placeholder="描述活動詳情..." value={eventFormData.description} className={`w-full px-8 py-6 rounded-[32px] border-2 border-transparent focus:outline-none focus:bg-white transition-all font-bold resize-none ${isAdminView ? 'bg-[#1A1A17] text-[#F5F5F0] focus:border-stone-700 focus:text-black' : 'bg-gray-50 focus:border-indigo-500/20'}`} onChange={e => setEventFormData({ ...eventFormData, description: e.target.value })} />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowEventForm(false)} className={`flex-1 py-4 font-bold rounded-2xl transition-colors ${isAdminView ? 'text-[#A0A095] hover:bg-[#1A1A17]' : 'text-[#4A4A4A]/40 hover:bg-gray-50'}`}>取消</button>
                  <button type="submit" className={`flex-[2] py-4 rounded-[32px] text-lg font-bold shadow-xl transition-all ${isAdminView ? 'bg-[#F5F5F0] text-[#1A1A17] hover:bg-white' : 'bg-[#4A4A4A] text-white hover:bg-black'}`}>儲存活動資訊</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Wish Form (許願池) */}
        {showWishForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white w-full max-w-xl rounded-[48px] shadow-2xl border border-[#D2B48C]/10 overflow-hidden">
              <div className="bg-[#B87333] p-10 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-serif font-bold">投遞心願到許願池</h3>
                  <p className="text-white/60 text-xs mt-1 uppercase tracking-widest font-bold">Wishing Well Entry</p>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center">
                  <Sparkles size={32} />
                </div>
              </div>
              <form onSubmit={handleWishSubmit} className="p-10 space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest ml-2">我想提交...</label>
                  <div className="flex gap-3">
                    {['活動希望', '改善建議'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setWishFormData({ ...wishFormData, category: cat })}
                        className={`flex-1 py-4 rounded-2xl font-bold transition-all border-2 ${wishFormData.category === cat ? 'bg-[#4A4A4A] border-[#4A4A4A] text-white shadow-lg' : 'bg-gray-50 border-transparent text-[#4A4A4A]/40 hover:bg-white hover:border-gray-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest ml-2">願望內容</label>
                  <textarea
                    rows={6}
                    placeholder={wishFormData.category === '活動希望' ? "希望能舉辦什麼樣的活動呢？" : "有哪些地方我們可以做得更好？"}
                    value={wishFormData.content}
                    required
                    className="w-full px-8 py-6 rounded-[32px] bg-gray-50 border-2 border-transparent focus:border-[#B87333]/20 focus:outline-none focus:bg-white transition-all font-bold resize-none"
                    onChange={e => setWishFormData({ ...wishFormData, content: e.target.value })}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowWishForm(false)} className="flex-1 py-4 font-bold text-[#4A4A4A]/40">取消</button>
                  <button type="submit" className="flex-[2] bg-[#B87333] text-white py-4 rounded-[32px] text-lg font-bold shadow-xl shadow-orange-100 hover:bg-[#a0632b] transition-all">投遞願望</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Registration Form */}
        {showRegForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#4A4A4A]/20 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl border border-[#D2B48C]/20 overflow-hidden">
              <div className="bg-[#F9F7F2] p-10 text-center border-b border-[#D2B48C]/10">
                <h3 className="text-3xl font-serif font-bold text-[#4A4A4A]">參與資料登記</h3>
                <p className="text-sm text-[#4A4A4A]/50 mt-2 italic">{selectedEvent?.name}</p>
              </div>
              <form onSubmit={handleRegisterSubmit} className="p-10 space-y-8">
                <div className="space-y-2 px-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest">姓名</label>
                    {currentUserProfile?.display_name && (
                      <span className="text-[9px] font-bold text-[#8FBC8F] bg-[#8FBC8F]/5 px-2 py-0.5 rounded-md">引自個人檔案</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={regFormData.user_name}
                    required
                    disabled={!!currentUserProfile?.display_name}
                    className={`w-full px-6 py-4 rounded-[20px] border-2 border-transparent transition-all font-bold ${currentUserProfile?.display_name ? 'bg-gray-50 text-[#4A4A4A]/30 cursor-not-allowed' : 'bg-[#F9F7F2]/60 focus:border-[#8FBC8F]/20 focus:outline-none focus:bg-white'}`}
                    onChange={e => setRegFormData({ ...regFormData, user_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2 px-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest">生日</label>
                    {currentUserProfile?.birthday && (
                      <span className="text-[9px] font-bold text-[#8FBC8F] bg-[#8FBC8F]/5 px-2 py-0.5 rounded-md">引自個人檔案</span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={regFormData.birthday}
                    required
                    disabled={!!currentUserProfile?.birthday}
                    className={`w-full px-6 py-4 rounded-[20px] border-2 border-transparent transition-all font-bold ${currentUserProfile?.birthday ? 'bg-gray-50 text-[#4A4A4A]/30 cursor-not-allowed' : 'bg-[#F9F7F2]/60 focus:border-[#8FBC8F]/20 focus:outline-none focus:bg-white'}`}
                    onChange={e => setRegFormData({ ...regFormData, birthday: e.target.value })}
                  />
                </div>
                <div className="space-y-6">
                  {/* 人數選擇 */}
                  <div className="space-y-2 px-2">
                    <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest">參加人數</label>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center bg-[#F9F7F2]/60 rounded-[24px] p-1 border-2 border-transparent">
                        <button
                          type="button"
                          onClick={() => setRegFormData({ ...regFormData, participant_count: Math.max(1, regFormData.participant_count - 1) })}
                          className="w-12 h-12 rounded-[20px] flex items-center justify-center text-[#4A4A4A]/40 hover:bg-white hover:text-[#8FBC8F] transition-all hover:shadow-sm"
                        >
                          <Minus size={20} />
                        </button>
                        <div className="w-16 text-center">
                          <span className="text-2xl font-serif font-bold text-[#4A4A4A]">{regFormData.participant_count}</span>
                          <span className="text-[10px] font-bold text-[#4A4A4A]/40 ml-1">人</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRegFormData({ ...regFormData, participant_count: Math.min(10, regFormData.participant_count + 1) })}
                          className="w-12 h-12 rounded-[20px] flex items-center justify-center text-[#4A4A4A]/40 hover:bg-white hover:text-[#8FBC8F] transition-all hover:shadow-sm"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <div className="flex-1 bg-[#8FBC8F]/5 border border-[#8FBC8F]/10 rounded-2xl px-6 py-3 flex justify-between items-center">
                        <span className="text-[10px] text-[#4A4A4A]/40 font-bold uppercase tracking-widest">總額試算</span>
                        <span className="text-2xl font-serif font-bold text-[#B87333]">${selectedEvent.amount * regFormData.participant_count}</span>
                      </div>
                    </div>
                  </div>

                  {/* 備註需求 */}
                  <div className="space-y-2 px-2">
                    <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest">需求備註 (選填)</label>
                    <textarea
                      placeholder="例如：有小孩同行、素食需求等..."
                      value={regFormData.notes}
                      className="w-full px-6 py-4 rounded-[20px] bg-[#F9F7F2]/60 border-2 border-transparent focus:border-[#8FBC8F]/20 focus:outline-none focus:bg-white transition-all font-bold min-h-[120px] resize-none"
                      onChange={e => setRegFormData({ ...regFormData, notes: e.target.value })}
                    />
                  </div>
                </div>

                {(currentUserProfile?.display_name || currentUserProfile?.birthday) && (
                  <div className="px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                        您的部分報名資訊已鎖定。如需修改，請先前往
                        <button
                          type="button"
                          onClick={() => { setShowRegForm(false); setShowProfileEdit(true); }}
                          className="mx-1 text-amber-600 border-b border-amber-600 hover:text-amber-700 transition-colors"
                        >
                          個人檔案設定
                        </button>
                        更新資料。
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowRegForm(false)} className="flex-1 px-8 py-4 rounded-[20px] font-bold text-[#4A4A4A]/40 hover:bg-gray-50">放棄填寫</button>
                  <button type="submit" className="flex-[2] bg-[#8FBC8F] text-white py-4 rounded-[20px] text-lg font-bold shadow-xl shadow-green-100 hover:bg-[#76a076] transition-all">確認送出報名</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Profile Edit Modal */}
        {showProfileEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[101] flex items-center justify-center bg-[#4A4A4A]/30 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white w-full max-w-md rounded-[48px] shadow-2xl border border-[#D2B48C]/20 overflow-hidden">
              <div className="bg-[#B87333]/5 p-10 text-center border-b border-[#D2B48C]/10">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#B87333] shadow-sm mx-auto mb-4 border border-[#D2B48C]/10">
                  <Settings size={28} />
                </div>
                <h3 className="text-2xl font-serif font-bold text-[#4A4A4A]">個人基本資料</h3>
              </div>
              <form onSubmit={handleProfileUpdate} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest ml-2">顯示姓名</label>
                  <input
                    type="text"
                    value={profileFormData.display_name}
                    required
                    className="w-full px-6 py-4 rounded-[24px] bg-gray-50 border-2 border-transparent focus:border-[#8FBC8F]/20 focus:outline-none focus:bg-white transition-all font-bold"
                    onChange={e => setProfileFormData({ ...profileFormData, display_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#4A4A4A]/40 uppercase tracking-widest ml-2">預設生日</label>
                  <input
                    type="date"
                    value={profileFormData.birthday}
                    className="w-full px-6 py-4 rounded-[24px] bg-gray-50 border-2 border-transparent focus:border-[#8FBC8F]/20 focus:outline-none focus:bg-white transition-all font-bold"
                    onChange={e => setProfileFormData({ ...profileFormData, birthday: e.target.value })}
                  />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowProfileEdit(false)} className="flex-1 py-4 font-bold text-[#4A4A4A]/30">取消</button>
                  <button type="submit" className="flex-[2] bg-[#4A4A4A] text-white py-4 rounded-[24px] font-bold shadow-lg hover:bg-black transition-all">更新並同步</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Admin Detail Modal */}
        {selectedRegDetails && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[101] flex items-center justify-center bg-[#4A4A4A]/20 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white w-full max-w-md rounded-[48px] shadow-2xl border border-[#D2B48C]/20 overflow-hidden">
              <div className="bg-stone-50 p-8 flex items-center gap-4 border-b border-stone-100">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-[#8FBC8F] shadow-sm border border-stone-100">
                  <Info size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#4A4A4A]">報名紀錄彙整</h3>
                  <p className="text-[10px] font-bold text-[#4A4A4A]/40 uppercase tracking-widest mt-1">Ref ID: {selectedRegDetails.id}</p>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-[#F9F7F2]/50 p-4 rounded-[24px]">
                    <User className="text-[#B87333] flex-shrink-0" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase text-[#4A4A4A]/40">姓名</p>
                      <p className="font-bold text-[#4A4A4A] truncate">{selectedRegDetails.user_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-[#F9F7F2]/50 p-4 rounded-[24px]">
                    <Mail className="text-[#B87333] flex-shrink-0" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase text-[#4A4A4A]/40">電郵</p>
                      <p className="font-bold text-[#4A4A4A] text-sm font-mono truncate">{selectedRegDetails.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-[#F9F7F2]/50 p-4 rounded-[24px]">
                    <Gift className="text-[#B87333] flex-shrink-0" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase text-[#4A4A4A]/40">生日紀錄</p>
                      <p className="font-bold text-[#4A4A4A] truncate">{selectedRegDetails.birthday}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-[#F9F7F2]/50 p-4 rounded-[24px]">
                    <Users className="text-[#B87333] mt-1 flex-shrink-0" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase text-[#4A4A4A]/40">參加人數</p>
                      <p className="font-bold text-[#4A4A4A]">{selectedRegDetails.participant_count} 人</p>
                    </div>
                  </div>
                  {selectedRegDetails.notes && (
                    <div className="flex items-start gap-4 bg-[#F9F7F2]/50 p-4 rounded-[24px]">
                      <MessageSquare className="text-[#B87333] mt-1 flex-shrink-0" size={20} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase text-[#4A4A4A]/40">需求備註</p>
                        <p className="text-sm font-medium text-[#4A4A4A] leading-relaxed break-words">{selectedRegDetails.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updatePaymentStatus(selectedRegDetails.id, '已付款')} className={`flex-1 py-4 rounded-[20px] flex items-center justify-center gap-2 font-bold transition-all ${selectedRegDetails.payment_status === '已付款' ? 'bg-[#8FBC8F] text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-[#4A4A4A]/40 hover:bg-gray-100'}`}>已付款</button>
                  <button onClick={() => updatePaymentStatus(selectedRegDetails.id, '待付款')} className={`flex-1 py-4 rounded-[20px] flex items-center justify-center gap-2 font-bold transition-all ${selectedRegDetails.payment_status === '待付款' ? 'bg-[#B87333] text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-[#4A4A4A]/40 hover:bg-gray-100'}`}>待付款</button>
                </div>
                <button onClick={() => setSelectedRegDetails(null)} className="w-full py-4 text-[#4A4A4A]/20 font-bold hover:text-[#4A4A4A] transition-colors">取消並返回</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Marketing Mail Form Modal */}
        {showMarketingForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[101] flex items-center justify-center bg-[#11110F]/60 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#1A1A17] w-full max-w-xl rounded-[48px] shadow-2xl border border-[#363632] overflow-hidden">
              <div className="bg-[#242421] p-10 text-center border-b border-[#363632]">
                <div className="w-16 h-16 bg-pink-500/10 rounded-2xl flex items-center justify-center text-pink-400 mx-auto mb-4">
                  <Mail size={28} />
                </div>
                <h3 className="text-2xl font-serif font-bold text-[#F5F5F0]">
                  {editingMarketingId ? "編輯行銷郵件排程" : "建立行銷郵件排程"}
                </h3>
                <p className="text-[10px] text-pink-400 font-bold uppercase tracking-widest mt-2 px-3 py-1 bg-pink-500/5 rounded-full inline-block">發送對象：全體好顧客 (VIP)</p>
              </div>
              <form onSubmit={handleMarketingSubmit} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#A0A095] uppercase tracking-widest ml-2">郵件主旨</label>
                  <input
                    type="text"
                    placeholder="例如：【快閃特惠】中秋限定活動開跑！"
                    value={marketingFormData.subject}
                    required
                    className="w-full px-6 py-4 rounded-[24px] bg-[#242421] border-2 border-transparent text-[#F5F5F0] focus:border-pink-500/20 focus:outline-none transition-all font-bold placeholder:text-[#A0A095]/30"
                    onChange={e => setMarketingFormData({ ...marketingFormData, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#A0A095] uppercase tracking-widest ml-2">行銷內容</label>
                  <textarea
                    placeholder="請輸入郵件內容..."
                    value={marketingFormData.content}
                    required
                    className="w-full px-6 py-4 rounded-[24px] bg-[#242421] border-2 border-transparent text-[#F5F5F0] focus:border-pink-500/20 focus:outline-none transition-all font-bold min-h-[160px] resize-none placeholder:text-[#A0A095]/30"
                    onChange={e => setMarketingFormData({ ...marketingFormData, content: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#A0A095] uppercase tracking-widest ml-2">預約排程日期</label>
                    <input
                      type="date"
                      value={marketingFormData.scheduled_date}
                      required
                      className="w-full px-6 py-4 rounded-[24px] bg-[#242421] border-2 border-transparent text-[#F5F5F0] focus:border-pink-500/20 focus:outline-none transition-all font-bold"
                      onChange={e => setMarketingFormData({ ...marketingFormData, scheduled_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#A0A095] uppercase tracking-widest ml-2">發送時間</label>
                    <input
                      type="time"
                      value={marketingFormData.scheduled_time}
                      required
                      className="w-full px-6 py-4 rounded-[24px] bg-[#242421] border-2 border-transparent text-[#F5F5F0] focus:border-pink-500/20 focus:outline-none transition-all font-bold"
                      onChange={e => setMarketingFormData({ ...marketingFormData, scheduled_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowMarketingForm(false)} className="flex-1 py-4 font-bold text-[#A0A095]">取消</button>
                  <button type="submit" className="flex-[2] bg-pink-600 text-white py-4 rounded-[24px] font-bold shadow-lg shadow-pink-900/20 hover:bg-pink-500 transition-all">
                    {editingMarketingId ? "確認修改" : "儲存並預約發送"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}

export default App;
