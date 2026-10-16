import { useMemo, useState } from 'react';
import { Users as UsersIcon } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { fieldClass, Input, PageHeader } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDateTime, label } from '../util.js';

// Catálogo de roles de la API (docs/API.md); las etiquetas de la lista se completan con `roleLabel` del servidor
const ROLES = [
  ['admin', 'Administrador'],
  ['coordinador', 'Coordinador académico'],
  ['tecnico', 'Técnico de soporte'],
  ['trainer', 'Trainer'],
  ['camper', 'Camper'],
];

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad('/users');
  const [savingId, setSavingId] = useState(null);
  const [query, setQuery] = useState('');

  const roleOptions = useMemo(() => {
    const map = new Map(ROLES);
    (data || []).forEach((u) => { if (!map.has(u.role)) map.set(u.role, u.roleLabel || label(u.role)); });
    return [...map.entries()];
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data || [];
    return (data || []).filter((u) => `${u.name} ${u.email} ${u.roleLabel}`.toLowerCase().includes(q));
  }, [data, query]);

  async function changeRole(u, role) {
    if (role === u.role) return;
    setSavingId(u.id);
    try {
      await apiFetch(`/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', body: { role } });
      toast(`Rol de ${u.name} actualizado`);
      await reload();
    } catch (err) {
      toast(err.message, 'error');
      await reload(); // restaura el valor real en el select
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Consulta las cuentas registradas y asigna el rol de cada persona. Tu propio rol no se puede cambiar." />

      {loading && !data && <Spinner label="Cargando usuarios…" />}
      {error && (
        <Alert className="mb-4" title="No se pudieron cargar los usuarios">
          {error.message} <Button size="sm" className="ml-2" onClick={reload}>Reintentar</Button>
        </Alert>
      )}

      {data && (
        <Card>
          <div className="mb-4 max-w-sm">
            <Input
              label="Buscar usuario"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, correo o rol"
            />
          </div>
          {!rows.length ? (
            <EmptyState icon={UsersIcon} title={data.length ? 'Ningún usuario coincide con la búsqueda' : 'Aún no hay usuarios'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Usuarios registrados y su rol</caption>
                <thead className="text-xs text-mute">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Nombre</th>
                    <th scope="col" className="px-3 py-2 font-medium">Correo</th>
                    <th scope="col" className="px-3 py-2 font-medium">Alta</th>
                    <th scope="col" className="px-3 py-2 font-medium">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const isMe = u.id === me?.id;
                    return (
                      <tr key={u.id} className="border-t border-line align-middle">
                        <td className="px-3 py-2.5 font-medium">
                          {u.name}
                          {isMe && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-soft">Tú</span>}
                        </td>
                        <td className="px-3 py-2.5 text-mute">{u.email}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-mute">{formatDateTime(u.created_at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Rol de ${u.name}`}
                              value={u.role}
                              disabled={isMe || savingId !== null}
                              title={isMe ? 'No puedes cambiar tu propio rol' : undefined}
                              onChange={(e) => changeRole(u, e.target.value)}
                              className={`${fieldClass} w-auto min-w-[12rem]`}
                            >
                              {roleOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                            </select>
                            {savingId === u.id && <Spinner label="Guardando…" className="py-0" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
