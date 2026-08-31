import api from './axios';

export const getGarmentTemplates = () => api.get('/garment-templates');
export const getGarmentTemplate = (id) => api.get(`/garment-templates/${id}`);
export const getGarmentTemplateByType = (type) => api.get(`/garment-templates/type/${encodeURIComponent(type)}`);
export const createGarmentTemplate = (data) => api.post('/garment-templates', data);
export const updateGarmentTemplate = (id, data) => api.put(`/garment-templates/${id}`, data);
export const deleteGarmentTemplate = (id) => api.delete(`/garment-templates/${id}`);
