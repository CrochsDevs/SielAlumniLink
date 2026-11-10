import React, { lazy, Suspense, useLayoutEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { useAuth } from "./context/useAuth";
import GraduationCapLoader from "./components/ui/GraduationCapLoader";
import { PageSkeleton } from "./components/ui/Skeleton";
import QuarterlyTracerGate from "./components/tracer/QuarterlyTracerGate";

const AdminDashboard = lazy(() => import("./pages/admin/adminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/adminUsers"));
const AdminAuditLogs = lazy(() => import("./pages/admin/adminAuditLogs"));
const AdminTracer = lazy(() => import("./pages/admin/adminTracer"));
const AdminJobs = lazy(() => import("./pages/admin/adminJobs"));
const CareerOpportunityPage = lazy(() => import("./pages/CareerOpportunityPage"));
const AdminSurveys = lazy(() => import("./pages/admin/adminSurveys"));
const AdminEvents = lazy(() => import("./pages/admin/adminEvents"));
const AdminCertificates = lazy(() => import("./pages/admin/adminCertificates"));
const AdminActivityAttendance = lazy(() => import("./pages/admin/adminActivityAttendance"));
const AdminConnections = lazy(() => import("./pages/admin/adminConnections"));
const AdminAnnouncements = lazy(() => import("./pages/admin/adminAnnouncements"));
const AdminMessage = lazy(() => import("./pages/admin/adminMessage"));
const Settings = lazy(() => import("./pages/admin/Settings"));

const AlumniDashboard = lazy(() => import("./pages/alumni/alumniDashboard"));
const AlumniProfile = lazy(() => import("./pages/alumni/alumniProfile"));
const AlumniAccounts = lazy(() => import("./pages/alumni/alumniAccounts"));
const AlumniMessage = lazy(() => import("./pages/alumni/alumniMessage"));
const AlumniCareer = lazy(() => import("./pages/alumni/alumniCareer"));
const AlumniMentorship = lazy(() => import("./pages/alumni/alumniMentorship"));
const StudentEvaluation = lazy(() => import("./pages/alumni/studentEvaluation"));
const AlumniEmployment = lazy(() => import("./pages/alumni/alumniEmployment"));
const AlumniReferral = lazy(() => import("./pages/alumni/alumniReferral"));
const AlumniSuccess = lazy(() => import("./pages/alumni/alumniSuccess"));
const SuccessStoriesPage = lazy(() => import("./pages/SuccessStoriesPage"));
const AlumniEvents = lazy(() => import("./pages/alumni/alumniEvents"));
const AlumniTracer = lazy(() => import("./pages/alumni/alumniTracer"));
const AlumniRequests = lazy(() => import("./pages/alumni/alumniRequests"));
const AlumniSurveys = lazy(() => import("./pages/alumni/alumniSurveys"));
const AlumniSurveyAnswer = lazy(() => import("./pages/alumni/alumniSurveyAnswer"));
const SearchResults = lazy(() => import("./pages/search/SearchResults"));
const FeedPage = lazy(() => import("./pages/FeedPage"));

const StudentDashboard = lazy(() => import("./pages/student/studentDashboard"));
const StudentProfile = lazy(() => import("./pages/student/studentProfile"));
const StudentJourney = lazy(() => import("./pages/student/studentJourney"));
const StudentPortfolio = lazy(() => import("./pages/student/studentPortfolio"));
const StudentCareer = lazy(() => import("./pages/student/studentCareer"));
const StudentReferrals = lazy(() => import("./pages/student/studentReferrals"));
const StudentMentorship = lazy(() => import("./pages/student/studentMentorship"));
const StudentInternship = lazy(() => import("./pages/student/studentInternship"));
const StudentReadiness = lazy(() => import("./pages/student/studentReadiness"));
const StudentCompetency = lazy(() => import("./pages/student/studentCompetency"));
const StudentCertificates = lazy(() => import("./pages/student/studentCertificate"));
const StudentEvents = lazy(() => import("./pages/student/studentEvents"));
const MeetingRoom = lazy(() => import("./pages/meetings/MeetingRoom"));
const StudentRequests = lazy(() => import("./pages/student/studentRequests"));
const StudentMessage = lazy(() => import("./pages/student/studentMessage"));
const StudentAccounts = lazy(() => import("./pages/student/studentAccounts"));

const Login = lazy(() => import("./auth/login"));
const Logout = lazy(() => import("./auth/logout"));
const Signup = lazy(() => import("./auth/signup"));
const ForgetPassword = lazy(() => import("./auth/forget-password"));
const MagicLinkVerification = lazy(() => import("./auth/magic-link-verify"));
const SetupPassword = lazy(() => import("./auth/setup-password"));
import { Roles } from "./utils/roles";
import { scrollToTop } from "./lib/scroll";
import { setWorkspaceThemeEnabled } from "./lib/theme";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <PageSkeleton label="Checking your session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.passwordSetupRequired) {
    return <Navigate to="/setup-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const RoleIndex = () => {
  const { user } = useAuth();

  if (user?.role === Roles.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === Roles.STUDENT) {
    return <Navigate to="/student" replace />;
  }

  return <Navigate to="/alumni" replace />;
};

const InboxRedirect = () => {
  const { user } = useAuth();

  if (user?.role === Roles.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === Roles.STUDENT) {
    return <Navigate to="/student" replace />;
  }

  return <Navigate to="/alumni/message" replace />;
};

const ActivitiesIndex = () => {
  return <StudentEvents />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleIndex />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route
        path="/logout"
        element={
          <ProtectedRoute>
            <Logout />
          </ProtectedRoute>
        }
      />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgetPassword />} />
      <Route path="/verify-magic-link" element={<MagicLinkVerification />} />
      <Route path="/setup-password" element={<SetupPassword />} />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <RoleIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute allowedRoles={[Roles.ADMIN]}><AdminAuditLogs /></ProtectedRoute>
      } />
      <Route
        path="/admin/tracer"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminTracer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/employment"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <Navigate to="/admin/tracer?view=employment" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/employment"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniEmployment />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/jobs/:jobId" element={<ProtectedRoute allowedRoles={[Roles.ADMIN]}><CareerOpportunityPage /></ProtectedRoute>} />
      <Route path="/alumni/career/:jobId" element={<ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}><CareerOpportunityPage /></ProtectedRoute>} />
      <Route path="/student/career/:jobId" element={<ProtectedRoute allowedRoles={[Roles.STUDENT]}><CareerOpportunityPage /></ProtectedRoute>} />
      <Route
        path="/admin/jobs"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminJobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/surveys"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminSurveys />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/certificates"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminCertificates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events/:eventId/attendance"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminActivityAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities"
        element={
          <ProtectedRoute>
            <ActivitiesIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings/:eventId"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.ADMIN, Roles.STUDENT, Roles.ALUMNI]}
          >
            <MeetingRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/events"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ALUMNI]}>
            <StudentEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/connections"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminConnections />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/announcements"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminAnnouncements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/message"
        element={
          <ProtectedRoute allowedRoles={[Roles.ADMIN]}>
            <AdminMessage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/profile"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniProfile />
          </ProtectedRoute>
        }
      />
      <Route path="/alumni/activity-logs" element={
        <ProtectedRoute allowedRoles={[Roles.ALUMNI]}><Navigate to="/alumni/accounts?tab=activity" replace /></ProtectedRoute>
      } />
      <Route
        path="/alumni/profile/:id"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.ALUMNI, Roles.ADMIN, Roles.STUDENT]}
          >
            <AlumniProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/accounts"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniAccounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/message"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniMessage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/mentorship"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI]}>
            <AlumniMentorship />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/mentorship/:studentId/evaluation"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI]}>
            <StudentEvaluation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/career"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniCareer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/referral"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniReferral />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/success"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniSuccess />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/success"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT]}>
            <SuccessStoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stories"
        element={
          <ProtectedRoute>
            <SuccessStoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/events"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/tracer"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.ALUMNI, Roles.ADMIN, Roles.STUDENT]}
          >
            <AlumniTracer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/requests"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <AlumniRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/surveys"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.ALUMNI, Roles.ADMIN, Roles.STUDENT]}
          >
            <AlumniSurveys />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/surveys/:id"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.ALUMNI, Roles.ADMIN, Roles.STUDENT]}
          >
            <AlumniSurveyAnswer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentProfile />
          </ProtectedRoute>
        }
      />
      <Route path="/student/activity-logs" element={
        <ProtectedRoute allowedRoles={[Roles.STUDENT]}><Navigate to="/student/accounts?tab=activity" replace /></ProtectedRoute>
      } />
      <Route
        path="/student/profile/:id"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN]}
          >
            <StudentProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/journey"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT]}
          >
            <StudentJourney />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/portfolio"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN]}
          >
            <StudentPortfolio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/career"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentCareer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/referrals"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentReferrals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/mentorship"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentMentorship />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/internship"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN]}
          >
            <StudentInternship />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/competency"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN]}
          >
            <StudentCompetency />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/readiness"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN]}
          >
            <StudentReadiness />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/certificate"
        element={
          <ProtectedRoute
            allowedRoles={[Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN]}
          >
            <StudentCertificates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/journey"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <Navigate to="/alumni" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alumni/readiness"
        element={
          <ProtectedRoute allowedRoles={[Roles.ALUMNI, Roles.ADMIN]}>
            <StudentReadiness />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/requests"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/message"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentMessage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/accounts"
        element={
          <ProtectedRoute allowedRoles={[Roles.STUDENT, Roles.ADMIN]}>
            <StudentAccounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <InboxRedirect />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function MemberPages() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const isAuthPage = ["/login", "/logout", "/signup", "/forgot-password", "/verify-magic-link", "/setup-password"]
    .includes(pathname.replace(/\/+$/, ""));
  const workspaceTheme = !!user && !user.passwordSetupRequired && !isAuthPage;
  useLayoutEffect(() => {
    setWorkspaceThemeEnabled(workspaceTheme);
  }, [workspaceTheme]);
  if (loading && !isAuthPage) {
    return <PageSkeleton label="Checking your session" />;
  }
  const isMember = [Roles.STUDENT, Roles.ALUMNI].includes(user?.role);
  return (
    <div className={isMember ? "member-workspace" : user?.role === Roles.ADMIN ? "member-workspace admin-workspace" : undefined} data-workspace-role={isMember || user?.role === Roles.ADMIN ? user.role : undefined}>
      <QuarterlyTracerGate><Suspense fallback={<PageSkeleton label="Loading page" />}><AppRoutes /></Suspense></QuarterlyTracerGate>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, search, key } = useLocation();
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    scrollToTop();
  }, [pathname, search, key]);
  return null;
}

function SignInLoading() {
  const { signingIn } = useAuth();
  return signingIn ? <GraduationCapLoader label="Signing you in" /> : null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <SignInLoading />
        <ChatProvider>
          <MemberPages />
        </ChatProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
