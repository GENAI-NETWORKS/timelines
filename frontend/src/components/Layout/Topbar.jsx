import { Menu, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles = {
  '/':         'Dashboard',
  '/customers':'Customer Management',
  '/employees':'Employee Management',
  '/orders':   'Design Orders',
  '/canvas':   'Design Canvas',
  '/salary':   'Salary Management',
  '/print':    'Print Module',
  '/audit':    'Audit Log',
  '/garments': 'Garment Templates',
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const path = '/' + location.pathname.split('/')[1];
  const title = pageTitles[path] || 'Admin Panel';

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border flex items-center px-4 gap-4 sticky top-0 z-20">
      <button onClick={onMenuClick} className="btn-icon lg:hidden">
        <Menu className="w-5 h-5" />
      </button>
      <div>
        <h2 className="font-display font-semibold text-white text-lg leading-tight">{title}</h2>
        <p className="text-xs text-gray-500 hidden sm:block">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Connected" />
        <span className="text-xs text-gray-500 hidden sm:inline">Live</span>
      </div>
    </header>
  );
}
