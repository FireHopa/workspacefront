import axios from 'axios';

// Agora o React puxa a URL do servidor de forma segura através de variáveis de ambiente.
// Quando você for colocar o sistema no ar (ex: na Vercel), você só altera essa variável lá no painel deles!
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
});