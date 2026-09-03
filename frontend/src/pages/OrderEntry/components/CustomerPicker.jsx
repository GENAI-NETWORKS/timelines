import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserPlus, X, CheckCircle2, ChevronDown } from 'lucide-react';
import { searchCustomers } from '../../../api/customers';

export default function CustomerPicker({ value, onChange, disabled }) {
  // value = { customerId, name, phone, email, address, isNew }
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Debounced search
  const doSearch = useCallback((q) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) { setResults([]); setShowDropdown(false); return; }
      setSearching(true);
      try {
        const res = await searchCustomers(q);
        setResults(res.data || []);
        setShowDropdown(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 280);
  }, []);

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCustomer = (c) => {
    onChange({ customerId: c.customerId, name: c.name, phone: c.phone, email: c.email, address: c.address, isNew: false });
    setQuery('');
    setShowDropdown(false);
    setShowNewForm(false);
  };

  const clearSelection = () => {
    onChange({ customerId: '', name: '', phone: '', email: '', address: '', isNew: false });
    setQuery('');
    setShowNewForm(false);
  };

  const handleNewFormChange = (field, val) => {
    onChange({ ...value, [field]: val, isNew: true, customerId: '' });
  };

  const startNewCustomer = () => {
    clearSelection();
    setShowNewForm(true);
    setShowDropdown(false);
  };

  const isSelected = Boolean(value?.customerId && !value?.isNew);

  return (
    <div className="space-y-3">
      {/* Selected customer chip */}
      {isSelected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-900/30 border border-brand-700/50 rounded-xl animate-fade-in">
          <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {value.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{value.name}</p>
            <p className="text-xs text-gray-400 truncate">{value.customerId} · {value.phone}</p>
            {value.address && <p className="text-xs text-gray-500 truncate">{value.address}</p>}
          </div>
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          {!disabled && (
            <button onClick={clearSelection} className="btn-icon text-gray-500 hover:text-rose-400 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Search + new form visible when no customer selected */}
      {!isSelected && (
        <>
          {!showNewForm ? (
            <div ref={wrapperRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                )}
                <input
                  id="customer-search-input"
                  className="input pl-9"
                  placeholder="Search by name, phone, or Customer ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => { if (results.length) setShowDropdown(true); }}
                  disabled={disabled}
                  autoComplete="off"
                />
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                  {results.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">No customers found for "{query}"</div>
                  ) : (
                    results.map((c) => (
                      <button
                        key={c.customerId}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-elevated transition-colors flex items-center gap-3 border-b border-surface-border/50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {c.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.customerId} · {c.phone}</p>
                        </div>
                      </button>
                    ))
                  )}
                  <button
                    onClick={startNewCustomer}
                    className="w-full text-left px-4 py-3 text-brand-400 hover:bg-brand-900/20 transition-colors flex items-center gap-2 text-sm font-medium border-t border-surface-border"
                  >
                    <UserPlus className="w-4 h-4" /> + Create new customer
                  </button>
                </div>
              )}

              {/* New customer button when no search */}
              {!showDropdown && (
                <button
                  onClick={startNewCustomer}
                  className="mt-2 flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                  disabled={disabled}
                >
                  <UserPlus className="w-4 h-4" /> + New customer (not in database)
                </button>
              )}
            </div>
          ) : (
            /* Inline New Customer Form */
            <div className="card p-4 border-brand-700/40 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-brand-400" />
                  <span className="text-sm font-semibold text-white">New Customer</span>
                  <span className="badge badge-pending text-xs">Will be created on save</span>
                </div>
                <button onClick={clearSelection} className="btn-icon text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input id="new-cust-name" className="input" placeholder="Full name" value={value.name || ''} onChange={e => handleNewFormChange('name', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input id="new-cust-phone" className="input" placeholder="Phone number" value={value.phone || ''} onChange={e => handleNewFormChange('phone', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input id="new-cust-email" className="input" type="email" placeholder="Email (optional)" value={value.email || ''} onChange={e => handleNewFormChange('email', e.target.value)} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input id="new-cust-address" className="input" placeholder="Address (optional)" value={value.address || ''} onChange={e => handleNewFormChange('address', e.target.value)} />
                </div>
              </div>
              <button
                onClick={() => { setShowNewForm(false); setQuery(''); }}
                className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
              >
                <ChevronDown className="w-3 h-3 rotate-90" /> Switch to search existing
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
