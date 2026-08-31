import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api/services',
  withCredentials: true
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const getServices = () => API.get('/');
export const createService = (data) => API.post('/', data);
export const updateService = (id, data) => API.put(`/${id}`, data);
export const deleteService = (id) => API.delete(`/${id}`);
