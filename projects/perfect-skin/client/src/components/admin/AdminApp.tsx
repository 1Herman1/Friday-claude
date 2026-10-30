import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RequireRole } from '@/components/admin/RequireRole'
import { AdminLayout } from '@/components/admin/AdminLayout'

// Admin pages
const AdminDashboardPage = lazy(() => import('@/components/admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const AdminOrdersPage = lazy(() => import('@/components/admin/pages/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })))
const AdminOrderPage = lazy(() => import('@/components/admin/pages/AdminOrderPage').then((m) => ({ default: m.AdminOrderPage })))
const AdminProductsPage = lazy(() => import('@/components/admin/pages/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })))
const AdminProductEditPage = lazy(() => import('@/components/admin/pages/AdminProductEditPage').then((m) => ({ default: m.AdminProductEditPage })))
const AdminPromoPage = lazy(() => import('@/components/admin/pages/AdminPromoPage').then((m) => ({ default: m.AdminPromoPage })))
const AdminPostsPage = lazy(() => import('@/components/admin/pages/AdminPostsPage').then((m) => ({ default: m.AdminPostsPage })))
const AdminPostEditPage = lazy(() => import('@/components/admin/pages/AdminPostEditPage').then((m) => ({ default: m.AdminPostEditPage })))
const AdminVideoReviewsPage = lazy(() => import('@/components/admin/pages/AdminVideoReviewsPage').then((m) => ({ default: m.AdminVideoReviewsPage })))
const AdminVideoReviewEditPage = lazy(() => import('@/components/admin/pages/AdminVideoReviewEditPage').then((m) => ({ default: m.AdminVideoReviewEditPage })))
const AdminSyncPage = lazy(() => import('@/components/admin/pages/AdminSyncPage').then((m) => ({ default: m.AdminSyncPage })))
const AdminProRequestsPage = lazy(() => import('@/components/admin/pages/AdminProRequestsPage').then((m) => ({ default: m.AdminProRequestsPage })))
const AdminConsultationsPage = lazy(() => import('@/components/admin/pages/AdminConsultationsPage').then((m) => ({ default: m.AdminConsultationsPage })))
const AdminBonusAccountsPage = lazy(() => import('@/components/admin/pages/AdminBonusAccountsPage').then((m) => ({ default: m.AdminBonusAccountsPage })))
const AdminBonusAccountPage = lazy(() => import('@/components/admin/pages/AdminBonusAccountPage').then((m) => ({ default: m.AdminBonusAccountPage })))
const AdminBonusSettingsPage = lazy(() => import('@/components/admin/pages/AdminBonusSettingsPage').then((m) => ({ default: m.AdminBonusSettingsPage })))

import { STAFF_ROLES } from '@/context/AuthContext'

const adminRoles = STAFF_ROLES

const fallback = <div className="container-app py-24 text-muted-foreground">Загрузка…</div>

// Wrapper for admin layout with nested routes
const AdminLayoutWrapper = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      <Route index element={<Suspense fallback={fallback}><AdminDashboardPage /></Suspense>} />
      <Route path="orders" element={<Suspense fallback={fallback}><AdminOrdersPage /></Suspense>} />
      <Route path="orders/:id" element={<Suspense fallback={fallback}><AdminOrderPage /></Suspense>} />
      <Route path="products" element={<Suspense fallback={fallback}><AdminProductsPage /></Suspense>} />
      <Route path="products/new" element={<Suspense fallback={fallback}><AdminProductEditPage /></Suspense>} />
      <Route path="products/:id" element={<Suspense fallback={fallback}><AdminProductEditPage /></Suspense>} />
      <Route path="promo" element={<Suspense fallback={fallback}><AdminPromoPage /></Suspense>} />
      <Route path="bonus" element={<Suspense fallback={fallback}><AdminBonusAccountsPage /></Suspense>} />
      <Route path="bonus/settings" element={<Suspense fallback={fallback}><AdminBonusSettingsPage /></Suspense>} />
      <Route path="bonus/:userId" element={<Suspense fallback={fallback}><AdminBonusAccountPage /></Suspense>} />
      <Route path="pro-requests" element={<Suspense fallback={fallback}><AdminProRequestsPage /></Suspense>} />
      <Route path="consultations" element={<Suspense fallback={fallback}><AdminConsultationsPage /></Suspense>} />
      <Route path="posts" element={<Suspense fallback={fallback}><AdminPostsPage /></Suspense>} />
      <Route path="posts/:id" element={<Suspense fallback={fallback}><AdminPostEditPage /></Suspense>} />
      <Route path="video-reviews" element={<Suspense fallback={fallback}><AdminVideoReviewsPage /></Suspense>} />
      <Route path="video-reviews/new" element={<Suspense fallback={fallback}><AdminVideoReviewEditPage /></Suspense>} />
      <Route path="video-reviews/:id" element={<Suspense fallback={fallback}><AdminVideoReviewEditPage /></Suspense>} />
      <Route path="sync" element={<Suspense fallback={fallback}><AdminSyncPage /></Suspense>} />
    </Route>
  </Routes>
)

export function AdminApp() {
  return (
    <RequireRole roles={adminRoles}>
      <AdminLayoutWrapper />
    </RequireRole>
  )
}
