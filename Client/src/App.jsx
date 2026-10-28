import React, { useLayoutEffect } from "react";
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
import QuarterlyTracerGate from "./components/tracer/QuarterlyTracerGate";

import AdminDashboard from "./pages/admin/adminDashboard";
import AdminUsers from "./pages/admin/adminUsers";
import AdminTracer from "./pages/admin/adminTracer";
import AdminJobs from "./pages/admin/adminJobs";
import CareerOpportunityPage from "./pages/CareerOpportunityPage";
import AdminSurveys from "./pages/admin/adminSurveys";
import AdminEvents from "./pages/admin/adminEvents";
import AdminCertificates from "./pages/admin/adminCertificates";
import AdminActivityAttendance from "./pages/admin/adminActivityAttendance";
import AdminConnections from "./pages/admin/adminConnections";
import AdminAnnouncements from "./pages/admin/adminAnnouncements";
import AdminMessage from "./pages/admin/adminMessage";
import Settings from "./pages/admin/Settings";

import AlumniDashboard from "./pages/alumni/alumniDashboard";
import AlumniProfile from "./pages/alumni/alumniProfile";
import AlumniAccounts from "./pages/alumni/alumniAccounts";
import AlumniMessage from "./pages/alumni/alumniMessage";
import AlumniCareer from "./pages/alumni/alumniCareer";
import AlumniMentorship from "./pages/alumni/alumniMentorship";
import StudentEvaluation from "./pages/alumni/studentEvaluation";
import AlumniEmployment from "./pages/alumni/alumniEmployment";
import AlumniReferral from "./pages/alumni/alumniReferral";
import AlumniSuccess from "./pages/alumni/alumniSuccess";
import SuccessStoriesPage from "./pages/SuccessStoriesPage";
import AlumniEvents from "./pages/alumni/alumniEvents";
import AlumniTracer from "./pages/alumni/alumniTracer";
import AlumniRequests from "./pages/alumni/alumniRequests";
import AlumniSurveys from "./pages/alumni/alumniSurveys";
import AlumniSurveyAnswer from "./pages/alumni/alumniSurveyAnswer";
import SearchResults from "./pages/search/SearchResults";
import FeedPage from "./pages/FeedPage";

import StudentDashboard from "./pages/student/studentDashboard";
import StudentProfile from "./pages/student/studentProfile";
import StudentJourney from "./pages/student/studentJourney";
import StudentPortfolio from "./pages/student/studentPortfolio";
import StudentCareer from "./pages/student/studentCareer";
import StudentReferrals from "./pages/student/studentReferrals";
import StudentMentorship from "./pages/student/studentMentorship";
import StudentInternship from "./pages/student/studentInternship";
import StudentReadiness from "./pages/student/studentReadiness";
import StudentCompetency from "./pages/student/studentCompetency";
import StudentCertificates from "./pages/student/studentCertificate";
import StudentEvents from "./pages/student/studentEvents";
import MeetingRoom from "./pages/meetings/MeetingRoom";
import StudentRequests from "./pages/student/studentRequests";
import StudentMessage from "./pages/student/studentMessage";
import StudentAccounts from "./pages/student/studentAccounts";

import Login from "./auth/login";
import Logout from "./auth/logout";
import Signup from "./auth/signup";
import ForgetPassword from "./auth/forget-password";
import MagicLinkVerification from "./auth/magic-link-verify";
import SetupPassword from "./auth/setup-password";
import { Roles } from "./utils/roles";
import { scrollToTop } from "./lib/scroll";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 mx-auto text-brand"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-3 text-[13px] font-semibold text-zinc-700">
            Checking your session...
          </p>
        </div>
      </div>
    );
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
  const { user } = useAuth();
  return user?.role === Roles.ADMIN ? (
    <Navigate to="/admin/events" replace />
  ) : (
    <StudentEvents />
  );
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
  const { user } = useAuth();
  const isMember = [Roles.STUDENT, Roles.ALUMNI].includes(user?.role);
  return (
    <div className={isMember ? "member-workspace" : user?.role === Roles.ADMIN ? "member-workspace admin-workspace" : undefined} data-workspace-role={isMember || user?.role === Roles.ADMIN ? user.role : undefined}>
      <QuarterlyTracerGate><AppRoutes /></QuarterlyTracerGate>
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

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <ChatProvider>
          <MemberPages />
        </ChatProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
