require('dotenv').config();

// Default value shipped in older .env.example files – anyone can forge tokens with it.
const KNOWN_WEAK_SECRETS = new Set(['drowning-detection-secret-key-2024']);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('\n❌ JWT_SECRET is not set. Add it to server/.env (see .env.example).\n');
  process.exit(1);
}
if (KNOWN_WEAK_SECRETS.has(JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('\n❌ JWT_SECRET is the public example value. Set a random secret in server/.env.\n');
    process.exit(1);
  }
  console.warn('\n⚠️  JWT_SECRET is the public example value – change it before deploying.\n');
}

module.exports = { JWT_SECRET };
