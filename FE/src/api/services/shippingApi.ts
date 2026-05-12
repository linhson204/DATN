import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type { GoongLocationSuggestion, ShippingFeeResponse } from "../../types/api";

export const shippingApi = {
  async fee(destination: string): Promise<ShippingFeeResponse> {
    const response = await http.post<unknown>("/v1/shipping-fee", {
      destination,
    });
    return unwrapApiResponse<ShippingFeeResponse>(response.data);
  },

  async suggest(address: string): Promise<GoongLocationSuggestion[]> {
    const response = await http.get<unknown>("/v1/goong/location", {
      params: { address },
    });
    return unwrapApiResponse<GoongLocationSuggestion[]>(response.data);
  },
};
