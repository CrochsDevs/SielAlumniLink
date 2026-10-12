import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3002/api",
  withCredentials: true,
  timeout: 30000,
});

export default api;
