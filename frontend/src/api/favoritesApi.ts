import { httpClient } from './httpClient';

export const favoritesApi = {
  addFavorite: async (scenarioId: string) => {
    const response = await httpClient.post(`/favorites/${scenarioId}`);
    return response.data;
  },

  removeFavorite: async (scenarioId: string) => {
    const response = await httpClient.delete(`/favorites/${scenarioId}`);
    return response.data;
  },

  listFavorites: async () => {
    const response = await httpClient.get('/favorites');
    return response.data;
  },

  checkFavorite: async (scenarioId: string) => {
    const response = await httpClient.get(`/favorites/check/${scenarioId}`);
    return response.data;
  },
};

export const ratingsApi = {
  submitRating: async (scenarioId: string, rating: number) => {
    const response = await httpClient.post(`/ratings/${scenarioId}`, { rating });
    return response.data;
  },

  getScenarioRating: async (scenarioId: string) => {
    const response = await httpClient.get(`/ratings/scenario/${scenarioId}`);
    return response.data;
  },

  getUserRating: async (scenarioId: string) => {
    const response = await httpClient.get(`/ratings/user/${scenarioId}`);
    return response.data;
  },
};
