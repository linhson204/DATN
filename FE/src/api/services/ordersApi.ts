import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  ApiMessage,
  CreateOrderPayload,
  Order,
  OrderStatus,
  PageResponse,
  PaymentOrderStatus,
} from "../../types/api";

type RequestOptions = {
  signal?: AbortSignal;
};

export const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
];

export const paymentOrdersStatus: PaymentOrderStatus[] = [
  "PENDING",
  "PAID",
  "UNPAID"
];

export const ordersApi = {
  async create(payload: CreateOrderPayload): Promise<Order> {
    const response = await http.post<unknown>("/v1/orders", payload);
    return unwrapApiResponse<Order>(response.data);
  },

  async listMine(
    page = 0,
    size = 10,
    options?: RequestOptions,
  ): Promise<PageResponse<Order>> {
    const response = await http.get<unknown>("/v1/orders", {
      params: { page, size },
      signal: options?.signal,
    });
    return unwrapApiResponse<PageResponse<Order>>(response.data);
  },

  async byId(orderId: string): Promise<Order> {
    const response = await http.get<unknown>(`/v1/orders/${orderId}`);
    return unwrapApiResponse<Order>(response.data);
  },

  async listAdmin(
    page = 0,
    size = 20,
    status?: string,
    userName?: string,
  ): Promise<PageResponse<Order>> {
    const response = await http.get<unknown>("/v1/orders/admin", {
      params: {
        page,
        size,
        ...(status ? { status } : {}),
        ...(userName ? { userName } : {}),
      },
    });
    return unwrapApiResponse<PageResponse<Order>>(response.data);
  },

  async updateStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<ApiMessage> {
    const response = await http.put<unknown>(`/v1/orders/${orderId}/status`, {
      status,
    });
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
