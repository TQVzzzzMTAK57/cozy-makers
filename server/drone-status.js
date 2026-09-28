// Frontend uses 'Idle' | 'Active' | 'Maintenance' | 'Offline'; PostgreSQL ENUM drone_status is lowercase.
const TO_DB = {
  idle:        'idle',
  active:      'active',
  maintenance: 'maintenance',
  offline:     'inactive',
  inactive:    'inactive',
};
const TO_UI = {
  idle:        'Idle',
  active:      'Active',
  maintenance: 'Maintenance',
  inactive:    'Offline',
};

const toDbStatus = (s) => TO_DB[String(s || 'idle').toLowerCase()] || 'idle';
const toUiStatus = (s) => TO_UI[s] || 'Offline';

// Map DB row → frontend field names
const droneToResponse = (d) => d ? ({
  ...d,
  serial_number:    d.serial_num,
  firmware_version: d.firmware,
  status:           toUiStatus(d.status),
}) : null;

module.exports = { toDbStatus, toUiStatus, droneToResponse };
