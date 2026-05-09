import { authFetch } from '../../../shared/services/apiClient';

export const getProfile = () => authFetch('/user/profile');

export const updateProfile = (data) =>
  authFetch('/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
