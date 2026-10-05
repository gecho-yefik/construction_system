import Link from "next/link";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer id="contact" className="bg-white border-t border-slate-100 pt-16 pb-8 text-slate-600">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-100">
                    <div className="lg:col-span-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 21h18" />
                                    <path d="M5 21V7l8-4v18" />
                                    <path d="M19 21V11l-6-4" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-black tracking-tight text-slate-900 leading-none">BuildMaster</span>
                                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-500 mt-0.5">CONSTRUCTION SOLUTIONS</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                            We deliver innovative construction solutions with a commitment to quality,
                            safety, and timely delivery.
                        </p>

                        <div className="flex items-center gap-2 pt-2">
                            <a href="#" className="w-7 h-7 rounded-full bg-slate-100 hover:bg-amber-500 hover:text-white transition flex items-center justify-center text-xs font-bold text-slate-600">f</a>
                            <a href="#" className="w-7 h-7 rounded-full bg-slate-100 hover:bg-amber-500 hover:text-white transition flex items-center justify-center text-xs font-bold text-slate-600">in</a>
                            <a href="#" className="w-7 h-7 rounded-full bg-slate-100 hover:bg-amber-500 hover:text-white transition flex items-center justify-center text-xs font-bold text-slate-600">t</a>
                            <a href="#" className="w-7 h-7 rounded-full bg-slate-100 hover:bg-amber-500 hover:text-white transition flex items-center justify-center text-xs font-bold text-slate-600">tg</a>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Quick Links</h4>
                        <ul className="space-y-2 text-xs">
                            <li><Link href="/#home" className="hover:text-amber-500 transition-colors">Home</Link></li>
                            <li><Link href="/#about" className="hover:text-amber-500 transition-colors">About Us</Link></li>
                            <li><Link href="/#services" className="hover:text-amber-500 transition-colors">Services</Link></li>
                            <li><Link href="/#projects" className="hover:text-amber-500 transition-colors">Projects</Link></li>
                            <li><Link href="/#contact" className="hover:text-amber-500 transition-colors">Contact Us</Link></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-3 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Our Services</h4>
                        <ul className="space-y-2 text-xs">
                            <li><Link href="/project-manager" className="hover:text-amber-500 transition-colors">Project Management</Link></li>
                            <li><Link href="/hr-manager" className="hover:text-amber-500 transition-colors">Workforce Management</Link></li>
                            <li><Link href="/procurement-officer" className="hover:text-amber-500 transition-colors">Material Management</Link></li>
                            <li><Link href="/procurement-officer" className="hover:text-amber-500 transition-colors">Procurement Management</Link></li>
                            <li><Link href="/accountant" className="hover:text-amber-500 transition-colors">Financial Management</Link></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-3 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Contact Us</h4>
                        <div className="space-y-2 text-xs text-slate-500">
                            <p className="flex items-center gap-2"><span>📞</span> <span>+251 40501045</span></p>
                            <p className="flex items-center gap-2"><span>✉️</span> <span>buildmaster@gmail.com</span></p>
                            <p className="flex items-start gap-2"><span>📍</span> <span>Addis Ababa, Ethiopia</span></p>
                            <p className="flex items-center gap-2"><span>🕒</span> <span>24/7 Support</span></p>
                        </div>

                        <div className="mt-3 w-full h-20 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100">
                            <img
                                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=400&q=80"
                                alt="Office Location Map"
                                className="w-full h-full object-cover opacity-70"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg animate-bounce">📍</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
                    <p>&copy; {currentYear} BuildMaster Construction Solutions. All Rights Reserved.</p>
                    <p className="mt-2 sm:mt-0 font-medium text-slate-500">Version 1.0.0</p>
                </div>
            </div>
        </footer>
    );
}
