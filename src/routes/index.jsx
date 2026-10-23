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
import StaffRoute from '../components/StaffRoute';
import ManageHome from '../pages/manage/ManageHome';
import Members from '../pages/manage/Members';
import MemberDetail from '../pages/manage/MemberDetail';
import Debts from '../pages/manage/Debts';
import Pending from '../pages/manage/Pending';
import Cash from '../pages/manage/Cash';
import Settlements from '../pages/manage/Settlements';
import Settings from '../pages/manage/Settings';

const staff = (element) => <StaffRoute>{element}</StaffRoute>;
const partnerOnly = (element) => <StaffRoute partnerOnly>{element}</StaffRoute>;

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
      { path: 'staff', element: <Navigate to="/manage" replace /> },
      // Enlaces que guardan los avisos del servidor (0020_notifications).
      { path: 'gestion', element: <Navigate to="/manage" replace /> },
      { path: 'gestion/pendientes', element: <Navigate to="/manage/pending" replace /> },
      { path: 'gestion/ajustes', element: <Navigate to="/manage/settings/bridge" replace /> },
      { path: 'manage', element: staff(<ManageHome />) },
      { path: 'manage/members', element: staff(<Members />) },
      { path: 'manage/members/:id', element: staff(<MemberDetail />) },
      { path: 'manage/debts', element: staff(<Debts />) },
      { path: 'manage/pending', element: staff(<Pending />) },
      { path: 'manage/cash', element: partnerOnly(<Cash />) },
      { path: 'manage/settlements', element: partnerOnly(<Settlements />) },
      { path: 'manage/settings', element: partnerOnly(<Settings />) },
      { path: 'manage/settings/:section', element: partnerOnly(<Settings />) },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
