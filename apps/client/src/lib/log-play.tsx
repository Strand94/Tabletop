import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogPlayModal } from '../components/LogPlayModal.js';

interface LogPlayContextValue {
  openLogPlay: (gameId?: number) => void;
}

const LogPlayContext = createContext<LogPlayContextValue | null>(null);

/**
 * Provides a single app-wide "log a play" modal so the topbar button, the
 * sessions page, and a game's detail page can all trigger it. On save, routes
 * to the new session's detail page.
 */
export function LogPlayProvider({ children }: { children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [gameId, setGameId] = useState<number | undefined>();
  const navigate = useNavigate();

  const openLogPlay = useCallback((id?: number) => {
    setGameId(id);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openLogPlay }), [openLogPlay]);

  return (
    <LogPlayContext.Provider value={value}>
      {children}
      {open && (
        <LogPlayModal
          initialGameId={gameId}
          onClose={() => setOpen(false)}
          onSaved={(sessionId) => navigate(`/sessions/${sessionId}`)}
        />
      )}
    </LogPlayContext.Provider>
  );
}

export function useLogPlay(): LogPlayContextValue {
  const ctx = useContext(LogPlayContext);
  if (!ctx) throw new Error('useLogPlay must be used within a LogPlayProvider');
  return ctx;
}
