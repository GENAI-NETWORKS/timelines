import api from './axios';

export const getDesignLibrary = (itemType) => {
  return api.get(`/design-library/${itemType}`);
};

export const uploadDesignLibraryImage = (itemType, section, formData) => {
  return api.post(`/design-library/${itemType}/${section}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteDesignLibraryImage = (itemType, section, id) => {
  return api.delete(`/design-library/${itemType}/${section}/${id}`);
};
