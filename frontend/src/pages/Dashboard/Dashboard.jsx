import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserSquare2, ShoppingBag, Clock, TrendingUp, CheckCircle, AlertCircle, Loader, Package, ShoppingCart, Scissors, CreditCard } from 'lucide-react';
import { getCustomers } from '../../api/customers';
import { getEmployees } from '../../api/employees';
import { getTailoringOrders } from '../../api/tailoringOrders';
import { getCredentials } from '../../api/auth';
import { getInventory } from '../../api/inventory';
import { getPurchases } from '../../api/purchases';
import { getServices } from '../../api/services';
import { getPayments } from '../../api/payments';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

const statusColors = {
  'Draft':     'badge-pending',
  'Submitted': 'badge-progress',
  'Ready':       'badge-ready',
  'Delivered':   'badge-delivered',
};

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="stat-card group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-gray-900" />
      </div>
      <div>
        <p className="text-gray-600 text-[10px] uppercase tracking-wider leading-none">{label}</p>
        <p className="font-display font-bold text-lg text-gray-900 mt-0.5 leading-none">{value ?? '-'}</p>
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
            getTailoringOrders({ limit: 5 }),
            getCredentials(),
            getInventory(),
            getPurchases(),
            getServices(),
            getPayments()
          ]);
          const [pendingRes, progressRes, readyRes] = await Promise.all([
            getTailoringOrders({ status: 'Draft', limit: 1 }),
            getTailoringOrders({ status: 'Submitted', limit: 1 }),
            getTailoringOrders({ status: 'Ready', limit: 1 }),
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
          const ordersRes = await getTailoringOrders({ limit: 20 });
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
        <h2 className="font-display font-bold text-2xl text-gray-900">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-gray-600 mt-1 text-sm">Here's what's happening at Timelines today.</p>
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
              <StatCard icon={ShoppingBag} label="Total Orders" value={stats?.totalOrders} color="bg-purple-600" to="/customer/list" />
              <StatCard icon={AlertCircle} label="Draft" value={stats?.pending} color="bg-amber-600" to="/customer/list?status=Draft" />
              <StatCard icon={TrendingUp} label="Submitted" value={stats?.inProgress} color="bg-blue-500" to="/customer/list?status=Submitted" />
              <StatCard icon={CheckCircle} label="Ready" value={stats?.ready} color="bg-green-600" to="/customer/list?status=Ready" />
              <StatCard icon={Package} label="Low Stock Items" value={stats?.lowStock} color="bg-rose-600" to="/inventory" />
              <StatCard icon={ShoppingCart} label="Total Purchases" value={stats?.purchases !== undefined ? `₹${stats.purchases}` : '-'} color="bg-orange-600" to="/purchases" />
              <StatCard icon={Scissors} label="Services" value={stats?.services} color="bg-indigo-600" to="/services" />
              <StatCard icon={CreditCard} label="Payments Received" value={stats?.payments !== undefined ? `₹${stats.payments}` : '-'} color="bg-emerald-600" to="/payments" />
            </div>
          )}

          <div className="card mt-6">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-gray-900">Recent Customer Orders</h3>
              <Link to="/customer/list" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">View all →</Link>
            </div>
            <div className="table-wrapper rounded-t-none border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Order Date</th>
                    <th>Delivery Date</th>
                    <th>Status</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">No orders yet.</td></tr>
                  )}
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className="font-medium text-gray-900">{order.customer?.name}</div>
                        {order.customer?.phone && <div className="text-xs text-gray-500 mt-0.5">{order.customer.phone}</div>}
                      </td>
                      <td className="text-gray-600 text-xs">
                        {order.orderDate ? format(new Date(order.orderDate), 'dd MMM yy') : '-'}
                      </td>
                      <td className="text-gray-600 text-xs">
                        {order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yy') : '-'}
                      </td>
                      <td><span className={statusColors[order.status] || 'badge'}>{order.status}</span></td>
                      <td className="text-gray-600 text-xs">
                        {order._count?.items ?? order.items?.length ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <h3 className="font-display font-semibold text-xl text-gray-900">My Assigned Tasks</h3>
            </div>
            {recentOrders.length === 0 ? (
              <div className="card p-10 text-center text-gray-500">No tasks assigned to you right now.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recentOrders.map(order => (
                  <div key={order.id} className="card p-5 border-l-4 border-brand-500 hover:border-brand-400 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{order.id}</span>
                        <h4 className="font-bold text-gray-900 text-lg mt-0.5">{order.customer?.name}</h4>
                      </div>
                      <span className={statusColors[order.status] || 'badge'}>{order.status}</span>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Order Items</p>
                      <div className="text-sm text-gray-700">
                        {order._count?.items ?? order.items?.length ?? 0} item(s)
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {order.notes && (
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-sm text-gray-800">{order.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-4 border-t border-surface-border flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        Delivery: <span className="text-gray-700 font-medium">{order.deliveryDate ? format(new Date(order.deliveryDate), 'dd MMM yyyy') : '-'}</span>
                      </div>
                      <Link to={`/customer/${order.id}`} className="btn-secondary py-1.5 px-3 text-xs">
                        View Order
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
