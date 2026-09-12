import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  // Always initialize to true on both server and initial client render to avoid hydration mismatch
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Synchronize client-side status safely after mount
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine ?? true);
      }
    }, 0);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
