import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Search, Edit2, Trash2, ChevronRight,
  Users, Scissors
} from 'lucide-react';
import {
  getTailorStaff, createTailorStaff,
  updateTailorStaff, deleteTailorStaff
} from '../../api/tailorStaff';
import Modal from '../../components/UI/Modal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import toast from 'react-hot-toast';

const ROLES = ['Tailoring', 'Cutting', 'Embroidery', 'Finishing', 'Stitching', 'Other'];
const EMPTY = { employeeId: '', name: '', role: 'Tailoring' };

// ── Role badge colour ─────────────────────────────────────────────────────────
const roleBg = (role) => {
  const map = {
    Tailoring: 'bg-purple-100 text-purple-700',
    Cutting:   'bg-blue-100 text-blue-700',
    Embroidery:'bg-pink-100 text-pink-700',
    Finishing: 'bg-green-100 text-green-700',
    Stitching: 'bg-amber-100 text-amber-700',
  };
  return map[role] || 'bg-gray-100 text-gray-600';
};

// ── Add / Edit form ───────────────────────────────────────────────────────────
function StaffForm({ value, onChange, onSubmit, loading, onCancel, submitLabel, isEdit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-4">
        {/* Employee ID */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">
            Employee ID {isEdit ? '(Read-only)' : '(optional)'}
          </label>
          <input
            className="input font-mono"
            value={value.employeeId}
            onChange={e => onChange({ ...value, employeeId: e.target.value })}
            placeholder={isEdit ? '' : 'Auto-numbered if empty (1, 2, 3…)'}
            disabled={isEdit}
          />
        </div>

        {/* Name */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">
            Employee Name *
          </label>
          <input
            className="input"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            required
            placeholder="e.g. Jothi"
          />
        </div>

        {/* Role */}
        <div>
          <label className="label text-xs font-bold uppercase tracking-wider text-gray-600">Role</label>
          <select className="select" value={value.role} onChange={e => onChange({ ...value, role: e.target.value })}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          type="submit"
          disabled={loading}
          className="btn flex-1 justify-center bg-purple-600 hover:bg-purple-700 text-white font-semibold"
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function TailorsPayment() {
  const navigate = useNavigate();
  const [staff,       setStaff]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [modal,       setModal]       = useState(null);  // 'create' | 'edit'
  const [formData,    setFormData]    = useState(EMPTY);
  const [editId,      setEditId]      = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteId,    setDeleteId]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTailorStaff({ search });
      setStaff(res.data.staff || []);
    } catch {
      toast.error('Failed to load tailor employees.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await createTailorStaff({
        employeeId:  formData.employeeId.trim() || undefined,
        name:        formData.name.trim(),
        role:        formData.role,
      });
      toast.success('Employee added!');
      setModal(null);
      setFormData(EMPTY);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add employee.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await updateTailorStaff(editId, {
        name: formData.name.trim(),
        role: formData.role,
      });
      toast.success('Employee updated!');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      await deleteTailorStaff(deleteId);
      toast.success('Employee removed.');
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete.');
    }
  };

  const openEdit = (s, e) => {
    e.stopPropagation();
    setEditId(s.id);
    setFormData({
      employeeId: s.employeeId,
      name:       s.name,
      role:       s.role,
    });
    setModal('edit');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tailors Payment</h1>
            <p className="text-sm text-gray-500">
              {staff.length} tailor employee{staff.length !== 1 ? 's' : ''}. Click any card to manage their work entries &amp; payments.
            </p>
          </div>
        </div>
        <button
          onClick={() => { setFormData(EMPTY); setModal('create'); }}
          className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search by name, ID, or role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Employee Cards ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading employees…
        </div>
      ) : staff.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-600" />
          <p className="font-semibold text-gray-700">No tailor employees yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Employee" to register a tailor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(s => (
            <div
              key={s.id}
              onClick={() => navigate(`/tailors-payment/${s.id}`)}
              className="card p-5 cursor-pointer hover:border-purple-300 hover:shadow-lg transition-all group select-none"
            >
              {/* Card top */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-sm flex-shrink-0">
                    {s.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-black text-gray-900 text-base uppercase tracking-wide">{s.name}</div>
                    <div className="text-xs text-purple-600 font-bold mt-0.5">ID: {s.employeeId}</div>
                    <div className="text-xs text-gray-500">{s.role}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors mt-1 flex-shrink-0" />
              </div>

              {/* Card bottom */}
              <div className="flex items-center gap-2">
                {/* Role badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBg(s.role)}`}>
                  {s.role}
                </span>

                {/* Edit / Delete buttons */}
                <div
                  className="flex items-center gap-1 ml-auto"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={e => openEdit(s, e)}
                    className="btn-icon text-blue-500 hover:bg-blue-50"
                    title="Edit employee"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(s.id); }}
                    className="btn-icon text-rose-500 hover:bg-rose-50"
                    title="Remove employee"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modal === 'create' && (
        <Modal title="Add Tailor Employee" onClose={() => setModal(null)}>
          <StaffForm
            value={formData}
            onChange={setFormData}
            onSubmit={handleCreate}
            loading={formLoading}
            onCancel={() => setModal(null)}
            submitLabel="Add Employee"
            isEdit={false}
          />
        </Modal>
      )}

      {modal === 'edit' && (
        <Modal title="Edit Employee" onClose={() => setModal(null)}>
          <StaffForm
            value={formData}
            onChange={setFormData}
            onSubmit={handleEdit}
            loading={formLoading}
            onCancel={() => setModal(null)}
            submitLabel="Save Changes"
            isEdit={true}
          />
        </Modal>
      )}

      {deleteId && (
        <ConfirmModal
          title="Remove Tailor Employee?"
          message="This will also delete all their work entries and payment history. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
