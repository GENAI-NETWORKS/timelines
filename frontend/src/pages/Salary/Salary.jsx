import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, History, Loader, CheckCircle } from 'lucide-react';
import { getSalaries, createSalary, updateSalary, deleteSalary, markPaid, getSalaryAudit } from '../../api/salary';
import { getEmployees } from '../../api/employees';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const EMPTY = { employeeId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), baseSalary: '', advances: 0, deductions: 0, bonus: 0, paidStatus: 'unpaid', notes: '' };

function SalaryForm({ value, onChange, onSubmit, loading, onCancel, title, employees }) {
  const net = Number(value.baseSalary || 0) + Number(value.bonus || 0) - Number(value.advances || 0) - Number(value.deductions || 0);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Employee *</label>
          <select className="select" value={value.employeeId} onChange={e => onChange({ ...value, employeeId: e.target.value })} required>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId}) - {e.role}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Month *</label>
          <select className="select" value={value.month} onChange={e => onChange({ ...value, month: parseInt(e.target.value) })} required>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year *</label>
          <input className="input" type="number" value={value.year} onChange={e => onChange({ ...value, year: parseInt(e.target.value) })} required min="2020" max="2030" />
        </div>
        <div>
          <label className="label">Base Salary (₹) *</label>
          <input className="input" type="number" value={value.baseSalary} onChange={e => onChange({ ...value, baseSalary: e.target.value })} required min="0" />
        </div>
        <div>
          <label className="label">Bonus (₹)</label>
          <input className="input" type="number" value={value.bonus} onChange={e => onChange({ ...value, bonus: e.target.value })} min="0" />
        </div>
        <div>
          <label className="label">Advances (₹)</label>
          <input className="input" type="number" value={value.advances} onChange={e => onChange({ ...value, advances: e.target.value })} min="0" />
        </div>
        <div>
          <label className="label">Deductions (₹)</label>
          <input className="input" type="number" value={value.deductions} onChange={e => onChange({ ...value, deductions: e.target.value })} min="0" />
        </div>
        <div>
          <label className="label">Payment Status</label>
          <select className="select" value={value.paidStatus} onChange={e => onChange({ ...value, paidStatus: e.target.value })}>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
      <div className="card-glass p-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm">Net Payable:</span>
        <span className={`font-display font-bold text-xl ${net >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
          ₹{net.toLocaleString('en-IN')}
        </span>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[60px] resize-none" value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="Any notes…" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving…' : title}</button>
      </div>
    </form>
  );
}

export default function Salary() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
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
  const [employees, setEmployees] = useState([]);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalaries({ month: filterMonth, year: filterYear, paidStatus: filterStatus, page, limit: LIMIT });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load salary records.'); }
    finally { setLoading(false); }
  }, [filterMonth, filterYear, filterStatus, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getEmployees({ limit: 200, status: 'active' }).then(r => setEmployees(r.data.employees)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await createSalary(editData); toast.success('Salary record created!'); setModal(null); setEditData(EMPTY); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed. Record may already exist for this month.'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormLoading(true);
    try { await updateSalary(editId, editData); toast.success('Updated!'); setModal(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try { await deleteSalary(deleteId); toast.success('Deleted.'); setDeleteId(null); load(); }
    catch (err) { toast.error('Failed.'); }
  };

  const handleMarkPaid = async (id) => {
    try { await markPaid(id, { amount: 0, note: 'Marked paid' }); toast.success('Marked as paid!'); load(); }
    catch { toast.error('Failed.'); }
  };

  const openHistory = async (id, name) => {
    setHistoryFor(name); setHistoryLogs([]); setHistoryLoading(true);
    try { const res = await getSalaryAudit(id); setHistoryLogs(res.data); }
    catch { toast.error('Failed to load history.'); }
    finally { setHistoryLoading(false); }
  };

  const totalPayable = records.reduce((acc, r) => acc + (r.netPaid || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Salary Management</h1>
          <p className="text-sm text-gray-500">{total} records · Total payable: <span className="text-green-400 font-medium">₹{totalPayable.toLocaleString('en-IN')}</span></p>
        </div>
        <button onClick={() => { setEditData(EMPTY); setModal('create'); }} className="btn-primary sm:ml-auto">
          <Plus className="w-4 h-4" /> Add Salary Record
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <select className="select w-auto min-w-[110px]" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }}>
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input className="input w-auto w-24" type="number" value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1); }} placeholder="Year" min="2020" max="2030" />
        <select className="select w-auto min-w-[130px]" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Month / Year</th>
                <th>Base Salary</th>
                <th>Bonus</th>
                <th>Advances</th>
                <th>Deductions</th>
                <th>Net Payable</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-gray-500">No records found.</td></tr>}
              {records.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium text-white">{r.employee?.name}</div>
                    <div className="text-xs text-gray-500">{r.employee?.role}</div>
                  </td>
                  <td className="font-medium">{MONTHS[r.month - 1]} {r.year}</td>
                  <td>₹{r.baseSalary?.toLocaleString('en-IN')}</td>
                  <td className="text-green-400">+₹{r.bonus || 0}</td>
                  <td className="text-amber-400">-₹{r.advances || 0}</td>
                  <td className="text-rose-400">-₹{r.deductions || 0}</td>
                  <td className="font-bold text-white">₹{r.netPaid?.toLocaleString('en-IN')}</td>
                  <td><span className={`badge-${r.paidStatus}`}>{r.paidStatus}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openHistory(r.id, `${r.employee?.name} - ${MONTHS[r.month-1]} ${r.year}`)} className="btn-icon" title="History"><History className="w-4 h-4" /></button>
                      {r.paidStatus !== 'paid' && (
                        <button onClick={() => handleMarkPaid(r.id)} className="btn-icon text-green-400" title="Mark Paid"><CheckCircle className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => { setEditId(r.id); setEditData({ employeeId: r.employee?.employeeId, month: r.month, year: r.year, baseSalary: r.baseSalary, advances: r.advances, deductions: r.deductions, bonus: r.bonus, paidStatus: r.paidStatus, notes: r.notes }); setModal('edit'); }} className="btn-icon text-blue-400"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(r.id)} className="btn-icon text-rose-400"><Trash2 className="w-4 h-4" /></button>
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

      {modal === 'create' && <Modal title="Add Salary Record" onClose={() => setModal(null)}><SalaryForm value={editData} onChange={setEditData} onSubmit={handleCreate} loading={formLoading} onCancel={() => setModal(null)} title="Create Record" employees={employees} /></Modal>}
      {modal === 'edit' && <Modal title="Edit Salary Record" onClose={() => setModal(null)}><SalaryForm value={editData} onChange={setEditData} onSubmit={handleEdit} loading={formLoading} onCancel={() => setModal(null)} title="Save Changes" employees={employees} /></Modal>}
      {deleteId && <ConfirmModal title="Delete Salary Record?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
      {historyFor && <HistoryDrawer title={historyFor} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
