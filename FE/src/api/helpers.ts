import axios from "axios";
import type { ApiError, ApiSuccess } from "../types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessResource<T>(payload: unknown): payload is ApiSuccess<T> {
  return (
    isRecord(payload) &&
    "data" in payload &&
    "message" in payload &&
    "status" in payload
  );
}

export function unwrapApiResponse<T>(payload: unknown): T {
  if (isSuccessResource<T>(payload)) {
    return payload.data;
  }

  return payload as T;
}

export function parseApiError(error: unknown): ApiError {
  const fallback: ApiError = {
    message: "Có lỗi xảy ra. Vui lòng thử lại.",
    status: 500,
    errors: null,
  };

  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) {
      return { ...fallback, message: error.message };
    }

    return fallback;
  }

  const responseData = error.response?.data;

  if (isRecord(responseData)) {
    const message =
      typeof responseData.message === "string"
        ? responseData.message
        : fallback.message;

    const status =
      typeof responseData.status === "number"
        ? responseData.status
        : (error.response?.status ?? fallback.status);

    const errors =
      isRecord(responseData.errors) &&
      Object.values(responseData.errors).every(
        (entry) => typeof entry === "string",
      )
        ? (responseData.errors as Record<string, string>)
        : null;

    return {
      message,
      status,
      errors,
    };
  }

  if (error.response?.status) {
    return {
      ...fallback,
      status: error.response.status,
    };
  }

  return fallback;
}
