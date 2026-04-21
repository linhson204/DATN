import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { RefreshResponse } from "../types/api";
import { authStorage } from "../utils/storage";

export const beBaseUrl =
  import.meta.env.VITE_BE_BASE_URL?.trim() || "http://localhost:8081";

export const recBaseUrl =
  import.meta.env.VITE_REC_BASE_URL?.trim() || "http://localhost:8000";

const timeoutMs = 20000;

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const refreshClient = axios.create({
  baseURL: beBaseUrl,
  timeout: timeoutMs,
});

export const http = axios.create({
  baseURL: beBaseUrl,
  timeout: timeoutMs,
});

export const recommendationHttp = axios.create({
  baseURL: recBaseUrl,
  timeout: timeoutMs,
});

http.interceptors.request.use((config) => {
  const token = authStorage.getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshInFlight: Promise<RefreshResponse> | null = null;

async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const response = await refreshClient.post<RefreshResponse>(
    "/v1/auth/refresh",
    null,
    {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    },
  );

  return response.data;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      throw error;
    }

    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) {
      authStorage.clear();
      throw error;
    }

    originalRequest._retry = true;

    try {
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken(refreshToken).finally(() => {
          refreshInFlight = null;
        });
      }

      const refreshed = await refreshInFlight;
      authStorage.setAccessToken(refreshed.accessToken);
      authStorage.setRefreshToken(refreshed.refreshToken);

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;

      return http(originalRequest);
    } catch (refreshError) {
      authStorage.clear();
      throw refreshError;
    }
  },
);
