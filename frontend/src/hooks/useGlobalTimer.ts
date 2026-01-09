import { useEffect } from "react";
import { useStore } from "../lib/store";
import { toast } from "sonner@2.0.3";
import { solverApi } from "../api/solverApi";

/**
 * Global timer hook that runs continuously and updates the session timer
 * This should be called once at the app level (in App.tsx)
 */
export function useGlobalTimer() {
  const { currentSession, setCurrentSession, currentUser, setCurrentUser } = useStore();

  useEffect(() => {
    // Only run timer if there's an active session
    if (!currentSession || currentSession.status !== "In Progress") {
      return;
    }

    const interval = setInterval(() => {
      const session = useStore.getState().currentSession;
      if (!session || session.status !== "In Progress") return;
      
      // Timer reached zero - auto-terminate
      if (session.remainingSeconds <= 0) {
        toast.error("Time's up! Session has been terminated.");
        
        // Update user history to mark as terminated
        const user = useStore.getState().currentUser;
        if (user) {
          const updatedHistory = user.history.map((h) =>
            h.scenarioId === session.scenarioId && h.status === "In Progress"
              ? { ...h, status: "Terminated" as const }
              : h
          );
          setCurrentUser({ ...user, history: updatedHistory });
        }
        
        solverApi.stopSession(session.id).catch(() => {
          /* best-effort */
        });
        setCurrentSession(null); // Clear session
        return;
      }

      // Countdown the timer
      setCurrentSession((prev) =>
        prev && prev.status === "In Progress"
          ? { ...prev, remainingSeconds: prev.remainingSeconds - 1 }
          : prev
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession?.id, currentSession?.status]);
}
