import api from './axios';

export const getPanelUsers = () => api.get('/panel-users');
export const getAssignableUsers = () => api.get('/panel-users/assignable');
export const createPanelUser = (data) => api.post('/panel-users', data);
export const updatePanelUser = (id, data) => api.put(`/panel-users/${id}`, data);
export const updatePanelUserPermissions = (id, permissions) => api.patch(`/panel-users/${id}/permissions`, { permissions });
export const deletePanelUser = (id) => api.delete(`/panel-users/${id}`);
