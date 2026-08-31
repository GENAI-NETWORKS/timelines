import api from './axios';

export const getEmployees = (params) => api.get('/employees', { params });
export const getTailors = () => api.get('/employees/tailors');
export const getEmployee = (id) => api.get(`/employees/${id}`);
export const createEmployee = (data) => api.post('/employees', data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`);
export const getEmployeeAudit = (id) => api.get(`/employees/${id}/audit`);
