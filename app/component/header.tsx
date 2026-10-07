"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Do not render top header on the dedicated full-screen Admin Dashboard (/admin)
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const user = session?.user;
  const userRole = (user as { role?: string })?.role || "GUEST";
  const isGeneralManager = userRole === "GENERAL_MANAGER";

  // Map each role to their dedicated dashboard
  const getRoleDashboard = (role: string) => {
    switch (role) {
      case "GENERAL_MANAGER":
        return { name: "👑 Admin Dashboard", href: "/admin", color: "from-amber-400 to-yellow-500" };
      case "PROJECT_MANAGER":
        return { name: "👷 PM Dashboard", href: "/project-manager", color: "from-blue-400 to-cyan-500" };
      case "HR_MANAGER":
        return { name: "👥 HR & Workforce", href: "/hr-manager", color: "from-orange-400 to-amber-500" };
      case "SITE_ENGINEER":
        return { name: "📐 Field Site Ops", href: "/site-engineer", color: "from-cyan-400 to-blue-500" };
      case "PROCUREMENT_OFFICER":
        return { name: "📦 Store & Procurement", href: "/procurement-officer", color: "from-emerald-400 to-teal-500" };
      case "ACCOUNTANT":
        return { name: "💰 Finance & Ledger", href: "/accountant", color: "from-green-400 to-emerald-500" };
      default:
        return { name: "📊 My Workspace", href: "/projects", color: "from-amber-400 to-amber-500" };
    }
  };

  const currentDashboard = getRoleDashboard(userRole);

  // Public Navigation Links
  const publicNavLinks = [
    { name: "Home", href: "/#home" },
    { name: "About Us", href: "/#about" },
    { name: "Services", href: "/#services" },
    { name: "Projects", href: "/#projects" },
    { name: "Contact Us", href: "/#contact" },
  ];

  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo - BuildMaster */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none rounded-lg p-1"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center p-[1px] shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#0B132B] rounded-[11px] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-amber-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 21h18" />
                  <path d="M5 21V7l8-4v18" />
                  <path d="M19 21V11l-6-4" />
                </svg>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-white leading-tight">
                BuildMaster
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                CONSTRUCTION SOLUTIONS
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7">
            {!user ? (
              publicNavLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors"
                >
                  {link.name}
                </Link>
              ))
            ) : (
              <>
                <Link href="/" className="text-xs font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                  Home
                </Link>
                <Link href="/projects" className="text-xs font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                  Projects
                </Link>

                {/* Role's Authorized Dashboard Button */}
                <Link
                  href={currentDashboard.href}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs hover:bg-amber-500/25 transition-all shadow-sm"
                >
                  <span>{currentDashboard.name}</span>
                  <span>&rarr;</span>
                </Link>
              </>
            )}
          </nav>

          {/* Right Area: Login / User Profile */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-slate-950 shadow">
                    {getUserInitials()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-white max-w-[120px] truncate">
                      {user.name || "User"}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400 uppercase">
                      {userRole.replace("_", " ")}
                    </span>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50 space-y-2 animate-fadeIn">
                    <div className="p-2 border-b border-slate-800">
                      <p className="text-xs font-bold text-white truncate">{user.name || "User"}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 uppercase">
                        {userRole.replace("_", " ")}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Link
                        href={currentDashboard.href}
                        onClick={() => setProfileOpen(false)}
                        className="block px-3 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 transition"
                      >
                        {currentDashboard.name}
                      </Link>

                      {isGeneralManager && (
                        <Link
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                        >
                          ⚡ BuildMaster Admin Hub
                        </Link>
                      )}

                      <Link
                        href="/projects"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                      >
                        📁 Projects Directory
                      </Link>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="w-full text-center px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white transition"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth"
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20 transition-transform active:scale-95"
                >
                  Login
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <div className="flex md:hidden items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {mobileMenuOpen ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <path d="M4 12h16M4 6h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-t border-slate-800 px-4 py-4 space-y-3">
          <div className="space-y-1">
            {!user ? (
              publicNavLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-slate-300 hover:text-amber-400 hover:bg-slate-900 rounded-lg"
                >
                  {link.name}
                </Link>
              ))
            ) : (
              <>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-slate-300 hover:text-amber-400 hover:bg-slate-900 rounded-lg"
                >
                  Home
                </Link>
                <Link
                  href="/projects"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-slate-300 hover:text-amber-400 hover:bg-slate-900 rounded-lg"
                >
                  📁 Projects Directory
                </Link>
                <Link
                  href={currentDashboard.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-semibold text-amber-400 bg-amber-500/10 rounded-lg"
                >
                  {currentDashboard.name}
                </Link>
              </>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800">
            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="w-full text-center px-4 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 shadow"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}