import { http, recommendationHttp } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  CandidateResponse,
  PythonRecommendResponse,
} from "../../types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePythonRecommendResponse(
  payload: unknown,
): PythonRecommendResponse {
  if (!isRecord(payload)) {
    return {
      strategy: null,
      productIds: [],
    };
  }

  const strategy =
    typeof payload.strategy === "string" ? payload.strategy : null;

  if (Array.isArray(payload.productIds)) {
    const normalizedProductIds = payload.productIds.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    return {
      strategy,
      productIds: normalizedProductIds,
    };
  }

  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations
    : [];

  const productIds = recommendations
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      if (typeof item.product_id === "string" && item.product_id.length > 0) {
        return item.product_id;
      }

      if (typeof item.productId === "string" && item.productId.length > 0) {
        return item.productId;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));

  return {
    strategy,
    productIds,
  };
}

export const recommendationApi = {
  async candidates(productId: string): Promise<CandidateResponse> {
    const response = await http.get<unknown>(
      `/v1/recommendations/candidates/${productId}`,
    );
    return unwrapApiResponse<CandidateResponse>(response.data);
  },

  async recommendFromPython(
    userId: string,
    limit: number,
  ): Promise<PythonRecommendResponse> {
    const response = await recommendationHttp.get<unknown>(
      `/recommend/${userId}`,
      {
        params: { top_n: limit },
      },
    );

    const payload = unwrapApiResponse<unknown>(response.data);
    return normalizePythonRecommendResponse(payload);
  },
};
