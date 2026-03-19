import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase setup for backend proxy
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zuwdcmdcrofvfexmbilg.supabase.co';
  const serviceKey = process.env.supabase_service_role_key || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('--- Supabase Backend Diagnostics ---');
  if (serviceKey && serviceKey.length > 50) {
    console.log('✅ Service Role Key: Carregada com sucesso.');
  } else {
    console.warn('⚠️ Service Role Key: NÃO ENCONTRADA!');
    console.log('Dica: Adicione "supabase_service_role_key" nos Secrets do AI Studio.');
  }
  console.log('------------------------------------');

  const supabaseServiceKey = serviceKey || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PaVgmXKzWUafRiUVm3hahg_uArKCEiF';
  
  // Initialize with service key if available to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // Proxy endpoint for promoting a user to barber
  app.post('/api/admin/promote-barber', async (req, res) => {
    try {
      const { userId, specialties, avatarUrl } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'ID do usuário é obrigatório' });
      }

      // 1. Update user role and avatar_url
      const userUpdates: any = { role: 'barber' };
      if (avatarUrl) {
        userUpdates.avatar_url = avatarUrl;
      }

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', userId);

      if (userError) {
        console.error('Supabase error promoting user to barber:', JSON.stringify(userError, null, 2));
        return res.status(400).json({
          message: userError.message,
          details: userError.details,
          hint: 'Se você estiver recebendo erro de RLS, certifique-se de que a SUPABASE_SERVICE_ROLE_KEY está configurada corretamente nos segredos do AI Studio.'
        });
      }

      // 2. Create barber profile
      const { data, error: barberError } = await supabase
        .from('barbers')
        .insert([{ 
          user_id: userId, 
          specialties,
          unit_id: req.body.unitId || null
        }])
        .select();

      if (barberError) {
        console.error('Supabase error creating barber profile:', JSON.stringify(barberError, null, 2));
        return res.status(400).json({
          message: barberError.message,
          details: barberError.details,
          hint: 'Se você estiver recebendo erro de RLS, certifique-se de que a SUPABASE_SERVICE_ROLE_KEY está configurada corretamente nos segredos do AI Studio.'
        });
      }
      
      res.json(data);
    } catch (error: any) {
      console.error('Error promoting barber:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    }
  });

  // Update user
  app.patch('/api/admin/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Supabase error updating user:', error);
        return res.status(400).json({
          message: error.message,
          details: error.details,
          hint: 'Se você estiver recebendo erro de RLS, certifique-se de que a SUPABASE_SERVICE_ROLE_KEY está configurada corretamente nos segredos do AI Studio.'
        });
      }
      res.json(data);
    } catch (error: any) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    }
  });

  // Delete user
  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // First delete from barbers if exists
      await supabase.from('barbers').delete().eq('user_id', id);
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting user:', error);
        return res.status(400).json({
          message: error.message,
          details: error.details,
          hint: 'Se você estiver recebendo erro de RLS, certifique-se de que a SUPABASE_SERVICE_ROLE_KEY está configurada corretamente nos segredos do AI Studio.'
        });
      }
      res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    }
  });

  // Create user (admin only)
  app.post('/api/admin/users', async (req, res) => {
    try {
      const { email, password, name, phone, role, subscription_type } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, senha e nome são obrigatórios' });
      }

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });

      if (authError) {
        console.error('Supabase auth error creating user:', authError);
        return res.status(400).json({ message: authError.message });
      }

      const userId = authData.user.id;

      // 2. Create user profile in 'users' table
      // Note: There might be a trigger, but we'll do an upsert or check if it exists
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert([{ 
          id: userId, 
          name, 
          email, 
          phone, 
          role: role || 'client', 
          subscription_type: subscription_type || 'comum' 
        }])
        .select();

      if (userError) {
        console.error('Supabase error creating user profile:', userError);
        return res.status(400).json({ message: userError.message });
      }

      res.json(userData);
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    }
  });

  // Proxy endpoint for creating services to avoid CORS/Failed to fetch on client
  app.post('/api/services', async (req, res) => {
    try {
      const { name, description, price, duration_minutes } = req.body;
      
      const { data, error } = await supabase
        .from('services')
        .insert([{ name, description, price, duration_minutes }])
        .select();

      if (error) {
        console.error('Supabase error in proxy:', error);
        // If it's an RLS error, provide a helpful hint
        if (error.code === '42501') {
          return res.status(403).json({ 
            message: 'Erro de permissão (RLS). Certifique-se de que a SUPABASE_SERVICE_ROLE_KEY está configurada nos segredos do AI Studio.',
            details: error
          });
        }
        return res.status(400).json(error);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    }
  });

  // Proxy endpoint for updating services
  app.patch('/api/services/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, duration_minutes } = req.body;
      
      const { data, error } = await supabase
        .from('services')
        .update({ name, description, price, duration_minutes })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Supabase error in proxy:', error);
        return res.status(400).json(error);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).json({ message: error.message || 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
