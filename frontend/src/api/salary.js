import api from './axios';

export const getSalaries = (params) => api.get('/salary', { params });
export const getSalaryByEmployee = (employeeId, params) => api.get(`/salary/employee/${employeeId}`, { params });
export const getSalary = (id) => api.get(`/salary/${id}`);
export const createSalary = (data) => api.post('/salary', data);
export const updateSalary = (id, data) => api.put(`/salary/${id}`, data);
export const markPaid = (id, data) => api.patch(`/salary/${id}/mark-paid`, data);
export const deleteSalary = (id) => api.delete(`/salary/${id}`);
export const getSalaryAudit = (id) => api.get(`/salary/${id}/audit`);
