import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type { Product, PageResponse } from "../../types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStatItem {
  articleType: string;
  count: number;
}

export interface UserRecommendations {
  userId: string;
  strategy: string | null;
  products: Product[];
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string | null;
  membershipLevel: string | null;
  status: boolean;
  createdAt: string;
}

export interface UserStats {
  userId: string;
  username: string;
  fullName: string;
  viewStats: CategoryStatItem[];
  cartStats: CategoryStatItem[];
  orderStats: CategoryStatItem[];
  wishlistStats: CategoryStatItem[];
}

// ─── API ───────────────────────────────────────────────────────────────────────

export const adminApi = {
  /** Lấy danh sách người dùng có phân trang (mặc định 30/trang) */
  async listUsers(page = 0, size = 30): Promise<PageResponse<UserSummary>> {
    const response = await http.get<unknown>("/v1/admin/users", {
      params: { page, size },
    });
    return unwrapApiResponse<PageResponse<UserSummary>>(response.data);
  },

  /** Lấy thống kê hành vi của một người dùng theo articleType */
  async getUserStats(userId: string): Promise<UserStats> {
    const response = await http.get<unknown>(`/v1/admin/users/${userId}/stats`);
    return unwrapApiResponse<UserStats>(response.data);
  },

  /** Lấy danh sách sản phẩm gợi ý cho người dùng (dùng trong trang admin) */
  async getUserRecommendations(
    userId: string,
    topN = 12,
    gender?: string,
  ): Promise<UserRecommendations> {
    const params: Record<string, string | number> = { topN };
    if (gender) params.gender = gender;

    // Bước 1: Lấy danh sách product_ids gợi ý
    const recResponse = await http.get<unknown>(
      `/v1/recommendations/personalized/${userId}`,
      { params },
    );
    const recData = unwrapApiResponse<{ strategy: string | null; product_ids: string[] }>(
      recResponse.data,
    );
    const productIds: string[] =
      Array.isArray(recData?.product_ids) ? recData.product_ids : [];
    const strategy = recData?.strategy ?? null;

    if (productIds.length === 0) {
      return { userId, strategy, products: [] };
    }

    // Bước 2: Lấy chi tiết từng sản phẩm song song
    const productResults = await Promise.allSettled(
      productIds.map((pid) =>
        http
          .get<unknown>(`/v1/products/${pid}`)
          .then((r) => unwrapApiResponse<Product>(r.data)),
      ),
    );

    const products = productResults
      .filter(
        (r): r is PromiseFulfilledResult<Product> => r.status === "fulfilled",
      )
      .map((r) => r.value);

    return { userId, strategy, products };
  },
};
