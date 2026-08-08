import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const DISTRIBUTIONS_NEW_PATH = '/warehouse/kkd/distributions/new';

/** Eski rota — birleşik sayfaya yönlendirir; query (employeeId, orders, requestId, …) korunur. */
export function KkdMaterialRequestsPage(): ReactElement {
  const { search } = useLocation();
  return <Navigate to={`${DISTRIBUTIONS_NEW_PATH}${search}`} replace />;
}
