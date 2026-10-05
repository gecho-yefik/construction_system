"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// Types
interface ProjectItem {
  id: string;
  name: string;
  code: string;
  manager: string;
  status: "Completed" | "In Progress" | "To Do";
  progress: number;
  endDate: string;
  budget?: number;
}

interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  time: string;
  type: "project" | "request" | "order" | "user" | "payment" | "ai" | "report";
  priority?: "HIGH" | "MEDIUM" | "LOW";
  link?: string;
  read?: boolean;
}

interface AdminOverviewData {
  metrics: {
    totalProjects: number;
    completedProjects: number;
    inProgressProjects: number;
    todoProjects: number;
    completedPercentage: number;
    inProgressPercentage: number;
    todoPercentage: number;
    totalUsers: number;
    totalExpenses: number;
    totalBudget: number;
    remainingBudget: number;
    spentPercentage: number;
    remainingPercentage: number;
    totalSuppliers: number;
    totalMaterials: number;
    materialRequestsCount: number;
    totalWorkforce: number;
  };
  projects: ProjectItem[];
  activities: ActivityItem[];
  aiPredictions: {
    predictedFinalCost: number;
    costVariancePercentage: string;
    projectsAtRisk: number;
    riskBreakdown: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [activeMenu, setActiveMenu] = useState<string>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Language state
  const [currentLang, setCurrentLang] = useState<{ code: string; name: string; native: string; flag: string }>({
    code: "en",
    name: "English",
    native: "English (US)",
    flag: "🇺🇸",
  });

  const languageOptions = [
    { code: "en", name: "English", native: "English (US)", flag: "🇺🇸" },
    { code: "am", name: "Amharic", native: "አማርኛ", flag: "🇪🇹" },

  ];

  // Refs for outside click handling and shortcuts
  const notificationsRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Time filter states for charts
  const [costFilter, setCostFilter] = useState("This Year");
  const [delayFilter, setDelayFilter] = useState("This Year");
  const [budgetFilter, setBudgetFilter] = useState("This Year");

  // Notifications state with read tracking
  const [notificationList, setNotificationList] = useState<ActivityItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Initialize theme and language from local storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("admin_theme");
      if (savedTheme === "dark") {
        setDarkMode(true);
        document.documentElement.classList.add("dark");
      }
      const savedLang = localStorage.getItem("admin_language");
      if (savedLang) {
        const found = languageOptions.find((l) => l.code === savedLang);
        if (found) setCurrentLang(found);
      }
    }
  }, []);

  // Sync dark mode toggle
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) {
          document.documentElement.classList.add("dark");
          localStorage.setItem("admin_theme", "dark");
        } else {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("admin_theme", "light");
        }
      }
      return next;
    });
  };

  // Keyboard shortcut (Ctrl + / or Cmd + / to search, Escape to close dropdowns)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === "Escape") {
        setNotificationsOpen(false);
        setLanguageOpen(false);
        setProfileDropdownOpen(false);
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (languageRef.current && !languageRef.current.contains(e.target as Node)) {
        setLanguageOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real state initialized to 0 / empty
  const [data, setData] = useState<AdminOverviewData>({
    metrics: {
      totalProjects: 0,
      completedProjects: 0,
      inProgressProjects: 0,
      todoProjects: 0,
      completedPercentage: 0,
      inProgressPercentage: 0,
      todoPercentage: 0,
      totalUsers: 0,
      totalExpenses: 0,
      totalBudget: 0,
      remainingBudget: 0,
      spentPercentage: 0,
      remainingPercentage: 0,
      totalSuppliers: 0,
      totalMaterials: 0,
      materialRequestsCount: 0,
      totalWorkforce: 0,
    },
    projects: [],
    activities: [],
    aiPredictions: {
      predictedFinalCost: 0,
      costVariancePercentage: "0%",
      projectsAtRisk: 0,
      riskBreakdown: {
        high: 0,
        medium: 0,
        low: 0,
      },
    },
  });

  // Fetch real data & real notifications from live database API
  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/overview");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load admin overview:", err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchRealNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const json = await res.json();
          if (json.notifications && Array.isArray(json.notifications)) {
            // Read status from local storage if available
            const readIds = JSON.parse(localStorage.getItem("admin_read_notifications") || "[]");
            const updated = json.notifications.map((n: ActivityItem) => ({
              ...n,
              read: readIds.includes(n.id) ? true : n.read || false,
            }));
            setNotificationList(updated);
            const unread = updated.filter((n: ActivityItem) => !n.read).length;
            setUnreadNotificationCount(unread);
          }
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    }

    fetchOverview();
    fetchRealNotifications();

    // Live background polling for new notifications every 30s
    const interval = setInterval(fetchRealNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Notification handlers
  const handleMarkAllNotificationsRead = () => {
    setNotificationList((prev) => {
      const readIds = prev.map((n) => n.id);
      if (typeof window !== "undefined") {
        localStorage.setItem("admin_read_notifications", JSON.stringify(readIds));
      }
      return prev.map((act) => ({ ...act, read: true }));
    });
    setUnreadNotificationCount(0);
  };

  const handleClearNotifications = () => {
    setNotificationList([]);
    setUnreadNotificationCount(0);
  };

  const handleNotificationClick = (id: string, link?: string) => {
    setNotificationList((prev) =>
      prev.map((act) => {
        if (act.id === id && !act.read) {
          if (typeof window !== "undefined") {
            const readIds = JSON.parse(localStorage.getItem("admin_read_notifications") || "[]");
            if (!readIds.includes(id)) {
              localStorage.setItem("admin_read_notifications", JSON.stringify([...readIds, id]));
            }
          }
          setUnreadNotificationCount((count) => Math.max(0, count - 1));
          return { ...act, read: true };
        }
        return act;
      })
    );
  };

  const handleDismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotificationList((prev) => {
      const item = prev.find((n) => n.id === id);
      if (item && !item.read) {
        setUnreadNotificationCount((count) => Math.max(0, count - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
  };

  // Filter projects by search
  const displayedProjects = data.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}k`;
    }
    return `$${amount.toLocaleString()}`;
  };

  // Menu items matching the sidebar
  const menuItems = [
    { name: "Dashboard", icon: "dashboard", href: "#" },
    { name: "Projects", icon: "projects", href: "/projects" },
    { name: "Users", icon: "users", href: "#" },
    { name: "Suppliers", icon: "suppliers", href: "#" },
    { name: "Materials", icon: "materials", href: "#" },
    { name: "Inventory", icon: "inventory", href: "#" },
    { name: "Procurement", icon: "procurement", href: "/procurement-officer" },
    { name: "Workforce", icon: "workforce", href: "/hr-manager" },
    { name: "Financials", icon: "financials", href: "/accountant" },
    { name: "Reports", icon: "reports", href: "#" },
    { name: "AI Predictions", icon: "ai", href: "/ai-analytics" },
    { name: "Notifications", icon: "notifications", badge: unreadNotificationCount, href: "#" },
    { name: "Settings", icon: "settings", href: "#" },
    { name: "Activity Log", icon: "activity", href: "#" },
  ];

  const renderSidebarIcon = (iconName: string) => {
    switch (iconName) {
      case "dashboard":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
          </svg>
        );
      case "projects":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case "users":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case "suppliers":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        );
      case "materials":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case "inventory":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case "procurement":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "workforce":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case "financials":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "reports":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case "ai":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case "notifications":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      case "settings":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "activity":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          </svg>
        );
    }
  };

  // Circumference for r=38 is 2 * PI * 38 = ~238.76
  const totalCircumference = 238.76;
  const completedDash = (data.metrics.completedPercentage / 100) * totalCircumference;
  const inProgressDash = (data.metrics.inProgressPercentage / 100) * totalCircumference;
  const todoDash = (data.metrics.todoPercentage / 100) * totalCircumference;

  return (
    <div className={`min-h-screen flex bg-[#F4F6F9] dark:bg-slate-950 font-sans antialiased text-[#2D3748] dark:text-slate-100 transition-colors ${darkMode ? "dark" : ""}`}>
      {/* -------------------- LEFT SIDEBAR -------------------- */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-20"
          } transition-all duration-300 bg-[#0B132B] text-slate-300 flex flex-col justify-between shrink-0 shadow-2xl z-30 min-h-screen fixed lg:static`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Brand */}
          <div className="px-5 py-6 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <path d="M9 9v.01" />
                <path d="M9 13v.01" />
                <path d="M9 17v.01" />
              </svg>
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-lg font-extrabold tracking-tight text-white leading-tight">
                  BuildMaster
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  CONSTRUCTION MANAGEMENT
                </span>
              </div>
            )}
          </div>

          {/* User Profile Card */}
          <div className="px-4 py-4 border-b border-slate-800/60">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "A"}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0B132B] rounded-full"></span>
              </div>
              {sidebarOpen && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white truncate">
                    {session?.user?.name || "Admin "}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {(session?.user as { role?: string })?.role?.replace("_", " ") || "System Administrator"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Menu Items List */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const isActive = activeMenu === item.name;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setActiveMenu(item.name)}
                  className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 group relative ${isActive
                    ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                    }`}
                >
                  <span className={`shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}>
                    {renderSidebarIcon(item.icon)}
                  </span>
                  {sidebarOpen && (
                    <span className="flex-1 text-left truncate">{item.name}</span>
                  )}
                  {sidebarOpen && Boolean(item.badge && item.badge > 0) && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Logout */}
          <div className="p-4 border-t border-slate-800/80">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* -------------------- MAIN CONTENT WRAPPER -------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs transition-colors">
          {/* Left: Hamburger & Title */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation menu"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                {activeMenu}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal hidden sm:block">
                Overview of construction management system
              </p>
            </div>
          </div>

          {/* Right: Search, Actions, Notifications, Theme, Language & Profile */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            {/* Search Input with Instant Results dropdown */}
            <div ref={searchRef} className="relative hidden md:block w-64 lg:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search projects, modules..."
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                className="w-full pl-9 pr-16 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1">
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                    title="Clear search"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <kbd
                  onClick={() => searchInputRef.current?.focus()}
                  className="cursor-pointer px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  Ctrl + /
                </kbd>
              </div>

              {/* Instant Search Popup Dropdown */}
              {searchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 py-3 z-50 animate-fadeIn max-h-96 overflow-y-auto">
                  {/* Matching Projects */}
                  <div className="px-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Projects ({displayedProjects.length})
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {displayedProjects.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 py-1">No projects matched</p>
                      ) : (
                        displayedProjects.slice(0, 4).map((p) => (
                          <Link
                            key={p.id}
                            href={`/projects`}
                            onClick={() => setSearchFocused(false)}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <div>
                              <p className="font-semibold">{p.name}</p>
                              <span className="text-[10px] text-slate-400">{p.code} &bull; {p.manager}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                              {p.status}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Matching System Modules */}
                  <div className="px-3 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Quick Jump
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {menuItems
                        .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .slice(0, 4)
                        .map((m) => (
                          <Link
                            key={m.name}
                            href={m.href}
                            onClick={() => {
                              setActiveMenu(m.name);
                              setSearchFocused(false);
                            }}
                            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <span className="text-blue-500">{renderSidebarIcon(m.icon)}</span>
                            <span className="font-medium">{m.name}</span>
                          </Link>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell with working dropdown & mark all read */}
            <div ref={notificationsRef} className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setLanguageOpen(false);
                  setProfileDropdownOpen(false);
                }}
                aria-label="View notifications"
                title="Notifications"
                className={`p-2.5 rounded-xl relative focus:outline-none transition-colors ${notificationsOpen
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-4 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Notifications</span>
                      {unreadNotificationCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full">
                          {unreadNotificationCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {notificationList.length > 0 && (
                        <>
                          <button
                            onClick={handleMarkAllNotificationsRead}
                            className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                          >
                            Mark all as read
                          </button>
                          <button
                            onClick={handleClearNotifications}
                            className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-72 overflow-y-auto custom-scrollbar">
                    {notificationList.length === 0 ? (
                      <div className="py-8 text-center">
                        <svg className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <p className="text-xs text-slate-400 dark:text-slate-500">No new notifications</p>
                      </div>
                    ) : (
                      notificationList.map((act) => {
                        let iconBg = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
                        if (act.type === "request") iconBg = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";
                        if (act.type === "order") iconBg = "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";
                        if (act.type === "user") iconBg = "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400";
                        if (act.type === "payment") iconBg = "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400";
                        if (act.type === "ai") iconBg = "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
                        if (act.type === "report") iconBg = "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400";

                        return (
                          <div
                            key={act.id}
                            onClick={() => {
                              handleNotificationClick(act.id, act.link);
                              if (act.link && act.link !== "#") {
                                setNotificationsOpen(false);
                              }
                            }}
                            className={`py-3 px-2.5 flex items-start gap-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group relative ${!act.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                              }`}
                          >
                            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}>
                              {act.type === "ai" ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              ) : act.type === "report" ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`text-xs ${!act.read ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300"}`}>
                                  {act.title}
                                </p>
                                {act.priority === "HIGH" && (
                                  <span className="px-1.5 py-0.2 text-[8px] font-extrabold uppercase rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                    Urgent
                                  </span>
                                )}
                              </div>
                              {act.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {act.description}
                                </p>
                              )}
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">{act.time}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mt-1">
                              {!act.read && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                              )}
                              <button
                                onClick={(e) => handleDismissNotification(act.id, e)}
                                title="Dismiss"
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity rounded"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button
                      onClick={() => {
                        setActiveMenu("Activity Log");
                        setNotificationsOpen(false);
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View all in Activity Log &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dark Mode Moon/Sun Toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus:outline-none transition-colors"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Globe / Language Selector */}
            <div ref={languageRef} className="relative">
              <button
                onClick={() => {
                  setLanguageOpen(!languageOpen);
                  setNotificationsOpen(false);
                  setProfileDropdownOpen(false);
                }}
                aria-label="Select system language"
                title={`Language: ${currentLang.native}`}
                className={`p-2.5 rounded-xl flex items-center gap-1 focus:outline-none transition-colors ${languageOpen
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                  {currentLang.code}
                </span>
              </button>

              {languageOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-fadeIn">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Select Language</p>
                    <p className="text-[10px] text-slate-400">የስርዓት ቋንቋ ይምረጡ</p>
                  </div>
                  <div className="space-y-1">
                    {languageOptions.map((lang) => {
                      const isSelected = currentLang.code === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setCurrentLang(lang);
                            if (typeof window !== "undefined") {
                              localStorage.setItem("admin_language", lang.code);
                            }
                            setLanguageOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{lang.flag}</span>
                            <div className="text-left">
                              <p className="leading-tight">{lang.native}</p>
                              <span className="text-[10px] text-slate-400 font-normal">{lang.name}</span>
                            </div>
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Header Pill with 1st Initial */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => {
                  setProfileDropdownOpen(!profileDropdownOpen);
                  setNotificationsOpen(false);
                  setLanguageOpen(false);
                }}
                aria-label="User account menu"
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-800 text-white font-bold text-sm flex items-center justify-center ring-2 ring-slate-200/60 dark:ring-slate-700/60 shadow-xs">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "G"}
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileDropdownOpen ? "rotate-180" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 py-2 z-50 animate-fadeIn">
                  {/* User Profile Card */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow">
                      {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "G"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {session?.user?.name || "Admin"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {session?.user?.email || "admin@buildmaster.com"}
                      </p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                        {(session?.user as { role?: string })?.role?.replace("_", " ") || "ADMINISTRATOR"}
                      </span>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveMenu("Settings");
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>System Settings</span>
                    </button>

                    <Link
                      href="/projects"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Project Portfolio</span>
                    </Link>

                    <Link
                      href="/general-manager"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Executive Hub</span>
                    </Link>

                    <Link
                      href="/hr-manager"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>Workforce & HR</span>
                    </Link>

                    <Link
                      href="/procurement-officer"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Procurement & Store</span>
                    </Link>

                    <Link
                      href="/accountant"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Finance & Ledger</span>
                    </Link>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* -------------------- DASHBOARD MAIN CONTENT -------------------- */}
        <main className="p-6 sm:p-8 space-y-7 max-w-[1600px] mx-auto w-full">
          {/* ROW 1: 6 TOP STAT METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
            {/* 1. Total Projects */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Projects
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.totalProjects}</span>
                </div>
              </div>
              <Link href="/projects" className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-blue-600 font-medium hover:underline">
                <span>View all projects</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* 2. Completed Projects */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Completed Projects
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.completedProjects}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-medium">
                <span>{data.metrics.completedPercentage}% of total</span>
                <span>&uarr;</span>
              </div>
            </div>

            {/* 3. In Progress Projects */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    In Progress Projects
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.inProgressProjects}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-amber-600 font-medium">
                <span>{data.metrics.inProgressPercentage}% of total</span>
                <span>&uarr;</span>
              </div>
            </div>

            {/* 4. To Do / Upcoming */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    To Do / Upcoming
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.todoProjects}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-purple-600 font-medium">
                <span>{data.metrics.todoPercentage}% of total</span>
                <span>&uarr;</span>
              </div>
            </div>

            {/* 5. Total Users */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Users
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.totalUsers}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-sky-600 font-medium">
                <span>Registered accounts</span>
                <span>&rarr;</span>
              </div>
            </div>

            {/* 6. Total Expenses */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Expenses
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">
                    {formatCurrency(data.metrics.totalExpenses)}
                  </span>
                </div>
              </div>
              <Link href="/accountant" className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-teal-600 font-medium hover:underline">
                <span>View ledger</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>

          {/* ROW 2: PROJECTS OVERVIEW & AI PREDICTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            {/* Left: Projects Overview Card (~65% width) */}
            <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Projects Overview</h2>
                <Link
                  href="/projects"
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  View All Projects
                </Link>
              </div>

              {/* Card Body: Donut Chart & Table */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 items-center">
                {/* Donut Chart (4 cols) */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-2">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Base circle */}
                      <circle cx="50" cy="50" r="38" stroke="#F1F5F9" strokeWidth="12" fill="none" />

                      {data.metrics.totalProjects > 0 ? (
                        <>
                          {/* Completed Segment - Emerald #10B981 */}
                          {completedDash > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#10B981"
                              strokeWidth="12"
                              strokeDasharray={`${completedDash} ${totalCircumference}`}
                              strokeDashoffset="0"
                              fill="none"
                              strokeLinecap="round"
                            />
                          )}
                          {/* In Progress Segment - Amber #F59E0B */}
                          {inProgressDash > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#F59E0B"
                              strokeWidth="12"
                              strokeDasharray={`${inProgressDash} ${totalCircumference}`}
                              strokeDashoffset={`-${completedDash}`}
                              fill="none"
                              strokeLinecap="round"
                            />
                          )}
                          {/* To Do Segment - Purple #8B5CF6 */}
                          {todoDash > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#8B5CF6"
                              strokeWidth="12"
                              strokeDasharray={`${todoDash} ${totalCircumference}`}
                              strokeDashoffset={`-${completedDash + inProgressDash}`}
                              fill="none"
                              strokeLinecap="round"
                            />
                          )}
                        </>
                      ) : (
                        <circle cx="50" cy="50" r="38" stroke="#E2E8F0" strokeWidth="12" fill="none" />
                      )}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-extrabold text-slate-800 leading-none">
                        {data.metrics.totalProjects}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Total</span>
                    </div>
                  </div>

                  {/* Chart Legend */}
                  <div className="mt-5 space-y-2 text-xs w-full max-w-[200px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>Completed</span>
                      </span>
                      <span className="font-semibold text-slate-700">
                        {data.metrics.completedProjects} ({data.metrics.completedPercentage}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span>In Progress</span>
                      </span>
                      <span className="font-semibold text-slate-700">
                        {data.metrics.inProgressProjects} ({data.metrics.inProgressPercentage}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span>To Do / Upcoming</span>
                      </span>
                      <span className="font-semibold text-slate-700">
                        {data.metrics.todoProjects} ({data.metrics.todoPercentage}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table (8 cols) */}
                <div className="md:col-span-8 overflow-x-auto">
                  {displayedProjects.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        📁
                      </div>
                      <p className="text-xs font-semibold text-slate-700">No project records found</p>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        Start by creating your first construction project to view progress metrics.
                      </p>
                      <Link
                        href="/projects"
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow hover:bg-blue-700 transition"
                      >
                        + Create Project
                      </Link>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-semibold">
                        <tr>
                          <th className="pb-3 pr-4 font-semibold">Project Name</th>
                          <th className="pb-3 px-3 font-semibold">Manager</th>
                          <th className="pb-3 px-3 font-semibold">Status</th>
                          <th className="pb-3 px-3 font-semibold">Progress</th>
                          <th className="pb-3 pl-3 font-semibold">End Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedProjects.slice(0, 5).map((proj) => {
                          let badgeColor = "bg-purple-50 text-purple-600 border border-purple-200/50";
                          if (proj.status === "Completed") {
                            badgeColor = "bg-emerald-50 text-emerald-600 border border-emerald-200/50";
                          } else if (proj.status === "In Progress") {
                            badgeColor = "bg-amber-50 text-amber-600 border border-amber-200/50";
                          }

                          return (
                            <tr key={proj.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 pr-4 font-semibold text-slate-800 whitespace-nowrap">
                                <Link href={`/projects`} className="hover:text-blue-600 transition">
                                  {proj.name}
                                </Link>
                              </td>
                              <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                                {proj.manager}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${badgeColor}`}>
                                  {proj.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-medium w-8 text-slate-700">
                                    {proj.progress}%
                                  </span>
                                  <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-1.5 rounded-full transition-all"
                                      style={{ width: `${proj.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 pl-3 text-slate-500 whitespace-nowrap">
                                {proj.endDate}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Right: AI Predictions Card (~35% width) */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">AI Predictions</h2>
                <Link
                  href="/ai-analytics"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* Sub-cards */}
              <div className="space-y-4 my-auto py-3">
                {/* Cost Prediction Box */}
                <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-100 flex flex-col space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Cost Prediction</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-slate-900">
                            {formatCurrency(data.aiPredictions.predictedFinalCost)}
                          </span>
                          <span className="text-xs font-bold text-rose-500">
                            ({data.aiPredictions.costVariancePercentage})
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600">
                      {data.aiPredictions.riskBreakdown.high > 0 ? "High" : "Normal"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 border-t border-purple-100/60 pt-2 space-y-0.5">
                    <p className="font-medium text-slate-700">Predicted final cost for all active projects</p>
                    <p className="text-slate-400">Based on live expenditure and scope progress</p>
                  </div>
                </div>

                {/* Delay Prediction Box */}
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100 flex flex-col space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Delay Prediction</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-slate-900">
                            {data.aiPredictions.projectsAtRisk}
                          </span>
                          <span className="text-xs font-bold text-slate-700">Projects</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      {data.aiPredictions.projectsAtRisk > 0 ? "Watchlist" : "Optimal"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 border-t border-amber-100/60 pt-2 space-y-0.5">
                    <p className="font-medium text-slate-700">
                      {data.aiPredictions.projectsAtRisk > 0 ? "Projects requiring timeline review" : "No active delays flagged"}
                    </p>
                    <p className="text-slate-400">Continuous milestone delay assessment</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: SECONDARY STAT MINI-CARDS (4 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Total Suppliers */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Suppliers
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.totalSuppliers}</span>
                </div>
              </div>
              <Link href="/procurement-officer" className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-sky-600 font-medium hover:underline">
                <span>View all suppliers</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* 2. Total Materials */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Materials
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.totalMaterials}</span>
                </div>
              </div>
              <Link href="/procurement-officer" className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-medium hover:underline">
                <span>View materials</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* 3. Material Requests */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Material Requests
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.materialRequestsCount}</span>
                </div>
              </div>
              <Link href="/procurement-officer" className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-amber-600 font-medium hover:underline">
                <span>View all requests</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* 4. Total Workforce */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Workforce
                  </span>
                  <span className="text-2xl font-extrabold text-slate-800">{data.metrics.totalWorkforce}</span>
                </div>
              </div>
              <Link href="/hr-manager" className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-rose-600 font-medium hover:underline">
                <span>View all workers</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>

          {/* ROW 4: BOTTOM ANALYTICAL WIDGETS & RECENT ACTIVITIES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            {/* 1. AI Cost Prediction Chart (3 cols) */}
            <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800">AI Cost Prediction</h3>
                <select
                  value={costFilter}
                  onChange={(e) => setCostFilter(e.target.value)}
                  className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option>This Year</option>
                  <option>Quarterly</option>
                  <option>All Time</option>
                </select>
              </div>

              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-slate-900">
                    {formatCurrency(data.aiPredictions.predictedFinalCost)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Predicted Final Cost</span>
                </div>
                <div className="text-[11px] text-rose-500 font-bold flex items-center gap-1 mt-0.5">
                  <span>&uarr; {data.aiPredictions.costVariancePercentage}</span>
                  <span className="text-slate-400 font-normal">Compared to initial budget</span>
                </div>
              </div>

              {/* Dynamic Multi-Line Chart (SVG) */}
              <div className="w-full h-36 relative mt-2">
                <svg className="w-full h-full" viewBox="0 0 300 130">
                  <line x1="25" y1="20" x2="290" y2="20" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="25" y1="45" x2="290" y2="45" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="25" y1="70" x2="290" y2="70" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="25" y1="95" x2="290" y2="95" stroke="#F1F5F9" strokeWidth="1" />

                  <text x="2" y="23" className="text-[7px] fill-slate-300">Max</text>
                  <text x="2" y="98" className="text-[7px] fill-slate-300">$0</text>

                  {/* Predicted Cost Line */}
                  <polyline
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="30,95 52,90 75,80 97,72 120,68 142,55 165,50 187,42 210,38 232,32 255,28 277,25"
                  />
                  <circle cx="30" cy="95" r="2.5" fill="#3B82F6" />
                  <circle cx="165" cy="50" r="2.5" fill="#3B82F6" />
                  <circle cx="277" cy="25" r="2.5" fill="#3B82F6" />

                  {/* Actual Cost Line */}
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="30,105 52,100 75,92 97,88 120,85 142,75 165,72 187,68 210,65 232,60 255,55 277,50"
                  />
                  <circle cx="30" cy="105" r="2.5" fill="#10B981" />
                  <circle cx="165" cy="72" r="2.5" fill="#10B981" />
                  <circle cx="277" cy="50" r="2.5" fill="#10B981" />

                  <text x="25" y="118" className="text-[7px] fill-slate-400">Jan</text>
                  <text x="70" y="118" className="text-[7px] fill-slate-400">Mar</text>
                  <text x="115" y="118" className="text-[7px] fill-slate-400">May</text>
                  <text x="160" y="118" className="text-[7px] fill-slate-400">Jul</text>
                  <text x="205" y="118" className="text-[7px] fill-slate-400">Sep</text>
                  <text x="250" y="118" className="text-[7px] fill-slate-400">Nov</text>
                </svg>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 pt-2 border-t border-slate-50">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Predicted Cost</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Actual Cost</span>
                </span>
              </div>
            </div>

            {/* 2. AI Delay Prediction (3 cols) */}
            <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800">AI Delay Prediction</h3>
                <select
                  value={delayFilter}
                  onChange={(e) => setDelayFilter(e.target.value)}
                  className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option>This Year</option>
                  <option>Next Quarter</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 my-auto items-center">
                {/* Left Stats & Legend */}
                <div>
                  <span className="text-3xl font-black text-slate-900 block leading-none">
                    {data.aiPredictions.projectsAtRisk}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium block mt-1">
                    Projects at Risk of Delay
                  </span>

                  <div className="mt-4 space-y-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                      <span className="text-slate-600">High Risk ({data.aiPredictions.riskBreakdown.high})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="text-slate-600">Medium Risk ({data.aiPredictions.riskBreakdown.medium})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-slate-600">Low Risk ({data.aiPredictions.riskBreakdown.low})</span>
                    </div>
                  </div>
                </div>

                {/* Right Donut */}
                <div className="flex items-center justify-center">
                  <div className="w-28 h-28 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="35" stroke="#F1F5F9" strokeWidth="13" fill="none" />
                      {data.metrics.totalProjects > 0 ? (
                        <>
                          <circle cx="50" cy="50" r="35" stroke="#10B981" strokeWidth="13" strokeDasharray="160 220" fill="none" strokeLinecap="round" />
                          <circle cx="50" cy="50" r="35" stroke="#F59E0B" strokeWidth="13" strokeDasharray="30 220" strokeDashoffset="-165" fill="none" strokeLinecap="round" />
                          <circle cx="50" cy="50" r="35" stroke="#EF4444" strokeWidth="13" strokeDasharray="20 220" strokeDashoffset="-200" fill="none" strokeLinecap="round" />
                        </>
                      ) : (
                        <circle cx="50" cy="50" r="35" stroke="#E2E8F0" strokeWidth="13" fill="none" />
                      )}
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Budget Overview (3 cols) */}
            <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800">Budget Overview</h3>
                <select
                  value={budgetFilter}
                  onChange={(e) => setBudgetFilter(e.target.value)}
                  className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option>This Year</option>
                  <option>All Time</option>
                </select>
              </div>

              <div className="my-2">
                <span className="text-2xl font-black text-slate-900 block">
                  {formatCurrency(data.metrics.totalBudget)}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Total Project Budget</span>
              </div>

              {/* Progress Bars */}
              <div className="space-y-4 my-auto">
                {/* Total Spent */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      {formatCurrency(data.metrics.totalExpenses)}{" "}
                      <span className="font-normal text-slate-400">Total Spent</span>
                    </span>
                    <span className="text-slate-600">{data.metrics.spentPercentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, data.metrics.spentPercentage)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Remaining Budget */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      {formatCurrency(data.metrics.remainingBudget)}{" "}
                      <span className="font-normal text-slate-400">Remaining</span>
                    </span>
                    <span className="text-slate-600">{data.metrics.remainingPercentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, data.metrics.remainingPercentage)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Recent Activities (3 cols) */}
            <div className="lg:col-span-12 xl:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800">Recent Activities</h3>
                <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                  View All
                </span>
              </div>

              <div className="space-y-3.5 my-auto py-2">
                {data.activities.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No recent actions logged</p>
                ) : (
                  data.activities.map((act) => {
                    let iconBg = "bg-blue-50 text-blue-600";
                    if (act.type === "request") iconBg = "bg-emerald-50 text-emerald-600";
                    if (act.type === "order") iconBg = "bg-amber-50 text-amber-600";
                    if (act.type === "user") iconBg = "bg-sky-50 text-sky-600";
                    if (act.type === "payment") iconBg = "bg-rose-50 text-rose-600";

                    return (
                      <div key={act.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-slate-700 font-medium truncate">{act.title}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{act.time}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>


      </div>
    </div>
  );
}
