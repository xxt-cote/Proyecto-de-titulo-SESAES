declare const NG_APP_API_URL: string | undefined;

export const environment = {
  apiUrl: typeof NG_APP_API_URL === 'string' ? NG_APP_API_URL : 'http://localhost:8080'
};
