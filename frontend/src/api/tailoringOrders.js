import api from './axios';

const parseItem = (item) => {
  if (!item) return item;
  if (typeof item.details === 'string') {
    try { item.details = JSON.parse(item.details); } catch(e) {}
  }
  if (typeof item.subItems === 'string') {
    try { item.subItems = JSON.parse(item.subItems); } catch(e) {}
  }
  item.details = item.details || {};
  item.subItems = item.subItems || [];
  return item;
};

const parseRes = (res) => {
  if (!res.data) return res;
  if (res.data.items) {
    res.data.items = res.data.items.map(parseItem);
  } else if (typeof res.data.subItems !== 'undefined' || typeof res.data.details !== 'undefined') {
    res.data = parseItem(res.data);
  }
  return res;
};

export const getTailoringOrders = (params) => api.get('/tailoring-orders', { params });
export const getTailoringOrder  = (id)     => api.get(`/tailoring-orders/${id}`).then(parseRes);
export const createTailoringOrder = (data) => api.post('/tailoring-orders', data).then(parseRes);
export const updateTailoringOrder = (id, data) => api.put(`/tailoring-orders/${id}`, data).then(parseRes);
export const submitTailoringOrder = (id)   => api.patch(`/tailoring-orders/${id}/submit`);
export const deleteTailoringOrder = (id)   => api.delete(`/tailoring-orders/${id}`);

export const addOrderItem    = (orderId, data) => api.post(`/tailoring-orders/${orderId}/items`, data).then(parseRes);
export const updateOrderItem = (orderId, itemId, data) => api.put(`/tailoring-orders/${orderId}/items/${itemId}`, data).then(parseRes);
export const deleteOrderItem = (orderId, itemId) => api.delete(`/tailoring-orders/${orderId}/items/${itemId}`);

export const uploadItemImage = (orderId, itemId, formData) =>
  api.post(`/tailoring-orders/${orderId}/items/${itemId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(parseRes);

export const saveItemCanvas  = (orderId, itemId, formData) =>
  api.post(`/tailoring-orders/${orderId}/items/${itemId}/canvas`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(parseRes);
