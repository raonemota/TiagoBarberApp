import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto min-w-[300px] p-4 rounded-2xl border shadow-2xl flex items-center gap-3 ${
                n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-gold/10 border-gold/20 text-gold'
              }`}
            >
              {n.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" />}
              {n.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0" />}
              {n.type === 'info' && <Info className="h-5 w-5 shrink-0" />}
              
              <p className="text-sm font-bold flex-1">{n.message}</p>
              
              <button 
                onClick={() => removeNotification(n.id)}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
