import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Spaces from './pages/Spaces.jsx';
import Equipment from './pages/Equipment.jsx';
import Incidents from './pages/Incidents.jsx';
import ImportData from './pages/ImportData.jsx';
import Rules from './pages/Rules.jsx';

// Guard de sesión: sin token, todo redirige a /login
function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="espacios" element={<Spaces />} />
        <Route path="equipos" element={<Equipment />} />
        <Route path="incidencias" element={<Incidents />} />
        <Route path="datos" element={<ImportData />} />
        <Route path="reglas" element={<Rules />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
