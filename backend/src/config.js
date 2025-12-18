const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return process.env[name];
}
const asBool = (v) => String(v).toLowerCase() === 'true';

module.exports = {
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: Number(process.env.DB_PORT || 3306),

  DB_USER: required('DB_USER'),
  DB_PASS: process.env.DB_PASS || '',
  DB_NAME: required('DB_NAME'),

  PORT: Number(process.env.PORT || 4000),

  JWT_SECRET: required('JWT_SECRET'),

  DEMO_VULN: asBool(process.env.DEMO_VULN),
  DEMO_SQLI_LAB: asBool(process.env.DEMO_SQLI_LAB),
};
