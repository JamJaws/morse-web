import type { RouteObject } from 'react-router-dom';
import App from './App';
import NotFound from './NotFound';
import TrainingPage from './training/TrainingPage';

export const routes: RouteObject[] = [
  { path: '/', element: <App /> },
  { path: '/training', element: <TrainingPage /> },
  { path: '*', element: <NotFound /> },
];
