import { useState, useEffect, useCallback } from 'react';
import { Search, Loader, MapPin, Phone, Mail, Calendar, User, FileText, ExternalLink, Scissors } from 'lucide-react';
import { getCustomers, getCustomerAudit } from '../../api/customers';
import { useAuth } from '../../context/AuthContext';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Modal from '../../components/UI/Modal';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Customers() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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
          <h1 className="font-display font-bold text-2xl text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{total} total records · Click any row to view full details</p>
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
                <th className="w-36">Customer ID</th>
                <th>Name</th>
                <th>Address</th>
                <th className="w-36 text-right">Registered</th>
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
                <tr
                  key={c.customerId}
                  onClick={() => setSelectedCustomer(c)}
                  className="cursor-pointer hover:bg-brand-50/50 transition-colors group"
                >
                  <td>
                    <span className="font-mono text-xs text-brand-400 group-hover:underline">
                      {c.customerId}
                    </span>
                  </td>
                  <td className="font-medium text-gray-900">
                    <span className="flex items-center gap-2">
                      {c.name}
                    </span>
                  </td>
                  <td className="text-gray-600 max-w-xs truncate">
                    {c.address ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-700">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No address provided</span>
                    )}
                  </td>
                  <td className="text-gray-500 text-xs text-right">
                    {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-4">
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </div>
      </div>

      {/* Full Customer Details Modal */}
      {selectedCustomer && (
        <Modal
          title="Customer Details"
          onClose={() => setSelectedCustomer(null)}
          size="max-w-xl"
        >
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-start justify-between pb-4 border-b border-surface-border">
              <div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 font-semibold border border-brand-200">
                  {selectedCustomer.customerId}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-2">{selectedCustomer.name}</h2>
              </div>
              {selectedCustomer.createdAt && (
                <div className="text-right text-xs text-gray-500">
                  <div>Registered On</div>
                  <div className="font-medium text-gray-700 mt-0.5">
                    {format(new Date(selectedCustomer.createdAt), 'dd MMMM yyyy')}
                  </div>
                </div>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Phone Number</div>
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    className="text-sm font-semibold text-emerald-700 hover:underline block mt-0.5"
                  >
                    {selectedCustomer.phone || 'Not available'}
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Email Address</div>
                  <div className="text-sm font-semibold text-gray-800 truncate mt-0.5">
                    {selectedCustomer.email ? (
                      <a href={`mailto:${selectedCustomer.email}`} className="text-blue-600 hover:underline">
                        {selectedCustomer.email}
                      </a>
                    ) : (
                      <span className="text-gray-400 font-normal">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="sm:col-span-2 p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Full Address</div>
                  <div className="text-sm text-gray-800 whitespace-pre-line mt-0.5">
                    {selectedCustomer.address || <span className="text-gray-400 italic font-normal">No address recorded</span>}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedCustomer.notes && (
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Notes</div>
                    <div className="text-sm text-gray-800 whitespace-pre-line mt-0.5">
                      {selectedCustomer.notes}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-border">
              <button
                type="button"
                onClick={() => {
                  const id = selectedCustomer.customerId;
                  const name = selectedCustomer.name;
                  setSelectedCustomer(null);
                  openHistory(id, name);
                }}
                className="btn-ghost text-xs text-gray-600"
              >
                View Audit History
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/tailoring-orders?search=${encodeURIComponent(selectedCustomer.name)}`);
                  }}
                  className="btn btn-secondary text-xs"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  View Orders
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="btn btn-primary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* History Drawer */}
      {historyFor && (
        <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}
