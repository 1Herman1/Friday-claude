import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { initButtonPress } from './lib/button-press'
import ScrollToTop from './components/ScrollToTop'
import HashScroll from './components/HashScroll'
import Layout from './components/layout/Layout'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { DrawerProvider } from './context/DrawerContext'
import { AuthProvider } from './context/AuthContext'
import { SiteTextsProvider } from './context/SiteTextsContext'
import { visitsApi } from './lib/api'
import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import ProfilePage from './pages/ProfilePage'
import ProductPage from './pages/ProductPage'
import AuthPage from './pages/AuthPage'
import CheckoutPage from './pages/CheckoutPage'
import BonusesPage from './pages/BonusesPage'
import DeliveryPage from './pages/DeliveryPage'
import ReturnsPage from './pages/ReturnsPage'
import FaqPage from './pages/FaqPage'
import QuestionnairePage from './pages/QuestionnairePage'
import AboutPage from './pages/AboutPage'
import TrustPage from './pages/TrustPage'
import CertificatesPage from './pages/CertificatesPage'
import ReviewsPage from './pages/ReviewsPage'
import BlogPage from './pages/BlogPage'
import BlogPostPage from './pages/BlogPostPage'
import PrivacyPage from './pages/PrivacyPage'
import OfferPage from './pages/OfferPage'
import NotFoundPage from './pages/NotFoundPage'
import DrawerRoute from './pages/DrawerRoute'

export default function App() {
  useEffect(() => {
    const disposePress = initButtonPress()
    return () => {
      disposePress()
    }
  }, [])

  useEffect(() => {
    // Пинг визитов один раз в день
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const lastVisitDay = localStorage.getItem('simba_visit_day')

      if (lastVisitDay !== today) {
        visitsApi.ping().finally(() => {
          localStorage.setItem('simba_visit_day', today)
        })
      }
    } catch {
      // Игнорируем ошибки localStorage или API
    }
  }, [])

  return (
    <SiteTextsProvider>
      <AuthProvider>
        <CartProvider>
          <FavoritesProvider>
            <DrawerProvider>
              <ScrollToTop />
              <HashScroll />
              <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/cart" element={<DrawerRoute which="cart" />} />
              <Route path="/favorites" element={<DrawerRoute which="favorites" />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bonuses" element={<BonusesPage />} />
              <Route path="/delivery" element={<DeliveryPage />} />
              <Route path="/returns" element={<ReturnsPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/questionnaire" element={<QuestionnairePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/trust" element={<TrustPage />} />
              <Route path="/certificates" element={<CertificatesPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/offer" element={<OfferPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
              </Routes>
            </DrawerProvider>
          </FavoritesProvider>
        </CartProvider>
      </AuthProvider>
    </SiteTextsProvider>
  )
}
