import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import ClientHome from './pages/ClientHome';
import Booking from './pages/Booking';
import Profile from './pages/Profile';
import UnitDetails from './pages/UnitDetails';
import BarberDashboard from './pages/BarberDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminProducts from './pages/AdminProducts';
import SubscriptionClub from './pages/SubscriptionClub';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/club" element={<SubscriptionClub />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                {/* Client Routes */}
                <Route path="/" element={<ClientHome />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/unit/:id" element={<UnitDetails />} />
                
                {/* Barber Routes */}
                <Route element={<ProtectedRoute allowedRoles={['barber', 'admin']} />}>
                  <Route path="/barber" element={<BarberDashboard />} />
                </Route>
                
                {/* Admin Routes */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/products" element={<AdminProducts />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
  );
}
