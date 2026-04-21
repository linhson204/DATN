import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type { AddCartItemPayload, ApiMessage, Cart } from "../../types/api";

export const cartApi = {
  async get(): Promise<Cart> {
    const response = await http.get<unknown>("/v1/cart");
    return unwrapApiResponse<Cart>(response.data);
  },

  async add(payload: AddCartItemPayload): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/cart/items", payload);
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async updateQuantity(
    cartItemId: string,
    quantity: number,
  ): Promise<ApiMessage> {
    const response = await http.put<unknown>(`/v1/cart/items/${cartItemId}`, {
      quantity,
    });
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async updateSelection(
    cartItemId: string,
    isSelected: boolean,
  ): Promise<ApiMessage> {
    const response = await http.put<unknown>(
      `/v1/cart/items/${cartItemId}/selection`,
      { isSelected },
    );
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async remove(cartItemId: string): Promise<ApiMessage> {
    const response = await http.delete<unknown>(`/v1/cart/items/${cartItemId}`);
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async clear(): Promise<ApiMessage> {
    const response = await http.delete<unknown>("/v1/cart");
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
