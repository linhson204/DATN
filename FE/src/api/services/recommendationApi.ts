import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  CandidateResponse,
  PersonalizedRecommendResponse,
  SimilarResponse,
} from "../../types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePersonalizedResponse(
  payload: unknown,
): PersonalizedRecommendResponse {
  if (!isRecord(payload)) {
    return {
      strategy: null,
      product_ids: [],
    };
  }

  const strategy =
    typeof payload.strategy === "string" ? payload.strategy : null;

  if (Array.isArray(payload.product_ids)) {
    const normalizedProductIds = payload.product_ids.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    return {
      strategy,
      product_ids: normalizedProductIds,
    };
  }

  return {
    strategy,
    product_ids: [],
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

  // BE Java dùng @JsonProperty("product_id") nên serialize ra snake_case
  const productId =
    typeof payload.product_id === "string"
      ? payload.product_id
      : fallbackProductId;

  // BE Java trả "similarities" với mỗi item chứa "product_id" (snake_case)
  const similarItemsRaw = Array.isArray(payload.similarities)
    ? payload.similarities
    : [];

  const similarItems = similarItemsRaw
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      // BE Java: @JsonProperty("product_id") trên field productId
      const candidateProductId =
        typeof item.product_id === "string"
          ? item.product_id
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

  /** Gợi ý cá nhân hóa — gọi BE Java, Java nội bộ proxy sang AI Python */
  async recommendPersonalized(
    userId: string,
    limit: number,
    gender?: string,
    options?: RequestOptions,
  ): Promise<PersonalizedRecommendResponse> {
    const params: Record<string, string | number> = { topN: limit };
    if (gender) {
      params.gender = gender;
    }

    const response = await http.get<unknown>(
      `/v1/recommendations/personalized/${userId}`,
      {
        params,
        signal: options?.signal,
      },
    );

    const payload = unwrapApiResponse<unknown>(response.data);
    return normalizePersonalizedResponse(payload);
  },

  /** Sản phẩm tương tự — gọi BE Java, Java nội bộ proxy sang AI Python */
  async similar(
    productId: string,
    topN = 10,
    options?: RequestOptions,
  ): Promise<SimilarResponse> {
    const response = await http.get<unknown>(
      `/v1/recommendations/similar/${productId}`,
      {
        params: { topN },
        signal: options?.signal,
      },
    );

    const payload = unwrapApiResponse<unknown>(response.data);
    return normalizeSimilarResponse(payload, productId);
  },
};
