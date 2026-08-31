const prisma = require('./prisma');

const logCreate = async (recordType, recordId, user, snapshot) => {
  if (user?.role !== 'admin') return;
  try {
    await prisma.auditLog.create({
      data: {
        recordType,
        recordId: String(recordId),
        action: 'create',
        changedById: user.id,
        changedByName: user.name,
        changes: [],
        snapshot: snapshot || null,
      },
    });
  } catch (err) {
    console.error('Audit log error (create):', err.message);
  }
};

const diffObjects = (oldObj, newObj) => {
  const changes = [];
  const skipKeys = new Set(['updatedAt', 'createdAt', '__v']);
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of allKeys) {
    if (skipKeys.has(key)) continue;
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
};

const logUpdate = async (recordType, recordId, user, oldData, newData) => {
  if (user?.role !== 'admin') return;
  try {
    const changes = diffObjects(oldData, newData);
    if (changes.length === 0) return;
    await prisma.auditLog.create({
      data: {
        recordType,
        recordId: String(recordId),
        action: 'update',
        changedById: user.id,
        changedByName: user.name,
        changes,
        snapshot: newData || null,
      },
    });
  } catch (err) {
    console.error('Audit log error (update):', err.message);
  }
};

const logDelete = async (recordType, recordId, user, snapshot) => {
  if (user?.role !== 'admin') return;
  try {
    await prisma.auditLog.create({
      data: {
        recordType,
        recordId: String(recordId),
        action: 'delete',
        changedById: user.id,
        changedByName: user.name,
        changes: [],
        snapshot: snapshot || null,
      },
    });
  } catch (err) {
    console.error('Audit log error (delete):', err.message);
  }
};

module.exports = { logCreate, logUpdate, logDelete };
