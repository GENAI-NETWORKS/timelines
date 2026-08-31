import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserSquare2, ShoppingBag, Clock, TrendingUp, CheckCircle, AlertCircle, Loader, Package, ShoppingCart, Scissors, CreditCard } from 'lucide-react';
import { getCustomers } from '../../api/customers';
import { getEmployees } from '../../api/employees';
import { getDesignOrders } from '../../api/designOrders';
import { getCredentials } from '../../api/auth';
import { getInventory } from '../../api/inventory';
import { getPurchases } from '../../api/purchases';
import { getServices } from '../../api/services';
import { getPayments } from '../../api/payments';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

const statusColors = {
  'Pending':     'badge-pending',
  'In Progress': 'badge-progress',
  'Ready':       'badge-ready',
  'Delivered':   'badge-delivered',
};

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="stat-card group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-[10px] uppercase tracking-wider leading-none">{label}</p>
        <p className="font-display font-bold text-lg text-white mt-0.5 leading-none">{value ?? '-'}</p>
        {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (isAdmin) {
          const [custRes, empRes, ordersRes, credsRes, invRes, purchRes, servRes, payRes] = await Promise.all([
            getCustomers({ limit: 1 }),
            getEmployees({ limit: 1 }),
            getDesignOrders({ limit: 5 }),
            getCredentials(),
            getInventory(),
            getPurchases(),
            getServices(),
            getPayments()
          ]);
          const [pendingRes, progressRes, readyRes] = await Promise.all([
            getDesignOrders({ status: 'Pending', limit: 1 }),
            getDesignOrders({ status: 'In Progress', limit: 1 }),
            getDesignOrders({ status: 'Ready', limit: 1 }),
          ]);
          setStats({
            customers: custRes.data.total,
            employees: empRes.data.total,
            totalOrders: ordersRes.data.total,
            pending: pendingRes.data.total,
            inProgress: progressRes.data.total,
            ready: readyRes.data.total,
            lowStock: invRes.data.filter(i => i.quantity <= i.minStockLevel).length,
            purchases: purchRes.data.reduce((sum, p) => sum + p.totalCost, 0),
            services: servRes.data.length,
            payments: payRes.data.reduce((sum, p) => sum + p.amount, 0),
          });
          setRecentOrders(ordersRes.data.orders);
          setCredentials(credsRes.data);
        } else {
          // Staff view: Just fetch assigned orders
          const ordersRes = await getDesignOrders({ limit: 20 });
          setRecentOrders(ordersRes.data.orders);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="card-glass p-6 border border-brand-800/40">
        <h2 className="font-display font-bold text-2xl text-white">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-gray-400 mt-1 text-sm">Here's what's happening at Timelines today.</p>
      </div>

      {/* Admin View: Stats grid & Global Recent Orders */}
      {isAdmin && (
        <>
          {loading ? (
            <div className="flex justify-center py-10"><Loader className="w-8 h-8 text-brand-400 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              <StatCard icon={Users} label="Customers" value={stats?.customers} color="bg-gradient-brand" to="/customers" />
              <StatCard icon={UserSquare2} label="Employees" value={stats?.employees} color="bg-blue-600" to="/employees" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={stats?.totalOrders} color="bg-purple-600" to="/orders" />
              <StatCard icon={AlertCircle} label="Pending" value={stats?.pending} color="bg-amber-600" to="/orders?status=Pending" />
              <StatCard icon={TrendingUp} label="In Progress" value={stats?.inProgress} color="bg-blue-500" to="/orders?status=In%20Progress" />
              <StatCard icon={CheckCircle} label="Ready" value={stats?.ready} color="bg-green-600" to="/orders?status=Ready" />
              <StatCard icon={Package} label="Low Stock Items" value={stats?.lowStock} color="bg-rose-600" to="/inventory" />
              <StatCard icon={ShoppingCart} label="Total Purchases" value={stats?.purchases !== undefined ? `₹${stats.purchases}` : '-'} color="bg-orange-600" to="/purchases" />
              <StatCard icon={Scissors} label="Services" value={stats?.services} color="bg-indigo-600" to="/services" />
              <StatCard icon={CreditCard} label="Payments Received" value={stats?.payments !== undefined ? `₹${stats.payments}` : '-'} color="bg-emerald-600" to="/payments" />
            </div>
          )}

          <div className="card mt-6">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-white">Recent Design Orders</h3>
              <Link to="/orders" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">View all →</Link>
            </div>
            <div className="table-wrapper rounded-t-none border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Garment</th>
                    <th>Status</th>
                    <th>Delivery</th>
                    <th>Tailor</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No orders yet.</td></tr>
                  )}
                  {recentOrders.map((order) => (
                    <tr key={order.orderId}>
                      <td className="font-mono text-brand-400 text-xs">{order.orderId}</td>
                      <td>
                        <div className="font-medium text-white">{order.customer?.name || order.customerId?.name}</div>
                        <div className="text-xs text-gray-500">{order.customerId?.customerId || order.customerId}</div>
                      </td>
                      <td>{order.garmentType}</td>
                      <td><span className={statusColors[order.status] || 'badge'}>{order.status}</span></td>
                      <td className="text-gray-400 text-xs">
                        {order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="text-gray-400 text-sm">{order.assignedTailorId?.name || order.tailor?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Login Credentials Widget */}
          <div className="card mt-6">
            <div className="px-5 py-4 border-b border-surface-border">
              <h3 className="font-display font-semibold text-white">System Login Credentials</h3>
              <p className="text-xs text-gray-400 mt-1">For demo & admin purposes only.</p>
            </div>
            <div className="p-5">
              <div className="bg-surface-elevated rounded-lg p-4 space-y-2 text-sm text-gray-300">
                {credentials.map(cred => (
                  <div key={cred.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="capitalize font-semibold text-gray-400 w-16">{cred.role}:</span>
                    <span>
                      <span className="text-brand-400 font-medium">{cred.email}</span>
                      <span className="text-gray-500 mx-2">/</span>
                      <span className="text-white">{cred.plainPassword || 'timelines123'}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Staff View: Personalized Tasks */}
      {!isAdmin && (
        loading ? (
           <div className="flex justify-center py-10"><Loader className="w-8 h-8 text-brand-400 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-xl text-white">My Assigned Tasks</h3>
            </div>
            {recentOrders.length === 0 ? (
              <div className="card p-10 text-center text-gray-500">No tasks assigned to you right now.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recentOrders.map(order => (
                  <div key={order.orderId} className="card p-5 border-l-4 border-brand-500 hover:border-brand-400 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{order.orderId}</span>
                        <h4 className="font-bold text-white text-lg mt-0.5">{order.garmentType}</h4>
                      </div>
                      <span className={statusColors[order.status] || 'badge'}>{order.status}</span>
                    </div>
                    
                    {Object.keys(order.measurements || {}).length > 0 && (
                       <div className="mb-4">
                         <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Measurements</p>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {Object.entries(order.measurements || {}).map(([k, v]) => (
                             <div key={k} className="bg-surface-elevated rounded px-2 py-1 text-xs">
                               <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}: </span>
                               <span className="text-white font-medium">{v}"</span>
                             </div>
                           ))}
                         </div>
                       </div>
                    )}

                    <div className="space-y-3 mb-4">
                      {order.fabricNotes && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Fabric Notes</p>
                          <p className="text-sm text-gray-200">{order.fabricNotes}</p>
                        </div>
                      )}
                      {order.specialInstructions && (
                        <div className="bg-amber-900/10 p-2 rounded border border-amber-900/30">
                          <p className="text-xs text-amber-500/70 uppercase tracking-wider mb-1">Instructions</p>
                          <p className="text-sm text-amber-200">{order.specialInstructions}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-4 border-t border-surface-border flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        Delivery: <span className="text-gray-300 font-medium">{order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yyyy') : '-'}</span>
                      </div>
                      <Link to={`/canvas?orderId=${order.orderId}`} className="btn-secondary py-1.5 px-3 text-xs">
                        Open Design Canvas
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
