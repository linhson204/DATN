import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type { ProductCategory } from "../../types/api";

export const productCategoriesApi = {
  async list(): Promise<ProductCategory[]> {
    const response = await http.get<unknown>("/v1/product-categories");
    return unwrapApiResponse<ProductCategory[]>(response.data);
  },

  async listMasterCategories(): Promise<string[]> {
    const response = await http.get<unknown>(
      "/v1/product-categories/master-categories",
    );
    return unwrapApiResponse<string[]>(response.data);
  },

  async listSubCategories(masterCategory: string): Promise<string[]> {
    const response = await http.get<unknown>(
      "/v1/product-categories/sub-categories",
      {
        params: { master_category: masterCategory },
      },
    );
    return unwrapApiResponse<string[]>(response.data);
  },

  async listArticleTypes(subCategory: string): Promise<string[]> {
    const response = await http.get<unknown>(
      "/v1/product-categories/article-types",
      {
        params: { sub_category: subCategory },
      },
    );
    return unwrapApiResponse<string[]>(response.data);
  },
};
