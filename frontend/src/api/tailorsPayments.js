import api from './axios';

export const getTailorsPayments = (params) =>
  api.get('/tailors-payments', { params });

export const getTailorsPayment = (id) =>
  api.get(`/tailors-payments/${id}`);

export const createTailorsPayment = (formData) =>
  api.post('/tailors-payments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateTailorsPayment = (id, formData) =>
  api.put(`/tailors-payments/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deleteTailorsPayment = (id) =>
  api.delete(`/tailors-payments/${id}`);
