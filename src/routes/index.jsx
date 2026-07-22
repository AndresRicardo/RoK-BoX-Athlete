import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import MainLayout from '../layouts/MainLayout';
import PageLoader from '../components/PageLoader';
import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';

// eslint-disable-next-line react-refresh/only-export-components
const Profile = lazy(() => import('../pages/Profile'));
// eslint-disable-next-line react-refresh/only-export-components
const ProfileEdit = lazy(() => import('../pages/ProfileEdit'));
// eslint-disable-next-line react-refresh/only-export-components
const PRs = lazy(() => import('../pages/PRs'));
// eslint-disable-next-line react-refresh/only-export-components
const PRNew = lazy(() => import('../pages/PRNew'));
// eslint-disable-next-line react-refresh/only-export-components
const Benchmarks = lazy(() => import('../pages/Benchmarks'));
// eslint-disable-next-line react-refresh/only-export-components
const BenchmarkNew = lazy(() => import('../pages/BenchmarkNew'));
// eslint-disable-next-line react-refresh/only-export-components
const BenchmarkResult = lazy(() => import('../pages/BenchmarkResult'));
// eslint-disable-next-line react-refresh/only-export-components
const Achievements = lazy(() => import('../pages/Achievements'));
// eslint-disable-next-line react-refresh/only-export-components
const Skills = lazy(() => import('../pages/Skills'));
// eslint-disable-next-line react-refresh/only-export-components
const History = lazy(() => import('../pages/History'));
// eslint-disable-next-line react-refresh/only-export-components
const Community = lazy(() => import('../pages/Community'));
// eslint-disable-next-line react-refresh/only-export-components
const AthleteProfile = lazy(() => import('../pages/AthleteProfile'));

// eslint-disable-next-line react-refresh/only-export-components
function LazyPage({ component: Component }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <Dashboard />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={Profile} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile/edit',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={ProfileEdit} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/prs',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={PRs} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/prs/new',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={PRNew} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/prs/:id/edit',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={PRNew} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={Benchmarks} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks/new',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={BenchmarkNew} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks/new/:wodName',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={BenchmarkResult} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks/:id/edit',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={BenchmarkNew} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/achievements',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={Achievements} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/skills',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={Skills} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/history',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={History} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/community',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={Community} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/athletes/:id',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage component={AthleteProfile} />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <Navigate to="/community" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/community" replace />,
  },
]);

export default router;
