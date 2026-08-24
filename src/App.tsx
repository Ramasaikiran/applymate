import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'
import Landing        from './pages/Landing'

const AuthCallback   = lazy(() => import('./pages/AuthCallback'))
const CheckInbox     = lazy(() => import('./pages/CheckInbox'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Profile        = lazy(() => import('./pages/Profile'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Onboarding     = lazy(() => import('./pages/Onboarding'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const SignIn         = lazy(() => import('./pages/SignIn'))
const SignUp         = lazy(() => import('./pages/SignUp'))
const Subscription   = lazy(() => import('./pages/Subscription'))
const About          = lazy(() => import('./pages/About'))
const Contact        = lazy(() => import('./pages/Contact'))
const Terms          = lazy(() => import('./pages/Terms'))
const Privacy        = lazy(() => import('./pages/Privacy'))
const RefundPolicy   = lazy(() => import('./pages/RefundPolicy'))
const Status          = lazy(() => import('./pages/Status'))
const AdminDashboard      = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminLogin          = lazy(() => import('./pages/admin/AdminLogin'))
const AdminUsers          = lazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail     = lazy(() => import('./pages/admin/AdminUserDetail'))
const AdminJobs           = lazy(() => import('./pages/admin/AdminJobs'))
const AdminHackathons     = lazy(() => import('./pages/admin/AdminHackathons'))
const AdminSubscriptions  = lazy(() => import('./pages/admin/AdminSubscriptions'))
const AdminAnalytics      = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminActivityLog    = lazy(() => import('./pages/admin/AdminActivityLog'))
const AdminStatus         = lazy(() => import('./pages/admin/AdminStatus'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/"                element={<Landing />} />
        <Route path="/about"           element={<About />} />
        <Route path="/contact"         element={<Contact />} />
        <Route path="/terms"           element={<Terms />} />
        <Route path="/privacy"         element={<Privacy />} />
        <Route path="/refund-policy"   element={<RefundPolicy />} />
 <Route path="/status"          element={<Status />} />
        <Route path="/sign-up"         element={<SignUp />} />
        <Route path="/sign-in"         element={<SignIn />} />
        <Route path="/check-inbox"     element={<CheckInbox />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/auth/callback"   element={<AuthCallback />} />
        <Route path="/subscription"    element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
        <Route path="/onboarding"      element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard"       element={<ProtectedRoute requireSub><Dashboard /></ProtectedRoute>} />
        <Route path="/profile"         element={<ProtectedRoute requireSub><Profile /></ProtectedRoute>} />
        <Route path="/admin/login"     element={<AdminLogin />} />
        <Route path="/admin"           element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/users"     element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/users/:id" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
        <Route path="/admin/jobs"      element={<AdminRoute><AdminJobs /></AdminRoute>} />
        <Route path="/admin/hackathons" element={<AdminRoute><AdminHackathons /></AdminRoute>} />
        <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
        <Route path="/admin/analytics"     element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/activity"      element={<AdminRoute><AdminActivityLog /></AdminRoute>} />
 <Route path="/admin/status"        element={<AdminRoute><AdminStatus /></AdminRoute>} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
