import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RequireAuth from './auth/RequireAuth';
import DashboardPage from './pages/DashBoardPage.jsx';
import Layout from './layout/Layout.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />


        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout>
                <Route path='/'element={<DashboardPage />} />
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
