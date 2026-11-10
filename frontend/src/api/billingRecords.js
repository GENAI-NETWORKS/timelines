import api from './axios';

export const getBillingRecords = (params) =>
  api.get('/billing-records', { params });

export const saveBillingRecord = (data) =>
  api.post('/billing-records', data);

export const updateBillingRecordPayment = (id, paymentMode) =>
  api.patch(`/billing-records/${id}`, { paymentMode });

export const deleteBillingRecord = (id) =>
  api.delete(`/billing-records/${id}`);

