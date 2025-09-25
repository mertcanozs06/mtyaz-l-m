import sql from 'mssql';
import dotenv from 'dotenv';
import { IDLE_FETCHER } from 'react-router-dom';

dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max:10,
    min:0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis:30000,
  },
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

export default pool;
export { sql, poolConnect  };