import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Spaces from './pages/Spaces.jsx';
import Equipment from './pages/Equipment.jsx';
import Incidents from './pages/Incidents.jsx';
import ImportData from './pages/ImportData.jsx';
import Rules from './pages/Rules.jsx';
import Users from './pages/Users.jsx';

// Guard de sesión: sin token, todo redirige a /login
function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

// Guard de permiso en cliente (el backend sigue siendo quien decide): sin permiso vuelve al panel
function RequirePerm({ perm, children }) {
  const { can } = useAuth();
  return can(perm) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/registro" element={token ? <Navigate to="/" replace /> : <Register />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="espacios" element={<Spaces />} />
        <Route path="equipos" element={<Equipment />} />
        <Route path="incidencias" element={<Incidents />} />
        <Route path="datos" element={<RequirePerm perm="ver_datos_importados"><ImportData /></RequirePerm>} />
        <Route path="reglas" element={<RequirePerm perm="ver_reglas"><Rules /></RequirePerm>} />
        <Route path="usuarios" element={<RequirePerm perm="gestionar_usuarios"><Users /></RequirePerm>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
