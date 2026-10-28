import api from './axios';

export const getBillingProducts = (params) => api.get('/billing-products', { params });
export const getProductByBarcode = (barcode) => api.get(`/billing-products/barcode/${barcode}`);
export const createBillingProduct = (data) => api.post('/billing-products', data);
export const updateBillingProduct = (id, data) => api.put(`/billing-products/${id}`, data);
export const deleteBillingProduct = (id) => api.delete(`/billing-products/${id}`);
