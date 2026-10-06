import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { WifiOff, Wifi } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import useNetworkStatus from '../hooks/useNetworkStatus';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
};

export default function AppLayout({ children, searchQuery, setSearchQuery }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { isOnline, wasOffline } = useNetworkStatus();

  const handleMenuOpen = useCallback(() => setMobileOpen(true), []);

  const sidebarW = collapsed ? 72 : 260;

  return (
    <div className="min-h-screen bg-nx-gradient flex">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main content area */}
      <div
        className={`nx-main flex flex-col flex-1 min-h-screen transition-all duration-300 ${
          collapsed ? 'sidebar-collapsed' : ''
        }`}
        style={{ marginLeft: `${sidebarW}px` }}
      >
        {/* Offline / Back-online banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500/15 border-b border-red-500/25 px-4 py-2 flex items-center justify-center gap-2 text-red-300 text-sm font-medium overflow-hidden"
            >
              <WifiOff className="w-4 h-4" />
              No internet connection — some features may not work
            </motion.div>
          )}
          {isOnline && wasOffline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-500/15 border-b border-emerald-500/25 px-4 py-2 flex items-center justify-center gap-2 text-emerald-300 text-sm font-medium overflow-hidden"
            >
              <Wifi className="w-4 h-4" />
              Back online
            </motion.div>
          )}
        </AnimatePresence>

        <TopBar
          onMenuOpen={handleMenuOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* Page content with route-based animation */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 overflow-x-hidden"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

