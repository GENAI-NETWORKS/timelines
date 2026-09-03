import api from './axios';

export const getTailoringOrders = (params) => api.get('/tailoring-orders', { params });
export const getTailoringOrder  = (id)     => api.get(`/tailoring-orders/${id}`);
export const createTailoringOrder = (data) => api.post('/tailoring-orders', data);
export const updateTailoringOrder = (id, data) => api.put(`/tailoring-orders/${id}`, data);
export const submitTailoringOrder = (id)   => api.patch(`/tailoring-orders/${id}/submit`);
export const deleteTailoringOrder = (id)   => api.delete(`/tailoring-orders/${id}`);

export const addOrderItem    = (orderId, data) => api.post(`/tailoring-orders/${orderId}/items`, data);
export const updateOrderItem = (orderId, itemId, data) => api.put(`/tailoring-orders/${orderId}/items/${itemId}`, data);
export const deleteOrderItem = (orderId, itemId) => api.delete(`/tailoring-orders/${orderId}/items/${itemId}`);

export const uploadItemImage = (orderId, itemId, formData) =>
  api.post(`/tailoring-orders/${orderId}/items/${itemId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const saveItemCanvas  = (orderId, itemId, formData) =>
  api.post(`/tailoring-orders/${orderId}/items/${itemId}/canvas`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
