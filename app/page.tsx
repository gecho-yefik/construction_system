"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const { data: session } = useSession();
  const user = session?.user;
  const userRole = (user as { role?: string })?.role || "";

  const [liveProjects, setLiveProjects] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({
    completedProjects: 0,
    activeProjects: 0,
    totalWorkers: 0,
    totalSuppliers: 0,
  });

  React.useEffect(() => {
    async function loadPublicData() {
      try {
        const [projRes, overviewRes] = await Promise.all([
          fetch("/api/projects").catch(() => null),
          fetch("/api/admin/overview").catch(() => null),
        ]);

        if (projRes && projRes.ok) {
          const pList = await projRes.json();
          if (Array.isArray(pList) && pList.length > 0) {
            setLiveProjects(pList.slice(0, 3));
          }
        }

        if (overviewRes && overviewRes.ok) {
          const ov = await overviewRes.json();
          if (ov?.metrics) {
            setStats({
              completedProjects: ov.metrics.completedProjects || 0,
              activeProjects: ov.metrics.inProgressProjects || 0,
              totalWorkers: ov.metrics.totalWorkforce || 0,
              totalSuppliers: ov.metrics.totalSuppliers || 0,
            });
          }
        }
      } catch (e) {
        // Fallback gracefully
      }
    }
    loadPublicData();
  }, []);

  const getDashboardHref = () => {
    switch (userRole) {
      case "GENERAL_MANAGER":
        return "/admin";
      case "PROJECT_MANAGER":
        return "/project-manager";
      case "HR_MANAGER":
        return "/hr-manager";
      case "SITE_ENGINEER":
        return "/site-engineer";
      case "PROCUREMENT_OFFICER":
        return "/procurement-officer";
      case "ACCOUNTANT":
        return "/accountant";
      default:
        return "/admin";
    }
  };

  const services = [
    {
      title: "Project Management",
      desc: "Plan, execute, and monitor projects efficiently from start to finish.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      link: user ? "/project-manager" : "/auth",
    },
    {
      title: "Workforce Management",
      desc: "Manage skilled workforce, attendance, assignments, and productivity.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      link: user ? "/hr-manager" : "/auth",
    },
    {
      title: "Material Management",
      desc: "Track materials, requests, usage, and ensure smooth supply chain.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      link: user ? "/procurement-officer" : "/auth",
    },
    {
      title: "Inventory Management",
      desc: "Maintain inventory levels, stock tracking, and real-time availability.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      link: user ? "/procurement-officer" : "/auth",
    },
    {
      title: "Supplier Management",
      desc: "Manage suppliers, evaluate performance, and maintain strong relationships.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      link: user ? "/procurement-officer" : "/auth",
    },
    {
      title: "Procurement Management",
      desc: "Handle purchase orders, approvals, deliveries, and supplier coordination.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      link: user ? "/procurement-officer" : "/auth",
    },
    {
      title: "Financial Management",
      desc: "Budget planning, expense tracking, and financial reporting.",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      link: user ? "/accountant" : "/auth",
    },
  ];

  const defaultSampleProjects = [
    {
      title: "Green Valley Apartments",
      type: "Residential Building",
      location: "Lahore, Pakistan",
      status: "Completed",
      badgeColor: "bg-emerald-500 text-white",
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Skyline Business Tower",
      type: "Commercial Building",
      location: "Islamabad, Pakistan",
      status: "In Progress",
      badgeColor: "bg-amber-500 text-white",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "City Link Highway Project",
      type: "Infrastructure Development",
      location: "Karachi, Pakistan",
      status: "Completed",
      badgeColor: "bg-emerald-500 text-white",
      image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const displayProjects =
    liveProjects.length > 0
      ? liveProjects.map((p, idx) => ({
        title: p.name,
        type: p.description || "Construction Project",
        location: p.location || "Site Location",
        status: p.status === "COMPLETED" ? "Completed" : p.status === "IN_PROGRESS" ? "In Progress" : "Planned",
        badgeColor: p.status === "COMPLETED" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white",
        image: defaultSampleProjects[idx % defaultSampleProjects.length].image,
      }))
      : defaultSampleProjects;

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      {/* -------------------- 1. HERO SECTION -------------------- */}
      <section id="home" className="relative min-h-[580px] lg:min-h-[640px] flex items-center bg-[#0d1627] overflow-hidden">
        {/* Background Image with Dark Vignette Gradient */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45 mix-blend-luminosity scale-105 transform transition-transform duration-1000"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1920&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070D1E] via-[#0B132B]/90 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070D1E]/80 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full z-10">
          <div className="max-w-2xl space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
              Construction <br />
              Project Management <br />
              <span className="text-amber-400">System</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed max-w-xl">
              Efficiently managing construction projects, workforce, materials,
              procurement, and financial operations through a centralized platform.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href={user ? getDashboardHref() : "/auth"}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:scale-95"
              >
                <span>{user ? "Open My Dashboard" : "Get Started"}</span>
                <span>&rarr;</span>
              </Link>

              <Link
                href="#about"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-xs tracking-wider text-white bg-slate-900/80 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 shadow transition-all"
              >
                <span>Learn More</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 2. ABOUT COMPANY SECTION -------------------- */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-500 block mb-2">
                  ABOUT COMPANY
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  Building Structures, <br />
                  Building <span className="text-amber-500">Relationships</span>
                </h2>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                We are a leading construction management company dedicated to delivering
                high-quality construction projects on time and within budget. Our goal is to provide
                reliable, innovative, and sustainable solutions that build a better tomorrow.
              </p>

              <div className="space-y-4 pt-2">
                {/* Our Vision */}
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Our Vision</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      To be a trusted leader in the construction industry through innovation and excellence.
                    </p>
                  </div>
                </div>

                {/* Our Mission */}
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Our Mission</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      To deliver exceptional construction services with integrity, quality, and customer satisfaction.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Image (6 cols) */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-100 group">
                <img
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80"
                  alt="Construction engineers on site"
                  className="w-full h-80 sm:h-96 object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 3. OUR SERVICES SECTION -------------------- */}
      <section id="services" className="py-20 bg-slate-50/60 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto space-y-2 mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-500">
              OUR SERVICES
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Comprehensive Construction <br className="hidden sm:inline" />
              Management <span className="text-amber-500">Services</span>
            </h2>
          </div>

          {/* 7 Services Grid Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 sm:gap-3">
            {services.map((srv, idx) => (
              <Link
                key={idx}
                href={srv.link}
                className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 hover:shadow-lg hover:border-amber-400/40 transition-all flex flex-col items-center text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#0B132B] group-hover:bg-amber-500 transition-colors flex items-center justify-center shadow-md mb-4 shrink-0">
                  {srv.icon}
                </div>
                <h3 className="text-xs font-bold text-slate-900 leading-snug mb-2 group-hover:text-amber-600 transition-colors">
                  {srv.title}
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {srv.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------- 4. OUR RECENT PROJECTS -------------------- */}
      <section id="projects" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-500">
              OUR PROJECTS
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Our <span className="text-amber-500">Recent Projects</span>
            </h2>
          </div>

          {/* Dynamic Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 text-left">
            {displayProjects.map((p, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all group flex flex-col"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <span
                    className={`absolute top-3.5 left-3.5 px-3 py-1 rounded-full text-[10px] font-bold shadow ${p.badgeColor}`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-xs text-slate-500">{p.type}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{p.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-[#0B132B] hover:bg-slate-800 shadow-md transition-all transform hover:-translate-y-0.5"
            >
              <span>View All Projects</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------- 5. STAT COUNTER BANNER (NAVY BLUE) -------------------- */}
      <section className="bg-[#0B132B] py-12 text-white border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mb-1 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">{stats.completedProjects}</span>
              <span className="text-xs text-slate-400 font-medium">Projects Completed</span>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mb-1 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">{stats.totalWorkers}</span>
              <span className="text-xs text-slate-400 font-medium">Skilled Workers</span>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mb-1 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">{stats.activeProjects}</span>
              <span className="text-xs text-slate-400 font-medium">Active Projects</span>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mb-1 shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">{stats.totalSuppliers}</span>
              <span className="text-xs text-slate-400 font-medium">Partner Suppliers</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
