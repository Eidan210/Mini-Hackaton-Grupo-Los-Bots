import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './api.js';

// Carga un GET y expone estado de carga/error y recarga manual
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const res = await apiFetch(path);
      if (n === seq.current) { setData(res); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
