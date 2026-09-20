import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { IconCart, IconHeart } from '@/components/icons'
import { DrawerProvider } from '@/context/DrawerContext'
import { CartProvider } from '@/context/CartContext'
import { AuthProvider } from '@/context/AuthContext'
import { FavoritesProvider } from '@/context/FavoritesContext'

const HomePage = lazy(() => import('@/components/pages/HomePage').then((m) => ({ default: m.HomePage })))
const CatalogPage = lazy(() => import('@/components/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })))
const ProductPage = lazy(() => import('@/components/pages/ProductPage').then((m) => ({ default: m.ProductPage })))
const AuthPage = lazy(() => import('@/components/pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const CheckoutPage = lazy(() => import('@/components/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrdersPage = lazy(() => import('@/components/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const OrderPage = lazy(() => import('@/components/pages/OrderPage').then((m) => ({ default: m.OrderPage })))
const TrackOrderPage = lazy(() => import('@/components/pages/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })))
const BrandsPage = lazy(() => import('@/components/pages/BrandsPage').then((m) => ({ default: m.BrandsPage })))
const AboutPage = lazy(() => import('@/components/pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const ContactsPage = lazy(() => import('@/components/pages/ContactsPage').then((m) => ({ default: m.ContactsPage })))
const OfferPage = lazy(() => import('@/components/pages/OfferPage').then((m) => ({ default: m.OfferPage })))
const NotFoundPage = lazy(() => import('@/components/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DrawerProvider>
          <CartProvider>
            <FavoritesProvider>
              <Layout cartIcon={<IconCart />} favoriteIcon={<IconHeart />}>
              <Suspense fallback={<div className="container-app py-24 text-muted-foreground">Загрузка…</div>}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/catalog" element={<CatalogPage />} />
                  <Route path="/catalog/:slug" element={<CatalogPage />} />
                  <Route path="/product/:slug" element={<ProductPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:number" element={<OrderPage />} />
                  <Route path="/track" element={<TrackOrderPage />} />
                  <Route path="/brands" element={<BrandsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contacts" element={<ContactsPage />} />
                  <Route path="/offer" element={<OfferPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </Layout>
            </FavoritesProvider>
          </CartProvider>
        </DrawerProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
