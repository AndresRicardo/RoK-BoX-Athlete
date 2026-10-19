import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';
import MobileLayout from '../layouts/MobileLayout';

import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Training from '../pages/Training';
import Community from '../pages/Community';
import Achievements from '../pages/Achievements';
import Profile from '../pages/Profile';
import AthleteProfile from '../pages/AthleteProfile';
import StaffPanel from '../pages/StaffPanel';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MobileLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'dashboard',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'training',
        element: <Training />,
      },
      {
        path: 'prs',
        element: <Navigate to="/training?tab=prs" replace />,
      },
      {
        path: 'benchmarks',
        element: <Navigate to="/training?tab=benchmarks" replace />,
      },
      {
        path: 'skills',
        element: <Navigate to="/training?tab=skills" replace />,
      },
      {
        path: 'history',
        element: <Navigate to="/training?tab=history" replace />,
      },
      {
        path: 'community',
        element: <Community />,
      },
      {
        path: 'achievements',
        element: <Achievements />,
      },
      {
        path: 'profile',
        element: <Profile />,
      },
      {
        path: 'athletes/:id',
        element: <AthleteProfile />,
      },
      {
        path: 'staff',
        element: <StaffPanel />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
