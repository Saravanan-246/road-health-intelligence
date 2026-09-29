/** Backend endpoint paths. Must match backend/ routes (team/contracts/api.contract.md). */
export const ENDPOINTS = {
  health: '/health',
  login: '/auth/login',
  observations: '/observations',
  myObservations: '/observations/my',
  observation: (id: string) => `/observations/${encodeURIComponent(id)}`,
  defects: '/defects',
  defect: (id: string) => `/defects/${encodeURIComponent(id)}`,
  defectsNearby: '/defects/nearby',
  defectStatus: (id: string) => `/defects/${encodeURIComponent(id)}/status`,
  adminDashboard: '/admin/dashboard',
} as const;
