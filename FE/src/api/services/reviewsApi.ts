import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  ApiMessage,
  CreateReviewPayload,
  PageResponse,
  ReviewItem,
  ReviewSummary,
} from "../../types/api";

export const reviewsApi = {
  /** GET /v1/products/{productId}/reviews/summary – Public */
  async getSummary(productId: string): Promise<ReviewSummary> {
    const response = await http.get<unknown>(
      `/v1/products/${productId}/reviews/summary`,
    );
    return unwrapApiResponse<ReviewSummary>(response.data);
  },

  /** GET /v1/products/{productId}/reviews?page=0&size=10 – Public */
  async list(
    productId: string,
    page = 0,
    size = 10,
  ): Promise<PageResponse<ReviewItem>> {
    const response = await http.get<unknown>(
      `/v1/products/${productId}/reviews`,
      { params: { page, size } },
    );
    return unwrapApiResponse<PageResponse<ReviewItem>>(response.data);
  },

  /** POST /v1/products/{productId}/reviews – Requires Auth */
  async create(
    productId: string,
    payload: CreateReviewPayload,
  ): Promise<ReviewItem> {
    const response = await http.post<unknown>(
      `/v1/products/${productId}/reviews`,
      payload,
    );
    return unwrapApiResponse<ReviewItem>(response.data);
  },

  /** DELETE /v1/products/{productId}/reviews/{reviewId} – Requires Auth */
  async remove(productId: string, reviewId: string): Promise<ApiMessage> {
    const response = await http.delete<unknown>(
      `/v1/products/${productId}/reviews/${reviewId}`,
    );
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
