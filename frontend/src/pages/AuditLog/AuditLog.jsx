import { useState, useEffect, useCallback } from 'react';
import { Loader, Filter } from 'lucide-react';
import { getAuditLogs } from '../../api/auditLogs';
import Pagination from '../../components/UI/Pagination';
import { format } from 'date-fns';

const ACTION_STYLES = {
  create: 'badge bg-green-900/50 text-green-300 border border-green-700/50',
  update: 'badge bg-blue-900/50 text-blue-300 border border-blue-700/50',
  delete: 'badge bg-rose-900/50 text-rose-300 border border-rose-700/50',
};

const RECORD_TYPES = ['Customer', 'Employee', 'DesignOrder', 'Salary', 'GarmentTemplate', 'User'];

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ recordType: filterType, action: filterAction, dateFrom, dateTo, page, limit: LIMIT });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch { }
    finally { setLoading(false); }
  }, [filterType, filterAction, dateFrom, dateTo, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Audit Log</h1>
        <p className="text-sm text-gray-500">{total} total log entries - every change tracked</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-500" />
        <select className="select w-auto min-w-[160px]" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Record Types</option>
          {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="select w-auto min-w-[130px]" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <input className="input w-auto" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} title="Date from" />
        <input className="input w-auto" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} title="Date to" />
        <button onClick={() => { setFilterType(''); setFilterAction(''); setDateFrom(''); setDateTo(''); setPage(1); }} className="btn-ghost text-sm">Clear</button>
      </div>

      {/* Log table */}
      <div className="card">
        <div className="table-wrapper border-0 rounded-none rounded-t-xl">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Record Type</th>
                <th>Changed By</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-10"><Loader className="w-6 h-6 text-brand-400 animate-spin mx-auto" /></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-500">No log entries found.</td></tr>}
              {logs.map((log, i) => (
                <>
                  <tr key={log.id} className="cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <td className="text-gray-400 text-xs whitespace-nowrap">
                      {format(new Date(log.timestamp), 'dd MMM yy, hh:mm a')}
                    </td>
                    <td><span className={ACTION_STYLES[log.action]}>{log.action}</span></td>
                    <td><span className="badge badge-staff">{log.recordType}</span></td>
                    <td>
                      <div className="text-sm text-white">{log.changedByName || log.changedBy?.name}</div>
                      <div className="text-xs text-gray-500">{log.changedBy?.role}</div>
                    </td>
                    <td className="text-gray-400 text-xs">
                      {log.changes?.length > 0 ? `${log.changes.length} field(s) changed` : log.action === 'create' ? 'Record created' : 'Record deleted'}
                    </td>
                  </tr>
                  {expanded === log.id && log.changes?.length > 0 && (
                    <tr key={`${log.id}-exp`} className="bg-surface-elevated/30">
                      <td colSpan={5} className="px-6 py-3">
                        <div className="space-y-1.5">
                          {log.changes.map((c, j) => (
                            <div key={j} className="flex items-start gap-2 text-xs bg-surface rounded-lg px-3 py-2">
                              <span className="text-gray-400 font-medium min-w-[120px]">{c.field}:</span>
                              <span className="text-rose-400 line-through">{JSON.stringify(c.oldValue)}</span>
                              <span className="text-gray-500 mx-1">→</span>
                              <span className="text-green-400">{JSON.stringify(c.newValue)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-4">
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
