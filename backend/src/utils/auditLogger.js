const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const logCreate = async (recordType, recordId, user, snapshot) => {
  if (user?.role !== 'admin') return;
  try {
    await db.execute(
      `INSERT INTO AuditLog (id, recordType, recordId, action, changedById, changedByName, changes, snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), recordType, String(recordId), 'create', user.id, user.name, JSON.stringify([]), JSON.stringify(snapshot || null)]
    );
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
    await db.execute(
      `INSERT INTO AuditLog (id, recordType, recordId, action, changedById, changedByName, changes, snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), recordType, String(recordId), 'update', user.id, user.name, JSON.stringify(changes), JSON.stringify(newData || null)]
    );
  } catch (err) {
    console.error('Audit log error (update):', err.message);
  }
};

const logDelete = async (recordType, recordId, user, snapshot) => {
  if (user?.role !== 'admin') return;
  try {
    await db.execute(
      `INSERT INTO AuditLog (id, recordType, recordId, action, changedById, changedByName, changes, snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), recordType, String(recordId), 'delete', user.id, user.name, JSON.stringify([]), JSON.stringify(snapshot || null)]
    );
  } catch (err) {
    console.error('Audit log error (delete):', err.message);
  }
};

module.exports = { logCreate, logUpdate, logDelete };
