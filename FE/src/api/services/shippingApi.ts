import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type { ShippingFeeResponse } from "../../types/api";

export const shippingApi = {
  async fee(destination: string): Promise<ShippingFeeResponse> {
    const response = await http.post<unknown>("/v1/shipping-fee", {
      destination,
    });
    return unwrapApiResponse<ShippingFeeResponse>(response.data);
  },
};
