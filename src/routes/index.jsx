import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Profile from '../pages/Profile';
import ProfileEdit from '../pages/ProfileEdit';
import PRs from '../pages/PRs';
import PRNew from '../pages/PRNew';
import Benchmarks from '../pages/Benchmarks';
import BenchmarkNew from '../pages/BenchmarkNew';
import BenchmarkResult from '../pages/BenchmarkResult';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';

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
          <Profile />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile/edit',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <ProfileEdit />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/prs',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <PRs />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/prs/new',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <PRNew />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <Benchmarks />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks/new',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <BenchmarkNew />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/benchmarks/new/:wodName',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <BenchmarkResult />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;
