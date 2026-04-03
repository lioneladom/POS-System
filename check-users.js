import { pool } from "./server/db.js";

async function checkUsers() {
  try {
    const { rows: publicUsers } = await pool.query('select id, name, username, role from users');
    console.log('Current users in public.users table:');
    console.table(publicUsers);

    try {
      const { rows: authUsers } = await pool.query('select id, email, created_at from auth.users');
      console.log('Current users in auth.users table:');
      console.table(authUsers);
    } catch (e) {
      console.log('Could not read from auth.users (this is normal if not using postgres superuser role):', e.message);
    }

    await pool.end();
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  }
}

checkUsers();
