import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  AddWishlistItemPayload,
  ApiMessage,
  Wishlist,
  WishlistItem,
} from "../../types/api";

export const wishlistApi = {
  async get(): Promise<Wishlist> {
    const response = await http.get<unknown>("/v1/wishlist");
    return unwrapApiResponse<Wishlist>(response.data);
  },

  async getItem(wishlistItemId: string): Promise<WishlistItem> {
    const response = await http.get<unknown>(
      `/v1/wishlist/items/${wishlistItemId}`,
    );
    return unwrapApiResponse<WishlistItem>(response.data);
  },

  async add(payload: AddWishlistItemPayload): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/wishlist/items", payload);
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async remove(wishlistItemId: string): Promise<ApiMessage> {
    const response = await http.delete<unknown>(
      `/v1/wishlist/items/${wishlistItemId}`,
    );
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
