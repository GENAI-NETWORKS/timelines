import api from './axios';

export const getDesignOrders = (params) => api.get('/design-orders', { params });
export const getDesignOrder = (id) => api.get(`/design-orders/${id}`);
export const createDesignOrder = (data) => api.post('/design-orders', data);
export const updateDesignOrder = (id, data) => api.put(`/design-orders/${id}`, data);
export const deleteDesignOrder = (id) => api.delete(`/design-orders/${id}`);
export const assignTailor = (id, tailorId) => api.patch(`/design-orders/${id}/assign`, { tailorId });
export const updateStatus = (id, status) => api.patch(`/design-orders/${id}/status`, { status });
export const uploadSketch = (id, formData) =>
  api.post(`/design-orders/${id}/sketch`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const saveSketchJSON = (id, sketchJSON, designSketchUrl) =>
  api.patch(`/design-orders/${id}/sketch-json`, { sketchJSON, designSketchUrl });
export const getDesignOrderAudit = (id) => api.get(`/design-orders/${id}/audit`);
