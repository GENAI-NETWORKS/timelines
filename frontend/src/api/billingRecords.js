import api from './axios';

export const getBillingRecords = (params) =>
  api.get('/billing-records', { params });

export const saveBillingRecord = (data) =>
  api.post('/billing-records', data);

export const updateBillingRecordPayment = (id, paymentMode) =>
  api.patch(`/billing-records/${id}`, { paymentMode });

export const uploadBillingRecordPhoto = (id, file) => {
  const fd = new FormData();
  fd.append('photo', file);
  return api.patch(`/billing-records/${id}/photo`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteBillingRecord = (id) =>
  api.delete(`/billing-records/${id}`);

