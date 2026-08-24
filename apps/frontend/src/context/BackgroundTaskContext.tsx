import React, { createContext, useContext, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, RefreshCw, Layers } from 'lucide-react';
import { clearApiCache } from '../api/client';

export interface BackgroundTask {
  id: string;
  title: string;
  description?: string;
  status: 'PROCESSING' | 'SUCCESS' | 'ERROR';
  createdAt: number;
  errorMessage?: string;
  action?: () => Promise<any>;
  onSuccess?: (data: any) => void;
  onError?: (err: any) => void;
}

interface BackgroundTaskContextType {
  tasks: BackgroundTask[];
  enqueueTask: (params: {
    title: string;
    description?: string;
    action: () => Promise<any>;
    onSuccess?: (data: any) => void;
    onError?: (err: any) => void;
  }) => string;
  dismissTask: (id: string) => void;
  retryTask: (id: string) => void;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextType | undefined>(undefined);

export const BackgroundTaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  const dismissTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const runTask = useCallback(async (taskItem: BackgroundTask) => {
    try {
      if (!taskItem.action) return;
      const result = await taskItem.action();
      
      // Invalidate API cache on background mutation completion
      clearApiCache();

      setTasks((prev) =>
        prev.map((t) => (t.id === taskItem.id ? { ...t, status: 'SUCCESS' } : t))
      );

      if (taskItem.onSuccess) {
        taskItem.onSuccess(result);
      }

      // Auto-dismiss successful tasks after 4 seconds
      setTimeout(() => {
        setTasks((prev) => prev.filter((t) => t.id !== taskItem.id));
      }, 4000);
    } catch (err: any) {
      console.error('[Background Task Error]', err);
      const msg = err.message || 'Background task failed.';
      
      setTasks((prev) =>
        prev.map((t) => (t.id === taskItem.id ? { ...t, status: 'ERROR', errorMessage: msg } : t))
      );

      if (taskItem.onError) {
        taskItem.onError(err);
      }
    }
  }, []);

  const enqueueTask = useCallback(
    ({
      title,
      description,
      action,
      onSuccess,
      onError,
    }: {
      title: string;
      description?: string;
      action: () => Promise<any>;
      onSuccess?: (data: any) => void;
      onError?: (err: any) => void;
    }) => {
      const taskId = `bg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newTask: BackgroundTask = {
        id: taskId,
        title,
        description,
        status: 'PROCESSING',
        createdAt: Date.now(),
        action,
        onSuccess,
        onError,
      };

      setTasks((prev) => [newTask, ...prev]);
      
      // Execute asynchronously in background immediately
      runTask(newTask);

      return taskId;
    },
    [runTask]
  );

  const retryTask = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target) return prev;
        const updated = { ...target, status: 'PROCESSING' as const, errorMessage: undefined };
        runTask(updated);
        return prev.map((t) => (t.id === id ? updated : t));
      });
    },
    [runTask]
  );

  const activeCount = tasks.filter((t) => t.status === 'PROCESSING').length;

  return (
    <BackgroundTaskContext.Provider value={{ tasks, enqueueTask, dismissTask, retryTask }}>
      {children}

      {/* TOP-LEFT BACKGROUND TASK QUEUE OVERLAY */}
      {tasks.length > 0 && (
        <div className="fixed top-4 left-4 z-50 w-80 sm:w-96 space-y-2 pointer-events-none">
          {/* Header Count Badge if multiple tasks */}
          {tasks.length > 1 && (
            <div className="pointer-events-auto bg-slate-900/90 text-white text-[11px] font-mono font-bold px-3 py-1.5 rounded-full shadow-lg border border-slate-700 backdrop-blur-md flex items-center justify-between w-fit animate-in fade-in slide-in-from-top-2">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Background Queue ({tasks.length} Job{tasks.length > 1 ? 's' : ''})</span>
              </span>
              {activeCount > 0 && (
                <span className="ml-2 text-emerald-400 font-extrabold">{activeCount} Running...</span>
              )}
            </div>
          )}

          {/* Stack of Cards */}
          {tasks.map((task) => {
            const isProcessing = task.status === 'PROCESSING';
            const isSuccess = task.status === 'SUCCESS';
            const isError = task.status === 'ERROR';

            return (
              <div
                key={task.id}
                className={`pointer-events-auto rounded-2xl p-3.5 border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-left-5 ${
                  isProcessing
                    ? 'bg-slate-900/95 text-white border-slate-700'
                    : isSuccess
                    ? 'bg-emerald-950/95 text-white border-emerald-500/50'
                    : 'bg-rose-950/95 text-white border-rose-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {isProcessing && <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />}
                      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                      {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold truncate leading-tight">{task.title}</h4>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                            isProcessing
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                              : isSuccess
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {isProcessing ? 'Processing' : isSuccess ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-slate-300 truncate font-medium">{task.description}</p>
                      )}
                      {isError && task.errorMessage && (
                        <p className="text-[11px] text-rose-300 font-mono font-semibold break-words mt-1">
                          Error: {task.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isError && (
                      <button
                        onClick={() => retryTask(task.id)}
                        title="Retry Task"
                        className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => dismissTask(task.id)}
                      title="Dismiss"
                      className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BackgroundTaskContext.Provider>
  );
};

export const useBackgroundTask = () => {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    throw new Error('useBackgroundTask must be used within a BackgroundTaskProvider');
  }
  return context;
};
