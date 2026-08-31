import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api/payments',
  withCredentials: true
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const getPayments = (params) => API.get('/', { params });
export const createPayment = (data) => API.post('/', data);
export const updatePayment = (id, data) => API.put(`/${id}`, data);
export const deletePayment = (id) => API.delete(`/${id}`);
