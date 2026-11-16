import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Edit2, Trash2, History, Loader, UserPlus,
  Phone, ImagePlus, Eye, X, Upload, CheckCircle2, UserCheck, Shield
} from 'lucide-react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getEmployeeAudit } from '../../api/employees';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import HistoryDrawer from '../../components/UI/HistoryDrawer';
import Pagination from '../../components/UI/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLES = ['Tailor', 'Designer', 'Helper', 'Manager', 'Cutter', 'Other'];
const EMPTY = {
  employeeId: '',
  name: '',
  role: 'Tailor',
  phone: '',
  email: '',
  address: '',
  joiningDate: '',
  status: 'active',
  notes: '',
  proofUrl: '',
};

const getPhotoUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
  return `${base}${url}`;
};

function EmployeeForm({ value, onChange, onSubmit, loading, onCancel, title, isEdit }) {
  const [preview, setPreview] = useState(getPhotoUrl(value.proofUrl));
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      onChange({ ...value, proofFile: selected });
    }
  };

  const removePhoto = () => {
    setFile(null);
    setPreview(null);
    onChange({ ...value, proofFile: null, removePhoto: true });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Employee ID */}
        <div>
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">
            Employee ID {isEdit ? '(Read-only)' : '(Optional)'}
          </label>
          <input
            className="input font-mono"
            value={value.employeeId || ''}
            onChange={e => onChange({ ...value, employeeId: e.target.value })}
            placeholder={isEdit ? '' : 'Auto-generated if empty (e.g. EMP-0001)'}
            disabled={isEdit}
          />
        </div>

        {/* Employee Name */}
        <div>
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">
            Employee Name *
          </label>
          <input
            className="input"
            value={value.name || ''}
            onChange={e => onChange({ ...value, name: e.target.value })}
            required
            placeholder="e.g. Ramesh Kumar"
          />
        </div>

        {/* Phone number */}
        <div>
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">
            Phone Number *
          </label>
          <input
            className="input"
            type="tel"
            value={value.phone || ''}
            onChange={e => onChange({ ...value, phone: e.target.value })}
            required
            placeholder="e.g. 9876543210"
          />
        </div>

        {/* Role */}
        <div>
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">
            Role
          </label>
          <select
            className="select"
            value={value.role || 'Tailor'}
            onChange={e => onChange({ ...value, role: e.target.value })}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Proof Photo Upload Slot */}
        <div className="sm:col-span-2">
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">
            Proof (Photo / ID Card / Aadhar)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {preview ? (
            <div className="relative border-2 border-purple-200 rounded-2xl p-2 bg-purple-50/30 flex items-center gap-4">
              <img
                src={preview}
                alt="Proof Preview"
                className="w-24 h-24 object-cover rounded-xl border border-purple-200 shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800">Proof photo attached</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Click Change to replace or Remove to delete.</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-purple-50/20"
            >
              <Upload className="w-7 h-7 mx-auto text-purple-500 mb-1.5" />
              <p className="text-xs font-bold text-gray-700">Click to upload proof photo</p>
              <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, WEBP up to 10MB</p>
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">Status</label>
          <select
            className="select"
            value={value.status || 'active'}
            onChange={e => onChange({ ...value, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Joining Date */}
        <div>
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">Joining Date</label>
          <input
            className="input"
            type="date"
            value={value.joiningDate ? value.joiningDate.slice(0, 10) : ''}
            onChange={e => onChange({ ...value, joiningDate: e.target.value })}
          />
        </div>

        {/* Address */}
        <div className="sm:col-span-2">
          <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">Address</label>
          <input
            className="input"
            value={value.address || ''}
            onChange={e => onChange({ ...value, address: e.target.value })}
            placeholder="Address (optional)"
          />
        </div>
      </div>

      <div>
        <label className="label text-xs font-bold text-gray-700 uppercase tracking-wider">Notes</label>
        <textarea
          className="input min-h-[60px] resize-none"
          value={value.notes || ''}
          onChange={e => onChange({ ...value, notes: e.target.value })}
          placeholder="Any notes, remarks or ID details…"
        />
      </div>

      <div className="flex gap-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1 justify-center bg-purple-600 hover:bg-purple-700"
        >
          {loading ? 'Saving…' : title}
        </button>
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
  const [formData, setFormData] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewPhotoUrl, setViewPhotoUrl] = useState(null);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmployees({ search, page, limit: LIMIT, role: filterRole, status: filterStatus });
      setEmployees(res.data.employees || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, [search, page, filterRole, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const fd = new FormData();
      if (formData.employeeId?.trim()) fd.append('employeeId', formData.employeeId.trim());
      fd.append('name', formData.name.trim());
      fd.append('role', formData.role || 'Tailor');
      fd.append('phone', formData.phone?.trim() || '');
      fd.append('email', formData.email?.trim() || '');
      fd.append('address', formData.address?.trim() || '');
      fd.append('status', formData.status || 'active');
      fd.append('notes', formData.notes?.trim() || '');
      if (formData.joiningDate) fd.append('joiningDate', formData.joiningDate);
      if (formData.proofFile) fd.append('proof', formData.proofFile);

      await createEmployee(fd);
      toast.success('Employee created successfully!');
      setModal(null);
      setFormData(EMPTY);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create employee.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('role', formData.role || 'Tailor');
      fd.append('phone', formData.phone?.trim() || '');
      fd.append('email', formData.email?.trim() || '');
      fd.append('address', formData.address?.trim() || '');
      fd.append('status', formData.status || 'active');
      fd.append('notes', formData.notes?.trim() || '');
      if (formData.joiningDate) fd.append('joiningDate', formData.joiningDate);
      if (formData.proofFile) fd.append('proof', formData.proofFile);

      await updateEmployee(editId, fd);
      toast.success('Employee updated successfully!');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEmployee(deleteId);
      toast.success('Employee deleted.');
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete employee.');
    }
  };

  const openEditModal = (emp) => {
    setEditId(emp.employeeId);
    setFormData({
      employeeId: emp.employeeId,
      name: emp.name,
      role: emp.role || 'Tailor',
      phone: emp.phone || '',
      email: emp.email || '',
      address: emp.address || '',
      joiningDate: emp.joiningDate || '',
      status: emp.status || 'active',
      notes: emp.notes || '',
      proofUrl: emp.proofUrl || '',
    });
    setModal('edit');
  };

  const openHistory = async (id, name) => {
    setHistoryFor(name);
    setHistoryLogs([]);
    setHistoryLoading(true);
    try {
      const res = await getEmployeeAudit(id);
      setHistoryLogs(res.data);
    } catch {
      toast.error('Failed to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Lightbox for Proof photo */}
      {viewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewPhotoUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 flex items-center gap-1 text-sm font-semibold"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img
              src={viewPhotoUrl}
              alt="Proof Document"
              className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl bg-black"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Employee Details</h1>
            <p className="text-sm text-gray-500">{total} employee{total !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setFormData(EMPTY); setModal('create'); }}
            className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search by Employee ID, Name, or Phone…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="select w-auto min-w-[140px] text-sm"
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          className="select w-auto min-w-[130px] text-sm"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Employee Details Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Proof (Photo)</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Loader className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
                    Loading employee details…
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-30 text-purple-600" />
                    <p className="font-semibold text-gray-700">No employees found.</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Add Employee" to create the first record.</p>
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const proofFull = getPhotoUrl(emp.proofUrl);
                  return (
                    <tr key={emp.employeeId} className="hover:bg-purple-50/30 transition-colors">
                      {/* Employee ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                        {emp.employeeId}
                      </td>

                      {/* Employee Name */}
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {emp.name}
                      </td>

                      {/* Phone Number */}
                      <td className="py-3.5 px-4 font-mono text-gray-700 text-xs">
                        {emp.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {emp.phone}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Proof (photo) */}
                      <td className="py-3.5 px-4">
                        {proofFull ? (
                          <button
                            type="button"
                            onClick={() => setViewPhotoUrl(proofFull)}
                            className="inline-flex items-center gap-2 group cursor-pointer"
                            title="Click to view full proof"
                          >
                            <img
                              src={proofFull}
                              alt={emp.name}
                              className="w-10 h-10 object-cover rounded-lg border border-purple-200 group-hover:scale-105 transition-transform shadow-sm"
                            />
                            <span className="text-xs font-semibold text-purple-600 group-hover:underline flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> View
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No proof</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="badge badge-staff text-xs">
                          {emp.role || 'Tailor'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={emp.status === 'active' ? 'badge-active text-xs' : 'badge-inactive text-xs'}>
                          {emp.status}
                        </span>
                      </td>

                      {/* Actions (Edit / Delete / History) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => openEditModal(emp)}
                              className="btn-icon text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit Employee"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openHistory(emp.employeeId, emp.name)}
                            className="btn-icon text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            title="Audit History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteId(emp.employeeId)}
                              className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Add Modal */}
      {modal === 'create' && (
        <Modal title="Add Employee" onClose={() => setModal(null)}>
          <EmployeeForm
            value={formData}
            onChange={setFormData}
            onSubmit={handleCreate}
            loading={formLoading}
            onCancel={() => setModal(null)}
            title="Create Employee"
            isEdit={false}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && (
        <Modal title="Edit Employee Details" onClose={() => setModal(null)}>
          <EmployeeForm
            value={formData}
            onChange={setFormData}
            onSubmit={handleEdit}
            loading={formLoading}
            onCancel={() => setModal(null)}
            title="Save Changes"
            isEdit={true}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <ConfirmModal
          title="Delete Employee?"
          message="Are you sure you want to delete this employee? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* History Drawer */}
      {historyFor && (
        <HistoryDrawer
          title={historyFor}
          logs={historyLogs}
          loading={historyLoading}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}
