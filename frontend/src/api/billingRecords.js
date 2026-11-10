import api from './axios';

export const getBillingRecords = (params) =>
  api.get('/billing-records', { params });

export const saveBillingRecord = (data) =>
  api.post('/billing-records', data);

export const deleteBillingRecord = (id) =>
  api.delete(`/billing-records/${id}`);

