import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate as useRouterNavigate,
  useLocation,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { WelcomeGuide } from "./components/WelcomeGuide";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { useStore } from "./lib/store";
import { useGlobalTimer } from "./hooks/useGlobalTimer";
import { tokenStore } from "./api/httpClient";
import { authApi } from "./api/authApi";

// Lazy load pages for code splitting
const ChallengesPage = lazy(() => import("./pages/ChallengesPage").then(m => ({ default: m.ChallengesPage })));
const ChallengePreview = lazy(() => import("./pages/ChallengePreview").then(m => ({ default: m.ChallengePreview })));
const LaunchingPage = lazy(() => import("./pages/LaunchingPage").then(m => ({ default: m.LaunchingPage })));
const InChallengePage = lazy(() => import("./pages/InChallengePage").then(m => ({ default: m.InChallengePage })));
const PlaylistsPage = lazy(() => import("./pages/PlaylistsPage").then(m => ({ default: m.PlaylistsPage })));
const PlaylistDetailPage = lazy(() => import("./pages/PlaylistDetailPage").then(m => ({ default: m.default || m.PlaylistDetailPage })));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage").then(m => ({ default: m.FavoritesPage })));
const CreatePlaylistPage = lazy(() => import("./pages/CreatePlaylistPage").then(m => ({ default: m.CreatePlaylistPage })));
const EditPlaylistPage = lazy(() => import("./pages/EditPlaylistPage").then(m => ({ default: m.EditPlaylistPage })));
const CareerPathsPage = lazy(() => import("./pages/CareerPathsPage").then(m => ({ default: m.CareerPathsPage })));
const CareerPathDetailPage = lazy(() => import("./pages/CareerPathDetailPage").then(m => ({ default: m.default || m.CareerPathDetailPage })));
const CreateCareerPathPage = lazy(() => import("./pages/CreateCareerPathPage").then(m => ({ default: m.CreateCareerPathPage })));
const EditCareerPathPage = lazy(() => import("./pages/EditCareerPathPage").then(m => ({ default: m.EditCareerPathPage })));
const EventsPage = lazy(() => import("./pages/EventsPage").then(m => ({ default: m.EventsPage })));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage").then(m => ({ default: m.default || m.EventDetailPage })));
const CreateEventPage = lazy(() => import("./pages/CreateEventPage").then(m => ({ default: m.CreateEventPage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then(m => ({ default: m.LeaderboardPage })));
const TeamsPage = lazy(() => import("./pages/TeamsPage").then(m => ({ default: m.TeamsPage })));
const TeamDetailPage = lazy(() => import("./pages/TeamDetailPage").then(m => ({ default: m.default || m.TeamDetailPage })));
const TeamSettingsPage = lazy(() => import("./pages/TeamSettingsPage").then(m => ({ default: m.TeamSettingsPage })));
const RequestsPage = lazy(() => import("./pages/RequestsPage").then(m => ({ default: m.RequestsPage })));
const AccountPage = lazy(() => import("./pages/AccountPage").then(m => ({ default: m.AccountPage })));
const HelpPage = lazy(() => import("./pages/HelpPage").then(m => ({ default: m.HelpPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const MyScenariosPage = lazy(() => import("./pages/creator/MyScenariosPageNew").then(m => ({ default: m.MyScenariosPage })));
const ScenarioDetailPage = lazy(() => import("./pages/creator/ScenarioDetailPage").then(m => ({ default: m.default || m.ScenarioDetailPage })));
const ScenarioBuilder = lazy(() => import("./pages/creator/ScenarioBuilder").then(m => ({ default: m.ScenarioBuilder })));
const AdminConsolePage = lazy(() => import("./pages/admin/AdminConsolePage").then(m => ({ default: m.AdminConsolePage })));
const ApprovalsPage = lazy(() => import("./pages/admin/ApprovalsPage").then(m => ({ default: m.default || m.ApprovalsPage })));
const ScenarioApprovalsPage = lazy(() => import("./pages/admin/ScenarioApprovalsPage").then(m => ({ default: m.ScenarioApprovalsPage })));
const AdminScenariosPage = lazy(() => import("./pages/admin/AdminScenariosPage").then(m => ({ default: m.AdminScenariosPage })));
const DeploymentManagement = lazy(() => import("./pages/admin/DeploymentManagement").then(m => ({ default: m.default || m.DeploymentManagement })));
const ToolsLinksPage = lazy(() => import("./pages/admin/ToolsLinksPage").then(m => ({ default: m.default || m.ToolsLinksPage })));
const UsersManagementPage = lazy(() => import("./pages/admin/UsersManagementPage").then(m => ({ default: m.UsersManagementPage })));
const CareerPathsManagementPage = lazy(() => import("./pages/admin/CareerPathsManagementPage").then(m => ({ default: m.default || m.CareerPathsManagementPage })));
const AdminSystemSettings = lazy(() => import("./pages/admin/AdminSystemSettings").then(m => ({ default: m.default || m.AdminSystemSettings })));
const AdminCostDashboard = lazy(() => import("./pages/admin/AdminCostDashboard").then(m => ({ default: m.default || m.AdminCostDashboard })));
const AdminContainers = lazy(() => import("./pages/admin/AdminContainers").then(m => ({ default: m.default || m.AdminContainers })));
const AdminTestingPage = lazy(() => import("./pages/admin/AdminTestingPage").then(m => ({ default: m.AdminTestingPage })));
const BadgesPage = lazy(() => import("./pages/admin/BadgesPage").then(m => ({ default: m.BadgesPage })));
const BadgeManagementPage = lazy(() => import("./pages/BadgeManagementPage").then(m => ({ default: m.default })));
const BadgeProgressPage = lazy(() => import("./pages/BadgeProgressPage").then(m => ({ default: m.default })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useStore();
  const location = useLocation();
  
  // Also check localStorage directly as fallback (in case store hasn't rehydrated yet)
  const hasToken = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("rangex_access_token"));
  
  if (!isAuthenticated && !hasToken) {
    console.log("[ProtectedRoute] Not authenticated, redirecting to login");
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const routerNavigate = useRouterNavigate();
  const [showWelcome, setShowWelcome] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const {
    appearance,
    isAuthenticated,
    currentUser,
    setIsAuthenticated,
    setCurrentUser,
  } = useStore();

  // Initialize global timer
  useGlobalTimer();

  // Apply theme settings on mount and when appearance changes
  useEffect(() => {
    // Apply theme
    if (appearance.theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else if (appearance.theme === "light") {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
      document.body.classList.toggle("dark", isDark);
    }

    // Apply accent color to all relevant CSS variables
    const colors: Record<string, string> = {
      cyan: "189 100% 56%",
      blue: "221 83% 53%",
      purple: "271 81% 56%",
      green: "142 76% 36%",
      orange: "25 95% 53%",
      red: "0 72% 51%",
    };
    const colorValue = colors[appearance.accentColor];
    document.documentElement.style.setProperty("--primary", colorValue);
    document.documentElement.style.setProperty("--ring", colorValue);
    document.documentElement.style.setProperty("--sidebar-primary", colorValue);
    document.documentElement.style.setProperty("--sidebar-ring", colorValue);

    // Apply contrast
    document.documentElement.style.filter = `contrast(${appearance.contrast}%)`;

    // Apply reduced motion
    if (appearance.reducedMotion) {
      document.documentElement.setAttribute("data-reduced-motion", "true");
    } else {
      document.documentElement.removeAttribute("data-reduced-motion");
    }

    // Apply compact mode
    if (appearance.compactMode) {
      document.documentElement.setAttribute("data-compact-mode", "true");
    } else {
      document.documentElement.removeAttribute("data-compact-mode");
    }
  }, [appearance]);

  // Show welcome guide on first visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("rangex-welcome-seen");
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, []);

  // Restore session if tokens exist
  useEffect(() => {
    const bootstrapAuth = async () => {
      if (isAuthenticated) return;
      if (tokenStore.refresh) {
        try {
          const data = await authApi.refresh();
          setCurrentUser({
            id: data.user?.id || "me",
            username: data.user?.displayName || data.user?.email || "user",
            firstName: data.user?.displayName || "User",
            lastName: "",
            email: data.user?.email || "",
            country: "N/A",
            role: data.user?.roleAdmin
              ? "admin"
              : data.user?.roleCreator
                ? "creator"
                : "solver",
            mfaEnabled: Boolean(data.user?.twofaSecret),
            avatarUrl: data.user?.avatarUrl || "",
            pointsTotal: 0,
            badges: [],
            followedPlaylists: [],
            history: [],
          });
          setIsAuthenticated(true);
        } catch (err) {
          tokenStore.clear();
        }
      }
    };
    bootstrapAuth();
  }, [isAuthenticated, setIsAuthenticated, setCurrentUser]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("rangex-welcome-seen", "true");
  };

  // Handle scenario start
  const handleStartScenario = async (scenarioId: string) => {
    // Check if user has an active NON-EVENT session for this scenario
    if (currentUser) {
      const activeSession = currentUser.history.find(
        (h) => h.scenarioId === scenarioId && 
               h.status === "In Progress" &&
               !(h as any).eventId  // Only redirect to non-event sessions
      );
      
      if (activeSession && activeSession.sessionId) {
        // User has active non-event session - redirect to continue
        routerNavigate(`/in-challenge/${activeSession.sessionId}/${scenarioId}`);
        return;
      }
    }

    routerNavigate(`/launching/${scenarioId}`);

    // Simulate loading progress
    setLaunchProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        // Wait a bit then show ready modal
        setTimeout(() => {
          setLaunchProgress(100);
        }, 500);
      } else {
        setLaunchProgress(progress);
      }
    }, 300);
  };

  const handleViewScenario = (scenarioId: string) => {
    routerNavigate(`/challenges/${scenarioId}`);
  };

  const handleLaunchComplete = (sessionId: string, scenarioId: string) => {
    routerNavigate(`/in-challenge/${sessionId}/${scenarioId}`);
  };

  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
        {/* Login Route */}
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard
                  onStartScenario={handleStartScenario}
                  onViewScenario={handleViewScenario}
                />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Challenges */}
        <Route
          path="/challenges"
          element={
            <ProtectedRoute>
              <Layout>
                <ChallengesPage
                  onStartScenario={handleStartScenario}
                  onViewScenario={handleViewScenario}
                />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenges/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ChallengePreview
                  onStart={handleStartScenario}
                  onBack={() => routerNavigate("/challenges")}
                />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Launch & In-Challenge */}
        <Route
          path="/launching/:scenarioId"
          element={
            <ProtectedRoute>
              <Layout>
                <LaunchingPage
                  progress={launchProgress}
                  onComplete={handleLaunchComplete}
                  onCancel={() => routerNavigate("/challenges")}
                />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/in-challenge/:sessionId/:scenarioId"
          element={
            <ProtectedRoute>
              <Layout hideNavigation>
                <InChallengePage onExit={() => routerNavigate("/")} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Playlists */}
        <Route
          path="/playlists"
          element={
            <ProtectedRoute>
              <Layout>
                <PlaylistsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <Layout>
                <FavoritesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlists/new"
          element={
            <ProtectedRoute>
              <Layout>
                <CreatePlaylistPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlists/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PlaylistDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlists/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <EditPlaylistPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Career Paths */}
        <Route
          path="/career-paths"
          element={
            <ProtectedRoute>
              <Layout>
                <CareerPathsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/career-paths/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <CareerPathDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/career-paths/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <EditCareerPathPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Events & Teams */}
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <Layout>
                <EventsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/new"
          element={
            <ProtectedRoute>
              <Layout>
                <CreateEventPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <EventDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <Layout>
                <TeamsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <TeamDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:id/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <TeamSettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Leaderboard */}
        <Route
          path="/leaderboards"
          element={
            <ProtectedRoute>
              <Layout>
                <LeaderboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Account & Help */}
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Layout>
                <AccountPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Layout>
                <NotificationsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute>
              <Layout>
                <RequestsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Layout>
                <HelpPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Creator Routes */}
        <Route
          path="/creator/new"
          element={
            <ProtectedRoute>
              <ScenarioBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/scenarios"
          element={
            <ProtectedRoute>
              <Layout>
                <MyScenariosPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/scenarios/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ScenarioDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminConsolePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/approvals"
          element={
            <ProtectedRoute>
              <Layout>
                <ApprovalsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/scenarios"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminScenariosPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/deployments"
          element={
            <ProtectedRoute>
              <Layout>
                <DeploymentManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/scenario-approvals"
          element={
            <ProtectedRoute>
              <Layout>
                <ScenarioApprovalsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tools"
          element={
            <ProtectedRoute>
              <Layout>
                <ToolsLinksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/career-paths"
          element={
            <ProtectedRoute>
              <Layout>
                <CareerPathsManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/career-paths/new"
          element={
            <ProtectedRoute>
              <Layout>
                <CreateCareerPathPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/system-settings"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminSystemSettings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/costs"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminCostDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/containers"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminContainers />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/testing"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminTestingPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/badges"
          element={
            <ProtectedRoute>
              <Layout>
                <BadgeManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />



        <Route
          path="/badges/progress"
          element={
            <ProtectedRoute>
              <Layout>
                <BadgeProgressPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>

      {/* Dev Role Switcher */}

      {/* Welcome Guide */}
      <WelcomeGuide open={showWelcome} onClose={handleCloseWelcome} />

      {/* Toast notifications */}
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}
