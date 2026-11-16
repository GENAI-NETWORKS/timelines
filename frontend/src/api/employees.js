import api from './axios';

export const getEmployees = (params) => api.get('/employees', { params });
export const getTailors = () => api.get('/employees/tailors');
export const getEmployee = (id) => api.get(`/employees/${id}`);

export const createEmployee = (data) => {
  const isFormData = data instanceof FormData;
  return api.post('/employees', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
};

export const updateEmployee = (id, data) => {
  const isFormData = data instanceof FormData;
  return api.put(`/employees/${id}`, data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
};

export const deleteEmployee = (id) => api.delete(`/employees/${id}`);
export const getEmployeeAudit = (id) => api.get(`/employees/${id}/audit`);
