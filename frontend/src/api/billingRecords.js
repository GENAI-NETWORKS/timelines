import api from './axios';

export const getBillingRecords = (params) =>
  api.get('/billing-records', { params });

export const getBillingRecordById = (id) =>
  api.get(`/billing-records/${id}`);

export const getBillingRecordByBillNo = (billNo) =>
  api.get(`/billing-records/by-no/${encodeURIComponent(billNo)}`);

export const saveBillingRecord = (data) =>
  api.post('/billing-records', data);

export const updateBillingRecord = (id, data) =>
  api.put(`/billing-records/${id}`, data);

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

export const getBillHistory = (params) =>
  api.get('/billing-records/history', { params });
