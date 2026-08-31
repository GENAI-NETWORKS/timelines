import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, History, Loader, UserPlus } from 'lucide-react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getEmployeeAudit } from '../../api/employees';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLES = ['Tailor', 'Designer', 'Helper', 'Manager', 'Cutter', 'Other'];
const EMPTY = { name: '', role: 'Tailor', phone: '', email: '', address: '', joiningDate: '', notes: '' };

function EmployeeForm({ value, onChange, onSubmit, loading, onCancel, title }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} required placeholder="Employee name" />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="select" value={value.role} onChange={e => onChange({ ...value, role: e.target.value })} required>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} placeholder="9876543210" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} placeholder="emp@timelines.in" />
        </div>
        <div>
          <label className="label">Joining Date</label>
          <input className="input" type="date" value={value.joiningDate ? value.joiningDate.slice(0, 10) : ''} onChange={e => onChange({ ...value, joiningDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={value.status || 'active'} onChange={e => onChange({ ...value, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} placeholder="Address" />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[70px] resize-none" value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="Any notes…" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function Employees() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmployees({ search, page, limit: LIMIT, role: filterRole, status: filterStatus });
      setEmployees(res.data.employees);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load employees.'); }
    finally { setLoading(false); }
  }, [search, page, filterRole, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await createEmployee(editData); toast.success('Employee created!'); setModal(null); setEditData(EMPTY); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await updateEmployee(editId, editData); toast.success('Employee updated!'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deleteEmployee(deleteId); toast.success('Employee deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const openHistory = async (id, name) => {
    setHistoryFor(name); setHistoryLogs([]); setHistoryLoading(true);
    try { const res = await getEmployeeAudit(id); setHistoryLogs(res.data); }
    catch { toast.error('Failed to load history.'); }
    finally { setHistoryLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Employees</h1>
          <p className="text-sm text-gray-500">{total} total employees</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Search by name, ID, phone…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="select w-auto min-w-[130px]" value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select w-auto min-w-[130px]" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && employees.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-500">No employees found.</td></tr>}
              {employees.map(emp => (
                <tr key={emp.employeeId}>
                  <td><span className="font-mono text-xs text-brand-400">{emp.employeeId}</span></td>
                  <td className="font-medium text-white">{emp.name}</td>
                  <td>
                    <span className="badge badge-staff">{emp.role}</span>
                  </td>
                  <td className="text-gray-400">{emp.phone || '-'}</td>
                  <td className="text-gray-500 text-xs">{emp.joiningDate ? format(new Date(emp.joiningDate), 'dd MMM yyyy') : '-'}</td>
                  <td><span className={emp.status === 'active' ? 'badge-active' : 'badge-inactive'}>{emp.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openHistory(emp.employeeId, emp.name)} className="btn-icon" title="History"><History className="w-4 h-4" /></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => { setEditId(emp.employeeId); setEditData({ name: emp.name, role: emp.role, phone: emp.phone, email: emp.email, address: emp.address, joiningDate: emp.joiningDate, status: emp.status, notes: emp.notes }); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteId(emp.employeeId)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
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

      {modal === 'create' && <Modal title="Add Employee" onClose={() => setModal(null)}><EmployeeForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Create Employee" /></Modal>}
      {modal === 'edit' && <Modal title="Edit Employee" onClose={() => setModal(null)}><EmployeeForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" /></Modal>}
      {deleteId && <ConfirmModal title="Delete Employee?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
      {historyFor && <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
