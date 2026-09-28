/**
 * Set (or reset) a user's password and re-activate the account.
 *   npm run set-password -- <username> [newPassword]
 * Without newPassword a random one is generated and printed.
 */
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool, Users } = require('../database');

async function main() {
  const [username, given] = process.argv.slice(2);
  if (!username) {
    console.error('Usage: npm run set-password -- <username> [newPassword]');
    process.exit(1);
  }
  if (given && given.length < 6) {
    console.error('Password must be at least 6 characters');
    process.exit(1);
  }
  const user = await Users.findByUsername(username.trim().toLowerCase());
  if (!user) {
    console.error(`User "${username}" not found`);
    process.exit(1);
  }
  const password = given || crypto.randomBytes(9).toString('base64url');
  await Users.update(user.id, { password: bcrypt.hashSync(password, 10), is_active: true });
  console.log(`✅ Password updated for "${user.username}"${given ? '' : `: ${password}`}`);
}

main()
  .catch(err => { console.error('❌', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
