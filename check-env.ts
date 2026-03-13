import * as dotenv from 'dotenv';
dotenv.config();

console.log('--- Environment Check ---');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Present' : 'Missing');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
console.log('supabase_service_role_key:', process.env.supabase_service_role_key ? 'Present' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing');

if (process.env.supabase_service_role_key) {
  console.log('supabase_service_role_key length:', process.env.supabase_service_role_key.length);
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('SUPABASE_SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY.length);
}
console.log('-------------------------');
