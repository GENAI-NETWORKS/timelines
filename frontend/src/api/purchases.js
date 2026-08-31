import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api/purchases',
  withCredentials: true
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const getPurchases = () => API.get('/');
export const createPurchase = (data) => API.post('/', data);
export const updatePurchase = (id, data) => API.put(`/${id}`, data);
export const deletePurchase = (id) => API.delete(`/${id}`);
