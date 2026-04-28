import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cartApi, ordersApi, productsApi, wishlistApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order, Product, Wishlist } from "../types/api";
import {
  getTodayProductInteractions,
  isSameLocalDay,
  type ProductInteractionEventType,
} from "../utils/productInteractions";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DISPLAY = 50;
const REQUEST_CONCURRENCY = 5;
const CACHE_TTL_MS = 5 * 60 * 1000;

const INTERACTION_PRIORITY: Record<ProductInteractionEventType, number> = {
  ORDER: 4,
  CART: 3,
  WISHLIST: 2,
  VIEW: 1,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type BrowsedSeed = {
  productId: string;
  eventType: ProductInteractionEventType;
  interactedAt: Date;
};

export type BrowsedProductItem = {
  product: Product;
  eventType: ProductInteractionEventType;
};

type TodayBrowsedState = {
  /** Flat product list (kept for backward-compatibility) */
  products: Product[];
  /** Enriched list with interaction type per product */
  items: BrowsedProductItem[];
  isVisible: boolean;
  isLoading: boolean;
  error: string | null;
};

type CacheEntry = {
  timestamp: number;
  value: Omit<TodayBrowsedState, "isLoading">;
};

// ─── Module-level cache (shared across renders) ────────────────────────────

const cache = new Map<string, CacheEntry>();

// ─── Concurrency-limited runner ───────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  if (items.length === 0) return [];

  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  const maxWorkers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runners = Array.from({ length: maxWorkers }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = { status: "fulfilled", value: await worker(items[idx]) };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  });

  await Promise.all(runners);
  return results;
}

// ─── Abort detection ──────────────────────────────────────────────────────────

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (typeof err === "object" && err !== null) {
    const code = "code" in err ? (err as Record<string, unknown>).code : null;
    const name = "name" in err ? (err as Record<string, unknown>).name : null;
    return code === "ERR_CANCELED" || name === "CanceledError";
  }
  return false;
}

// ─── Date key for cache invalidation ─────────────────────────────────────────

function getDateKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── Convert raw interaction record to BrowsedSeed ───────────────────────────

function toSeed(
  productId: string,
  eventType: ProductInteractionEventType,
  isoDate: string,
): BrowsedSeed | null {
  const pid = productId.trim();
  if (!pid) return null;
  const at = new Date(isoDate);
  if (Number.isNaN(at.getTime())) return null;
  return { productId: pid, eventType, interactedAt: at };
}

// ─── Merge seeds: one entry per product, keep highest-priority & most-recent ─

function buildSeedList(seeds: BrowsedSeed[]): BrowsedSeed[] {
  const best = new Map<string, BrowsedSeed>();

  seeds.forEach((seed) => {
    const existing = best.get(seed.productId);
    if (!existing) {
      best.set(seed.productId, seed);
      return;
    }
    const pDiff =
      INTERACTION_PRIORITY[seed.eventType] -
      INTERACTION_PRIORITY[existing.eventType];
    if (pDiff > 0) {
      best.set(seed.productId, seed);
      return;
    }
    if (pDiff === 0 && seed.interactedAt > existing.interactedAt) {
      best.set(seed.productId, seed);
    }
  });

  return Array.from(best.values())
    .sort((a, b) => {
      const pDiff =
        INTERACTION_PRIORITY[b.eventType] - INTERACTION_PRIORITY[a.eventType];
      return pDiff !== 0
        ? pDiff
        : b.interactedAt.getTime() - a.interactedAt.getTime();
    })
    .slice(0, MAX_DISPLAY);
}

// ─── Build order seeds ────────────────────────────────────────────────────────

function buildOrderSeeds(orders: Order[], now: Date): BrowsedSeed[] {
  const out: BrowsedSeed[] = [];
  orders.forEach((order) => {
    if (!isSameLocalDay(order.createdAt, now)) return;
    order.items.forEach((item) => {
      const s = toSeed(item.productId, "ORDER", order.createdAt);
      if (s) out.push(s);
    });
  });
  return out;
}

// ─── Build wishlist seeds ─────────────────────────────────────────────────────

function buildWishlistSeeds(wishlist: Wishlist, now: Date): BrowsedSeed[] {
  const out: BrowsedSeed[] = [];
  wishlist.items.forEach((item) => {
    if (!isSameLocalDay(item.addedAt, now)) return;
    const s = toSeed(item.productId, "WISHLIST", item.addedAt);
    if (s) out.push(s);
  });
  return out;
}

// ─── Resolve product details in priority order, returning (product, eventType) ─

async function resolveProducts(
  seeds: BrowsedSeed[],
  signal: AbortSignal,
): Promise<BrowsedProductItem[]> {
  if (seeds.length === 0) return [];

  const settled = await runWithConcurrency(seeds, REQUEST_CONCURRENCY, (seed) =>
    productsApi.byId(seed.productId, { signal }),
  );

  if (signal.aborted) return [];

  const byId = new Map<string, Product>();
  settled.forEach((result, idx) => {
    if (result.status === "fulfilled" && result.value.status) {
      byId.set(seeds[idx].productId, result.value);
    }
  });

  return seeds
    .map((s) => {
      const product = byId.get(s.productId);
      if (!product) return null;
      return { product, eventType: s.eventType } satisfies BrowsedProductItem;
    })
    .filter((item): item is BrowsedProductItem => Boolean(item));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayBrowsedProducts(userId?: string) {
  const [reloadTick, setReloadTick] = useState(0);
  const [state, setState] = useState<TodayBrowsedState>({
    products: [],
    items: [],
    isVisible: false,
    isLoading: false,
    error: null,
  });

  // Guard against React StrictMode double-run
  const loadingRef = useRef(false);

  const retry = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setState({
        products: [],
        items: [],
        isVisible: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    const dateKey = getDateKey();
    const cacheKey = `today-browsed:${userId}:${dateKey}`;
    const cached = cache.get(cacheKey);

    if (
      reloadTick === 0 &&
      cached &&
      Date.now() - cached.timestamp < CACHE_TTL_MS
    ) {
      setState({ ...cached.value, isLoading: false });
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let isCurrent = true;

    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const now = new Date();

        // 1. Local localStorage VIEW seeds
        const localSeeds = getTodayProductInteractions(userId, now)
          .map((r) => toSeed(r.productId, r.eventType, r.lastInteractedAt))
          .filter((s): s is BrowsedSeed => Boolean(s));

        // 2. Remote seeds (orders, wishlist, cart) — fetched in parallel
        const [ordersRes, wishlistRes, cartRes] = await Promise.allSettled([
          ordersApi.listMine(0, 50, { signal }),
          wishlistApi.get({ signal }),
          cartApi.get({ signal }),
        ]);

        if (signal.aborted || !isCurrent) return;

        const orderSeeds =
          ordersRes.status === "fulfilled"
            ? buildOrderSeeds(ordersRes.value.items, now)
            : [];

        const wishlistSeeds =
          wishlistRes.status === "fulfilled"
            ? buildWishlistSeeds(wishlistRes.value, now)
            : [];

        const cartSeeds =
          cartRes.status === "fulfilled"
            ? cartRes.value.items
                .map((item) => toSeed(item.productId, "CART", now.toISOString()))
                .filter((s): s is BrowsedSeed => Boolean(s))
            : [];

        const allSeeds = buildSeedList([
          ...orderSeeds,
          ...cartSeeds,
          ...wishlistSeeds,
          ...localSeeds,
        ]);

        if (allSeeds.length === 0) {
          const nextState: Omit<TodayBrowsedState, "isLoading"> = {
            products: [],
            items: [],
            isVisible: false,
            error: null,
          };
          cache.set(cacheKey, { timestamp: Date.now(), value: nextState });
          if (isCurrent) setState({ ...nextState, isLoading: false });
          return;
        }

        // 3. Fetch product details
        const items = await resolveProducts(allSeeds, signal);

        if (signal.aborted || !isCurrent) return;

        const nextState: Omit<TodayBrowsedState, "isLoading"> = {
          products: items.map((item) => item.product),
          items,
          isVisible: items.length > 0,
          error: null,
        };

        cache.set(cacheKey, { timestamp: Date.now(), value: nextState });
        if (isCurrent) setState({ ...nextState, isLoading: false });
      } catch (rawErr) {
        if (!isCurrent || isAbortError(rawErr)) return;
        const apiError = parseApiError(rawErr);
        if (isCurrent) {
          setState({
            products: [],
            items: [],
            isVisible: false,
            isLoading: false,
            error: apiError.message,
          });
        }
      } finally {
        loadingRef.current = false;
      }
    };

    void load();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [userId, reloadTick]);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
