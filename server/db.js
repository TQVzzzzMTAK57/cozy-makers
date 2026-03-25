const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'data.json'));
const db = low(adapter);

// Initialize defaults
db.defaults({
  users: [],
  drones: [],
  predictions: [],
  alerts: [],
  _seq: { users: 1, drones: 1, predictions: 1, alerts: 1 },
}).write();

function nextId(collection) {
  const current = db.get(`_seq.${collection}`).value() || 1;
  db.set(`_seq.${collection}`, current + 1).write();
  return current;
}

// ─── MIGRATION: add missing fields to existing users ─────────────────────────
db.get('users').value().forEach(u => {
  const updates = {};
  if (u.role === undefined) updates.role = 'user';
  if (u.is_active === undefined) updates.is_active = true;
  if (u.full_name === undefined) updates.full_name = u.username;
  if (Object.keys(updates).length > 0) {
    db.get('users').find(x => x.id === u.id).assign(updates).write();
  }
});

// Ensure at least one admin exists
const adminExists = db.get('users').find(u => u.role === 'admin').value();
if (!adminExists) {
  const firstUser = db.get('users').sortBy('id').head().value();
  if (firstUser) {
    db.get('users').find(u => u.id === firstUser.id).assign({ role: 'admin' }).write();
    console.log(`✅ Promoted "${firstUser.username}" to admin`);
  }
}

// ─── SEED default users if database is empty ─────────────────────────────────
if (db.get('users').size().value() === 0) {
  db.get('users').push({
    id: nextId('users'),
    username: 'admin',
    email: 'admin@seadrone.ai',
    password: bcrypt.hashSync('Admin@123', 10),
    role: 'admin',
    is_active: true,
    full_name: 'System Administrator',
    created_at: new Date().toISOString(),
  }).write();

  db.get('users').push({
    id: nextId('users'),
    username: 'user1',
    email: 'user1@test.com',
    password: bcrypt.hashSync('User@123', 10),
    role: 'user',
    is_active: true,
    full_name: 'Demo User',
    created_at: new Date().toISOString(),
  }).write();

  console.log('\n📦 Seeded default accounts:');
  console.log('  👑 Admin : admin    / Admin@123');
  console.log('  👤 User  : user1    / User@123\n');
}

module.exports = { db, nextId };
