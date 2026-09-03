import { useState, useEffect, useCallback } from 'react';
import { Search, History, Phone, Loader } from 'lucide-react';
import { getCustomers, getCustomerAudit } from '../../api/customers';
import { useAuth } from '../../context/AuthContext';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';


export default function Customers() {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomers({ search, page, limit: LIMIT });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load customers.'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);


  const openHistory = async (id, name) => {
    setHistoryFor(name);
    setHistoryLogs([]);
    setHistoryLoading(true);
    try {
      const res = await getCustomerAudit(id);
      setHistoryLogs(res.data);
    } catch { toast.error('Failed to load history.'); }
    finally { setHistoryLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Customers</h1>
          <p className="text-sm text-gray-500">{total} total records</p>
        </div>
      </div>
      {/* Search */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search by name, phone or Customer ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="text-center py-10">
                  <Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" />
                </td></tr>
              )}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-500">No customers found.</td></tr>
              )}
              {customers.map((c) => (
                <tr key={c.customerId}>
                  <td><span className="font-mono text-xs text-brand-400">{c.customerId}</span></td>
                  <td className="font-medium text-white">{c.name}</td>
                  <td>
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-gray-300 hover:text-brand-400 transition-colors">
                      <Phone className="w-3 h-3" />{c.phone}
                    </a>
                  </td>
                  <td className="text-gray-500 text-xs">{format(new Date(c.createdAt), 'dd MMM yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-4">
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </div>
      </div>


      {/* History Drawer */}
      {historyFor && (
        <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}
