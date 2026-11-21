import api from './axios';

export const getTailorStaff        = (params) => api.get('/tailor-staff', { params });
export const getTailorStaffMember  = (id)     => api.get(`/tailor-staff/${id}`);
export const createTailorStaff     = (data)   => api.post('/tailor-staff', data);
export const updateTailorStaff     = (id, data) => api.put(`/tailor-staff/${id}`, data);
export const deleteTailorStaff     = (id)     => api.delete(`/tailor-staff/${id}`);

// Work entries
export const getWorkEntries   = (staffId, params) => api.get(`/tailor-staff/${staffId}/entries`, { params });
export const createWorkEntry  = (staffId, data)   => api.post(`/tailor-staff/${staffId}/entries`, data);
export const updateWorkEntry  = (staffId, entryId, data) => api.put(`/tailor-staff/${staffId}/entries/${entryId}`, data);
export const deleteWorkEntry  = (staffId, entryId) => api.delete(`/tailor-staff/${staffId}/entries/${entryId}`);

// Payment history
export const getPaymentHistory  = (staffId) => api.get(`/tailor-staff/${staffId}/payment-history`);
export const savePaymentHistory = (staffId, data) => api.post(`/tailor-staff/${staffId}/payment-history`, data);
