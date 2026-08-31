import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
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
