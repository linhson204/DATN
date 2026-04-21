import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  ApiMessage,
  PageResponse,
  Product,
  ProductListQuery,
} from "../../types/api";

export const productsApi = {
  async list(query: ProductListQuery = {}): Promise<PageResponse<Product>> {
    const response = await http.get<unknown>("/v1/products", {
      params: query,
    });
    return unwrapApiResponse<PageResponse<Product>>(response.data);
  },

  async byId(productId: string): Promise<Product> {
    const response = await http.get<unknown>(`/v1/products/${productId}`);
    return unwrapApiResponse<Product>(response.data);
  },

  async logView(
    productId: string,
    durationSeconds: number,
  ): Promise<ApiMessage> {
    const response = await http.post<unknown>(
      `/v1/products/${productId}/view`,
      {
        durationSeconds,
      },
    );
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
