import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cartApi,
  ordersApi,
  productsApi,
  recommendationApi,
  wishlistApi,
} from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, Product, SimilarResponse, Wishlist } from "../types/api";
import {
  getTodayProductInteractions,
  isSameLocalDay,
  type ProductInteractionEventType,
} from "../utils/productInteractions";

type InterestedSource = "similar" | "fallback" | "none";

type InterestedSeed = {
  productId: string;
  eventType: ProductInteractionEventType;
  interactedAt: Date;
};

type InterestedState = {
  products: Product[];
  isVisible: boolean;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  source: InterestedSource;
  seedsCount: number;
};

type CacheEntry = {
  timestamp: number;
  value: Omit<InterestedState, "isLoading">;
};

const INTERESTED_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RENDER_PRODUCTS = 50;
const MAX_SEED_PRODUCTS = 10;
const SIMILAR_TOP_N = 10;
const REQUEST_CONCURRENCY = 5;

const INTERACTION_PRIORITY: Record<ProductInteractionEventType, number> = {
  ORDER: 4,
  CART: 3,
  WISHLIST: 2,
  VIEW: 1,
};

const INTERACTION_WEIGHT: Record<ProductInteractionEventType, number> = {
  ORDER: 1.6,
  CART: 1.45,
  WISHLIST: 1.3,
  VIEW: 1.0,
};

const interestedProductsCache = new Map<string, CacheEntry>();

function getDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (typeof error === "object" && error !== null) {
    const maybeCode = "code" in error ? error.code : null;
    const maybeName = "name" in error ? error.name : null;
    return maybeCode === "ERR_CANCELED" || maybeName === "CanceledError";
  }

  return false;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  if (items.length === 0) {
    return [];
  }

  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runners = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;

      try {
        const value = await worker(items[currentIndex], currentIndex);
        results[currentIndex] = {
          status: "fulfilled",
          value,
        };
      } catch (reason) {
        results[currentIndex] = {
          status: "rejected",
          reason,
        };
      }
    }
  });

  await Promise.all(runners);
  return results;
}

function toInterestedSeed(
  productId: string,
  eventType: ProductInteractionEventType,
  interactedAtRaw: string,
): InterestedSeed | null {
  if (!productId.trim()) {
    return null;
  }

  const interactedAt = new Date(interactedAtRaw);
  if (Number.isNaN(interactedAt.getTime())) {
    return null;
  }

  return {
    productId: productId.trim(),
    eventType,
    interactedAt,
  };
}

function selectTopSeedsForToday(
  seedCandidates: InterestedSeed[],
): InterestedSeed[] {
  const bestByProduct = new Map<string, InterestedSeed>();

  seedCandidates.forEach((seed) => {
    const existing = bestByProduct.get(seed.productId);
    if (!existing) {
      bestByProduct.set(seed.productId, seed);
      return;
    }

    const priorityDiff =
      INTERACTION_PRIORITY[seed.eventType] -
      INTERACTION_PRIORITY[existing.eventType];

    if (priorityDiff > 0) {
      bestByProduct.set(seed.productId, seed);
      return;
    }

    if (priorityDiff === 0 && seed.interactedAt > existing.interactedAt) {
      bestByProduct.set(seed.productId, seed);
    }
  });

  return Array.from(bestByProduct.values())
    .sort((a, b) => {
      const priorityDiff =
        INTERACTION_PRIORITY[b.eventType] - INTERACTION_PRIORITY[a.eventType];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return b.interactedAt.getTime() - a.interactedAt.getTime();
    })
    .slice(0, MAX_SEED_PRODUCTS);
}

function buildOrderSeeds(orders: Order[], now: Date): InterestedSeed[] {
  const output: InterestedSeed[] = [];

  orders.forEach((order) => {
    if (!isSameLocalDay(order.createdAt, now)) {
      return;
    }

    order.items.forEach((item) => {
      const seed = toInterestedSeed(item.productId, "ORDER", order.createdAt);
      if (seed) {
        output.push(seed);
      }
    });
  });

  return output;
}

function buildWishlistSeeds(wishlist: Wishlist, now: Date): InterestedSeed[] {
  const output: InterestedSeed[] = [];

  wishlist.items.forEach((item) => {
    if (!isSameLocalDay(item.addedAt, now)) {
      return;
    }

    const seed = toInterestedSeed(item.productId, "WISHLIST", item.addedAt);
    if (seed) {
      output.push(seed);
    }
  });

  return output;
}

function calculateRecencyWeight(interactedAt: Date, now = new Date()): number {
  const diffMs = Math.max(0, now.getTime() - interactedAt.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  const ratio = Math.min(diffMs / dayMs, 1);
  return 1.2 - ratio * 0.4;
}

function mergeSimilarScores(
  seeds: InterestedSeed[],
  similarResponses: SimilarResponse[],
): string[] {
  const now = new Date();
  const seedProductIds = new Set(seeds.map((seed) => seed.productId));
  const scoreByProduct = new Map<string, number>();

  const seedMap = new Map<string, InterestedSeed>();
  seeds.forEach((seed) => {
    seedMap.set(seed.productId, seed);
  });

  similarResponses.forEach((response) => {
    const seed = seedMap.get(response.productId);
    if (!seed) {
      return;
    }

    const interactionWeight = INTERACTION_WEIGHT[seed.eventType] ?? 1;
    const recencyWeight = calculateRecencyWeight(seed.interactedAt, now);

    response.similarItems.forEach((item) => {
      if (!item.productId || seedProductIds.has(item.productId)) {
        return;
      }

      if (!Number.isFinite(item.score) || item.score <= 0) {
        return;
      }

      const weightedScore = item.score * interactionWeight * recencyWeight;
      const previousScore = scoreByProduct.get(item.productId) ?? 0;
      scoreByProduct.set(item.productId, previousScore + weightedScore);
    });
  });

  return Array.from(scoreByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([productId]) => productId)
    .slice(0, MAX_RENDER_PRODUCTS);
}

async function resolveProductsByIds(
  productIds: string[],
  signal: AbortSignal,
): Promise<Product[]> {
  if (productIds.length === 0) {
    return [];
  }

  const settled = await runWithConcurrency(
    productIds,
    REQUEST_CONCURRENCY,
    (id) => productsApi.byId(id, { signal }),
  );

  throwIfAborted(signal);

  const fulfilledProducts = settled
    .filter(
      (result): result is PromiseFulfilledResult<Product> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value)
    .filter((product) => product.status);

  const mapById = new Map<string, Product>();
  fulfilledProducts.forEach((product) => {
    mapById.set(product.id, product);
  });

  return productIds
    .map((productId) => mapById.get(productId) || null)
    .filter((product): product is Product => Boolean(product))
    .slice(0, MAX_RENDER_PRODUCTS);
}

async function fallbackToRecommend(
  userId: string,
  signal: AbortSignal,
): Promise<Product[]> {
  const fallbackResponse = await recommendationApi.recommendFromPython(
    userId,
    MAX_RENDER_PRODUCTS,
    { signal },
  );

  throwIfAborted(signal);

  if (fallbackResponse.productIds.length === 0) {
    return [];
  }

  return resolveProductsByIds(fallbackResponse.productIds, signal);
}

async function collectTodaySeeds(
  userId: string,
  signal: AbortSignal,
): Promise<InterestedSeed[]> {
  const now = new Date();
  const localSeeds = getTodayProductInteractions(userId, now)
    .map((record) =>
      toInterestedSeed(
        record.productId,
        record.eventType,
        record.lastInteractedAt,
      ),
    )
    .filter((seed): seed is InterestedSeed => Boolean(seed));

  const [ordersResult, wishlistResult, cartResult] = await Promise.allSettled([
    ordersApi.listMine(0, 50, { signal }),
    wishlistApi.get({ signal }),
    cartApi.get({ signal }),
  ]);

  throwIfAborted(signal);

  const orderSeeds =
    ordersResult.status === "fulfilled"
      ? buildOrderSeeds(ordersResult.value.items, now)
      : [];

  const wishlistSeeds =
    wishlistResult.status === "fulfilled"
      ? buildWishlistSeeds(wishlistResult.value, now)
      : [];

  const cartSeeds =
    cartResult.status === "fulfilled"
      ? cartResult.value.items
          .map((item) =>
            toInterestedSeed(item.productId, "CART", now.toISOString()),
          )
          .filter((seed): seed is InterestedSeed => Boolean(seed))
      : [];

  return selectTopSeedsForToday([
    ...orderSeeds,
    ...cartSeeds,
    ...wishlistSeeds,
    ...localSeeds,
  ]);
}

export function useInterestedProducts(userId?: string) {
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<InterestedState>({
    products: [],
    isVisible: false,
    isLoading: false,
    isEmpty: false,
    error: null,
    source: "none",
    seedsCount: 0,
  });

  const retry = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setState({
        products: [],
        isVisible: false,
        isLoading: false,
        isEmpty: false,
        error: null,
        source: "none",
        seedsCount: 0,
      });
      return;
    }

    const dateKey = getDateKey(new Date());
    const cacheKey = `${userId}:${dateKey}`;
    const cached = interestedProductsCache.get(cacheKey);

    if (
      reloadTick === 0 &&
      cached &&
      Date.now() - cached.timestamp < INTERESTED_CACHE_TTL_MS
    ) {
      setState({
        ...cached.value,
        isLoading: false,
      });
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;

    const load = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const seeds = await collectTodaySeeds(userId, controller.signal);

        if (!isCurrent || controller.signal.aborted) {
          return;
        }

        if (seeds.length === 0) {
          const nextState: Omit<InterestedState, "isLoading"> = {
            products: [],
            isVisible: false,
            isEmpty: false,
            error: null,
            source: "none",
            seedsCount: 0,
          };

          interestedProductsCache.set(cacheKey, {
            timestamp: Date.now(),
            value: nextState,
          });

          setState({
            ...nextState,
            isLoading: false,
          });
          return;
        }

        const similarSettled = await runWithConcurrency(
          seeds,
          REQUEST_CONCURRENCY,
          (seed) =>
            recommendationApi.similar(seed.productId, SIMILAR_TOP_N, {
              signal: controller.signal,
            }),
        );

        throwIfAborted(controller.signal);

        const similarResponses = similarSettled
          .filter(
            (result): result is PromiseFulfilledResult<SimilarResponse> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);

        const mergedProductIds = mergeSimilarScores(seeds, similarResponses);

        let products = await resolveProductsByIds(
          mergedProductIds,
          controller.signal,
        );
        let source: InterestedSource = "similar";

        if (products.length === 0) {
          products = await fallbackToRecommend(userId, controller.signal);
          source = "fallback";
        }

        throwIfAborted(controller.signal);

        const nextState: Omit<InterestedState, "isLoading"> = {
          products,
          isVisible: true,
          isEmpty: products.length === 0,
          error: null,
          source,
          seedsCount: seeds.length,
        };

        interestedProductsCache.set(cacheKey, {
          timestamp: Date.now(),
          value: nextState,
        });

        if (isCurrent) {
          setState({
            ...nextState,
            isLoading: false,
          });
        }
      } catch (rawError) {
        if (!isCurrent || isAbortError(rawError)) {
          return;
        }

        const apiError = parseApiError(rawError);
        setState({
          products: [],
          isVisible: true,
          isLoading: false,
          isEmpty: false,
          error: apiError.message,
          source: "none",
          seedsCount: 0,
        });
      }
    };

    void load();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [reloadTick, userId]);

  return useMemo(
    () => ({
      ...state,
      retry,
    }),
    [state, retry],
  );
}
