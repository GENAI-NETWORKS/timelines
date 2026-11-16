import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  // Persist sidebar state across page navigation, defaults to open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('timelines_sidebar_open');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 1024;
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('timelines_sidebar_open', String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-8 text-center text-xs text-gray-500 py-4 border-t border-surface-border w-full">
            powered by <a href="https://genaitechnology.in/" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 transition-colors">Gen-AI Tech | IT Solutions Salem</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
