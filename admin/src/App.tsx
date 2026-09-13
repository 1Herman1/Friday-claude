import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { authApi } from './lib/api'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/orders/OrdersPage'
import OrderDetailPage from './pages/orders/OrderDetailPage'
import ProductsPage from './pages/products/ProductsPage'
import ProductFormPage from './pages/products/ProductFormPage'
import ImportPage from './pages/products/ImportPage'
import UsersPage from './pages/users/UsersPage'
import CategoriesPage from './pages/categories/CategoriesPage'
import BrandsPage from './pages/brands/BrandsPage'
import BannersPage from './pages/banners/BannersPage'
import DeliveryOptionsPage from './pages/delivery/DeliveryOptionsPage'
import SettingsPage from './pages/SettingsPage'
import SyncPage from './pages/SyncPage'
import BlogListPage from './pages/blog/BlogListPage'
import BlogEditPage from './pages/blog/BlogEditPage'
import SiteTextsPage from './pages/texts/SiteTextsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading')
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { setStatus('fail'); return }
    authApi.me()
      .then(res => {
        const { role } = res.data
        if (['super_admin', 'orders_manager', 'products_manager'].includes(role)) {
          setStatus('ok')
        } else {
          localStorage.removeItem('admin_token')
          setStatus('fail')
        }
      })
      .catch(() => { localStorage.removeItem('admin_token'); setStatus('fail') })
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    )
  }

  if (status === 'fail') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/*" element={
        <RequireAuth>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id" element={<ProductFormPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/sync" element={<SyncPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/brands" element={<BrandsPage />} />
              <Route path="/banners" element={<BannersPage />} />
              <Route path="/delivery-options" element={<DeliveryOptionsPage />} />
              <Route path="/blog" element={<BlogListPage />} />
              <Route path="/blog/new" element={<BlogEditPage />} />
              <Route path="/blog/:id" element={<BlogEditPage />} />
              <Route path="/texts" element={<SiteTextsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  )
}
