import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api/inventory',
  withCredentials: true
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const getInventory = () => API.get('/');
export const createInventoryItem = (data) => API.post('/', data);
export const updateInventoryItem = (id, data) => API.put(`/${id}`, data);
export const deleteInventoryItem = (id) => API.delete(`/${id}`);
