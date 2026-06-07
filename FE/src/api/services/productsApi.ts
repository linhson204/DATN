import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  ApiMessage,
  PageResponse,
  Product,
  ProductListQuery,
} from "../../types/api";

type RequestOptions = {
  signal?: AbortSignal;
};

export type CreateProductPayload = {
  name: string;
  brand: string;
  categoryId?: string;
  targetGender: "male" | "female" | "unisex";
  description: string;
  imageUrl?: string;
  status?: boolean;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export const productsApi = {
  async list(query: ProductListQuery = {}): Promise<PageResponse<Product>> {
    const response = await http.get<unknown>("/v1/products", {
      params: query,
    });
    return unwrapApiResponse<PageResponse<Product>>(response.data);
  },

  async byId(productId: string, options?: RequestOptions): Promise<Product> {
    const response = await http.get<unknown>(`/v1/products/${productId}`, {
      signal: options?.signal,
    });
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

  // ── Admin CRUD ──
  async create(payload: CreateProductPayload): Promise<Product> {
    const response = await http.post<unknown>("/v1/products", payload);
    return unwrapApiResponse<Product>(response.data);
  },

  async update(
    productId: string,
    payload: UpdateProductPayload,
  ): Promise<Product> {
    const response = await http.put<unknown>(
      `/v1/products/${productId}`,
      payload,
    );
    return unwrapApiResponse<Product>(response.data);
  },

  async remove(productId: string): Promise<ApiMessage> {
    const response = await http.delete<unknown>(`/v1/products/${productId}`);
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
