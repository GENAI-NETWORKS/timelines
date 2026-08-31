import { X, Clock, User, Edit2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const actionIcons = { create: Plus, update: Edit2, delete: Trash2 };
const actionColors = {
  create: 'text-green-400 bg-green-900/30',
  update: 'text-blue-400 bg-blue-900/30',
  delete: 'text-rose-400 bg-rose-900/30',
};

export default function HistoryDrawer({ title, logs = [], onClose, loading }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="drawer" style={{ animation: 'slideIn 0.25s ease-out' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-display font-bold text-white text-lg">Edit History</h3>
            <p className="text-xs text-gray-500">{title}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && (
            <div className="text-center py-10 text-gray-500">Loading history…</div>
          )}
          {!loading && logs.length === 0 && (
            <div className="text-center py-10 text-gray-500">No history found.</div>
          )}
          {logs.map((log, i) => {
            const Icon = actionIcons[log.action] || Edit2;
            return (
              <div key={i} className="card p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${actionColors[log.action]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm capitalize">{log.action}</span>
                      <span className="text-xs text-gray-500">by</span>
                      <span className="text-xs text-brand-300">{log.changedByName || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(log.timestamp), 'dd MMM yyyy, hh:mm a')}
                    </div>
                  </div>
                </div>

                {log.changes?.length > 0 && (
                  <div className="space-y-1.5 ml-10">
                    {log.changes.map((c, j) => (
                      <div key={j} className="bg-surface-elevated rounded-lg px-3 py-2 text-xs">
                        <span className="text-gray-400 font-medium">{c.field}:</span>{' '}
                        <span className="text-rose-400 line-through mr-1">
                          {JSON.stringify(c.oldValue) ?? '-'}
                        </span>
                        <span className="text-gray-400">→</span>{' '}
                        <span className="text-green-400">
                          {JSON.stringify(c.newValue) ?? '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
