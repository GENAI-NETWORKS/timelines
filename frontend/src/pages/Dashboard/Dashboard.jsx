import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, UserSquare2, ShoppingBag, Clock, TrendingUp, CheckCircle,
  AlertTriangle, Loader, Package, Plus, Receipt, IndianRupee,
  Scissors, ArrowRight, Eye, FileText, Sparkles, ChevronRight,
  AlertCircle
} from 'lucide-react';
import { getCustomers } from '../../api/customers';
import { getEmployees } from '../../api/employees';
import { getTailoringOrders } from '../../api/tailoringOrders';
import { getMaterials } from '../../api/materials';
import { getBillingRecords } from '../../api/billingRecords';
import { getTailorStaff } from '../../api/tailorStaff';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const normalizeStatus = (s) => {
  if (!s) return 'Not yet started';
  const l = s.trim().toLowerCase();
  if (l === 'delivered') return 'Delivered';
  if (l === 'stitching completed' || l.includes('stitching')) return 'Stitching Completed';
  if (l === 'not yet checked' || (l.includes('checked') && !l.includes('uncheck'))) return 'Not yet Checked';
  if (l === 'on progress' || l.includes('progress') || l === 'submitted' || l === 'ready' || l === 'in progress') return 'On Progress';
  if (l === 'not yet started' || l.includes('not yet') || l === 'draft' || l === 'pending') return 'Not yet started';
  return s;
};

const STATUS_CONFIG = {
  'Not yet started': {
    label: 'Not yet started',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot:   'bg-amber-400',
  },
  'On Progress': {
    label: 'On Progress',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot:   'bg-blue-500 animate-pulse',
  },
  'Stitching Completed': {
    label: 'Stitching Completed',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot:   'bg-purple-500',
  },
  'Not yet Checked': {
    label: 'Not yet Checked',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot:   'bg-rose-400',
  },
  'Delivered': {
    label: 'Delivered',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot:   'bg-emerald-500',
  },
};

function StatCard({ icon: Icon, label, value, sub, color, to, badge }) {
  const content = (
    <div className="card p-4 hover:shadow-md transition-all group border border-gray-100/80 hover:border-purple-200 flex items-center justify-between">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider truncate">{label}</p>
          <p className="font-display font-black text-xl text-gray-900 mt-0.5 tracking-tight">{value ?? '-'}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
      {badge && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
          {badge}
        </span>
      )}
    </div>
  );
  return to ? <Link to={to} className="block">{content}</Link> : content;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentBills, setRecentBills] = useState([]);
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (isAdmin) {
          // Parallel fetch across all active tools
          const [
            custRes,
            empRes,
            ordersRes,
            notStartedRes,
            onProgressRes,
            stitchingRes,
            notCheckedRes,
            deliveredRes,
            materialsRes,
            billingRes,
            tailorStaffRes
          ] = await Promise.allSettled([
            getCustomers({ limit: 1 }),
            getEmployees({ limit: 1 }),
            getTailoringOrders({ limit: 6 }),
            getTailoringOrders({ status: 'Not yet started', limit: 1 }),
            getTailoringOrders({ status: 'On Progress', limit: 1 }),
            getTailoringOrders({ status: 'Stitching Completed', limit: 1 }),
            getTailoringOrders({ status: 'Not yet Checked', limit: 1 }),
            getTailoringOrders({ status: 'Delivered', limit: 1 }),
            getMaterials(),
            getBillingRecords({ limit: 5 }),
            getTailorStaff()
          ]);

          const val = (res, getter, fallback = 0) => {
            if (res.status === 'fulfilled') {
              try { return getter(res.value) ?? fallback; } catch { return fallback; }
            }
            return fallback;
          };

          const materialsList = val(materialsRes, r => r.data.materials || [], []);
          const stockVal = materialsList.reduce((acc, m) => {
            const avail = Math.max(0, parseFloat(m.stockIn || 0) - parseFloat(m.stockOut || 0));
            return acc + (parseFloat(m.pricing || 0) * avail);
          }, 0);
          const lowStockList = materialsList.filter(m => {
            const avail = parseFloat(m.stockIn || 0) - parseFloat(m.stockOut || 0);
            return avail <= 5;
          });

          const billingData = val(billingRes, r => r.data, {});
          const billingStats = billingData.stats || {};

          setStats({
            customers:          val(custRes,        r => r.data.total),
            employees:          val(empRes,         r => r.data.total),
            totalOrders:        val(ordersRes,      r => r.data.total),
            notStarted:         val(notStartedRes,  r => r.data.total),
            onProgress:         val(onProgressRes,  r => r.data.total),
            stitchingCompleted: val(stitchingRes,   r => r.data.total),
            notChecked:         val(notCheckedRes,  r => r.data.total),
            delivered:          val(deliveredRes,   r => r.data.total),
            billingRevenue:     billingStats.totalRevenue || 0,
            billingCount:       billingStats.totalBills || 0,
            materialsCount:     materialsList.length,
            materialsStockVal:  stockVal,
            lowStockCount:      lowStockList.length,
            tailorsCount:       val(tailorStaffRes, r => r.data.total ?? r.data.staff?.length),
          });

          if (ordersRes.status === 'fulfilled') {
            setRecentOrders(ordersRes.value.data.orders || []);
          }
          if (billingRes.status === 'fulfilled') {
            setRecentBills(billingRes.value.data.records || []);
          }
          setLowStockMaterials(lowStockList.slice(0, 4));
        } else {
          // Staff View
          const ordersRes = await getTailoringOrders({ limit: 20 });
          setRecentOrders(ordersRes.data.orders || []);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Welcome Banner Card ──────────────────────────────────────────────── */}
      <div className="card-glass p-6 border border-purple-200/60 shadow-sm relative overflow-hidden bg-gradient-to-r from-purple-50/50 via-white to-indigo-50/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                <Sparkles className="w-3 h-3 text-purple-600" /> Admin Overview
              </span>
              <span className="text-xs text-gray-400 font-medium">Timelines Costume Designers</span>
            </div>
            <h2 className="font-display font-extrabold text-2xl text-gray-900 mt-1">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0] || 'Admin'}
            </h2>
            <p className="text-gray-500 mt-0.5 text-xs">
              Here is your active store summary: orders, billing, tailor payments, and materials.
            </p>
          </div>

          {/* Quick Action Shortcuts */}
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/customer/new"
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Order
              </Link>
              <Link
                to="/billing"
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 shadow-sm flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" /> Create Bill
              </Link>
              <Link
                to="/materials"
                className="btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold px-3 py-2 shadow-xs flex items-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5 text-indigo-600" /> Materials
              </Link>
              <Link
                to="/tailors-payment"
                className="btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold px-3 py-2 shadow-xs flex items-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5 text-purple-600" /> Tailor Payments
              </Link>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="text-center">
                <Loader className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-400">Loading store dashboard…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Order Status Pipeline ──────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-600" /> Customer Orders Status
                  </h3>
                  <Link to="/customer/list" className="text-xs text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-0.5">
                    View All Orders <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard
                    icon={ShoppingBag}
                    label="Total Orders"
                    value={stats?.totalOrders}
                    sub="All customer bookings"
                    color="bg-purple-600"
                    to="/customer/list"
                    badge="All"
                  />
                  <StatCard
                    icon={Clock}
                    label="Not Yet Started"
                    value={stats?.notStarted}
                    sub="Awaiting tailoring"
                    color="bg-amber-500"
                    to="/customer/list?status=Not yet started"
                    badge="Pending"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="On Progress"
                    value={stats?.onProgress}
                    sub="In active stitching"
                    color="bg-blue-600"
                    to="/customer/list?status=On Progress"
                    badge="Active"
                  />
                  <StatCard
                    icon={Scissors}
                    label="Stitching Done"
                    value={stats?.stitchingCompleted}
                    sub="Stitching finished"
                    color="bg-purple-700"
                    to="/customer/list?status=Stitching Completed"
                    badge="Stitched"
                  />
                  <StatCard
                    icon={AlertCircle}
                    label="Not Checked"
                    value={stats?.notChecked}
                    sub="Awaiting quality check"
                    color="bg-rose-500"
                    to="/customer/list?status=Not yet Checked"
                    badge="QC"
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Delivered"
                    value={stats?.delivered}
                    sub="Completed & handed over"
                    color="bg-emerald-600"
                    to="/customer/list?status=Delivered"
                    badge="Done"
                  />
                </div>
              </div>

              {/* ── Store Operations & Finance ─────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" /> Business & Store Overview
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  <StatCard
                    icon={IndianRupee}
                    label="Billing Revenue"
                    value={`₹ ${fmt(stats?.billingRevenue)}`}
                    sub={`${stats?.billingCount || 0} bills issued`}
                    color="bg-emerald-600"
                    to="/billing/records"
                  />
                  <StatCard
                    icon={Package}
                    label="Materials Stock"
                    value={`₹ ${fmt(stats?.materialsStockVal)}`}
                    sub={`${stats?.materialsCount || 0} raw material types`}
                    color="bg-indigo-600"
                    to="/materials"
                  />
                  <StatCard
                    icon={Scissors}
                    label="Tailors Staff"
                    value={stats?.tailorsCount}
                    sub="Piece & contract tailors"
                    color="bg-violet-600"
                    to="/tailors-payment"
                  />
                  <StatCard
                    icon={Users}
                    label="Customers"
                    value={stats?.customers}
                    sub="Registered customer base"
                    color="bg-blue-500"
                    to="/customers"
                  />
                  <StatCard
                    icon={UserSquare2}
                    label="Employees"
                    value={stats?.employees}
                    sub="Store staff & tailors"
                    color="bg-sky-600"
                    to="/employees"
                  />
                </div>
              </div>

              {/* ── Main Content Columns: Orders + Recent Bills ───────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
                {/* Left (7 cols): Recent Customer Orders Table */}
                <div className="lg:col-span-7 card overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-purple-600" />
                        <h3 className="font-bold text-gray-900 text-sm">Recent Customer Orders</h3>
                      </div>
                      <Link to="/customer/list" className="text-xs text-purple-600 hover:text-purple-800 font-semibold">
                        View all orders →
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-500 bg-gray-50/40 uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3.5 text-left">Order No</th>
                            <th className="py-2.5 px-3.5 text-left">Customer</th>
                            <th className="py-2.5 px-3.5 text-left">Delivery Date</th>
                            <th className="py-2.5 px-3.5 text-center">Status</th>
                            <th className="py-2.5 px-3.5 text-right">Items</th>
                            <th className="py-2.5 px-3.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {recentOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-10 text-gray-400">
                                No customer orders created yet.
                              </td>
                            </tr>
                          ) : (
                            recentOrders.map((order) => {
                              const norm = normalizeStatus(order.status);
                              const cfg = STATUS_CONFIG[norm] || STATUS_CONFIG['Not yet started'];
                              return (
                                <tr key={order.id} className="hover:bg-purple-50/30 transition-colors">
                                  <td className="py-3 px-3.5 font-mono font-bold text-purple-700">
                                    {order.orderNo || `ORD-${String(order.id).slice(-4)}`}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <div className="font-semibold text-gray-900">{order.customer?.name || 'Walk-in'}</div>
                                    {order.customer?.phone && (
                                      <div className="text-[11px] text-gray-400 font-mono">{order.customer.phone}</div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-gray-600 whitespace-nowrap">
                                    {order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yy') : ''}
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                      {cfg.label}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-medium text-gray-600">
                                    {order._count?.items ?? order.items?.length ?? 1}
                                  </td>
                                  <td className="py-3 px-3.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/customer/${order.id}`)}
                                      className="btn-icon text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                      title="Open Order"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right (5 cols): Recent Billing Records & Stock Alerts */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Recent Bills */}
                  <div className="card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-600" />
                        <h3 className="font-bold text-gray-900 text-sm">Recent Billing Receipts</h3>
                      </div>
                      <Link to="/billing/records" className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">
                        View records →
                      </Link>
                    </div>

                    <div className="p-3 divide-y divide-gray-100">
                      {recentBills.length === 0 ? (
                        <p className="text-center py-6 text-xs text-gray-400">No bills generated yet.</p>
                      ) : (
                        recentBills.map((b) => (
                          <div key={b.id} className="py-2.5 px-2 flex items-center justify-between hover:bg-gray-50 rounded-lg transition-colors">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-gray-900">{b.billNo}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 uppercase">
                                  {b.paymentMode || 'Cash'}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                {b.customerName || 'Walk-in Customer'}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold font-mono text-xs text-emerald-700">
                                ₹ {fmt(b.grandTotal)}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {b.billDate ? new Date(b.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Low Stock Materials Alert (if any) */}
                  {stats?.lowStockCount > 0 && (
                    <div className="card p-4 border border-rose-200 bg-rose-50/40">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          <h4 className="text-xs font-bold text-rose-900">
                            Low Stock Alert ({stats.lowStockCount} materials)
                          </h4>
                        </div>
                        <Link to="/materials" className="text-[11px] text-rose-700 hover:underline font-semibold">
                          Manage →
                        </Link>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {lowStockMaterials.map(m => (
                          <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 font-medium">
                            {m.name}: <strong className="font-bold">{m.stockAvailable || 0} {m.unit}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Staff View (Non-admin) ───────────────────────────────────────────── */}
      {!isAdmin && (
        loading ? (
          <div className="flex justify-center py-10"><Loader className="w-8 h-8 text-brand-400 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-xl text-gray-900">My Assigned Tasks</h3>
            </div>
            {recentOrders.length === 0 ? (
              <div className="card p-10 text-center text-gray-500">No tasks assigned to you right now.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recentOrders.map(order => {
                  const norm = normalizeStatus(order.status);
                  const cfg = STATUS_CONFIG[norm] || STATUS_CONFIG['Not yet started'];
                  return (
                    <div key={order.id} className="card p-5 border-l-4 border-purple-500 hover:border-purple-600 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-xs font-mono font-bold text-purple-700">
                            {order.orderNo || `ORD-${String(order.id).slice(-4)}`}
                          </span>
                          <h4 className="font-bold text-gray-900 text-lg mt-0.5">{order.customer?.name}</h4>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Order Items</p>
                        <div className="text-sm text-gray-700">
                          {order._count?.items ?? order.items?.length ?? 0} item(s)
                        </div>
                      </div>

                      {order.notes && (
                        <div className="space-y-1 mb-4">
                          <p className="text-xs text-gray-600 uppercase tracking-wider">Notes</p>
                          <p className="text-sm text-gray-800">{order.notes}</p>
                        </div>
                      )}

                      <div className="pt-4 border-t border-surface-border flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          Delivery: <span className="text-gray-700 font-medium">{order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yyyy') : ''}</span>
                        </div>
                        <Link to={`/customer/${order.id}`} className="btn-secondary py-1.5 px-3 text-xs">
                          View Order
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
