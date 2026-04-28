import { http, recommendationHttp } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  CandidateResponse,
  PythonRecommendResponse,
  SimilarResponse,
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

function normalizeSimilarResponse(
  payload: unknown,
  fallbackProductId: string,
): SimilarResponse {
  if (!isRecord(payload)) {
    return {
      productId: fallbackProductId,
      similarItems: [],
    };
  }

  const productId =
    typeof payload.product_id === "string"
      ? payload.product_id
      : typeof payload.productId === "string"
        ? payload.productId
        : fallbackProductId;

  const similarItemsRaw = Array.isArray(payload.similar_items)
    ? payload.similar_items
    : Array.isArray(payload.similarItems)
      ? payload.similarItems
      : [];

  const similarItems = similarItemsRaw
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const candidateProductId =
        typeof item.product_id === "string"
          ? item.product_id
          : typeof item.productId === "string"
            ? item.productId
            : null;

      const score = typeof item.score === "number" ? item.score : null;

      if (!candidateProductId || score === null || Number.isNaN(score)) {
        return null;
      }

      return {
        productId: candidateProductId,
        score,
      };
    })
    .filter(
      (
        value,
      ): value is {
        productId: string;
        score: number;
      } => Boolean(value),
    );

  return {
    productId,
    similarItems,
  };
}

type RequestOptions = {
  signal?: AbortSignal;
};

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
    options?: RequestOptions,
  ): Promise<PythonRecommendResponse> {
    const response = await recommendationHttp.get<unknown>(
      `/recommend/${userId}`,
      {
        params: { top_n: limit },
        signal: options?.signal,
      },
    );

    const payload = unwrapApiResponse<unknown>(response.data);
    return normalizePythonRecommendResponse(payload);
  },

  async similar(
    productId: string,
    topN = 10,
    options?: RequestOptions,
  ): Promise<SimilarResponse> {
    const response = await recommendationHttp.get<unknown>(
      `/similar/${productId}`,
      {
        params: { top_n: topN },
        signal: options?.signal,
      },
    );

    const payload = unwrapApiResponse<unknown>(response.data);
    return normalizeSimilarResponse(payload, productId);
  },
};
