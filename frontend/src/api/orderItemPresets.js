import api from './axios';

export const getOrderItemPresets = () =>
  api.get('/order-item-presets');

export const createOrderItemPreset = (data) =>
  api.post('/order-item-presets', data);

export const updateOrderItemPreset = (id, data) =>
  api.put(`/order-item-presets/${id}`, data);

export const deleteOrderItemPreset = (id) =>
  api.delete(`/order-item-presets/${id}`);
