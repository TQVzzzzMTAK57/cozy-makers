require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     Number(process.env.PG_PORT)  || 5432,
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'seadrone',
  connectionTimeoutMillis: 5000,
});

async function main() {
  const { rows: [v] } = await pool.query('SELECT version()');
  console.log('\n✅ DB connected:', v.version.split(' ').slice(0, 2).join(' '));

  const { rows: users } = await pool.query(
    'SELECT id, username, email, role, is_active FROM users ORDER BY id'
  );
  console.log('\n👥 Current users:');
  users.forEach(u =>
    console.log(`   [${u.id}] ${u.username.padEnd(10)} | ${u.role.padEnd(5)} | ${u.is_active ? 'active' : 'INACTIVE'}`)
  );

  const newPassword = 'Admin@123';
  const hash = bcrypt.hashSync(newPassword, 10);

  await pool.query(`
    INSERT INTO users (username, email, password, full_name, role, is_active)
    VALUES ($1, $2, $3, $4, 'admin', true)
    ON CONFLICT (username) DO UPDATE
      SET password  = EXCLUDED.password,
          role      = 'admin',
          is_active = true,
          full_name = EXCLUDED.full_name,
          email     = EXCLUDED.email
  `, ['admin', 'admin@seadrone.ai', hash, 'System Administrator']);

  const ok = bcrypt.compareSync(newPassword, hash);
  console.log('\n✅ Admin account restored:');
  console.log('   username : admin');
  console.log('   password : Admin@123');
  console.log('   role     : admin');
  console.log('   status   : active');
  console.log('   hash ok  :', ok);

  await pool.end();
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
