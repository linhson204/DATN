import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cartApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Cart } from "../types/api";
import { formatCurrency } from "../utils/format";

export function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await cartApi.get();
      setCart(response);
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const selectedAmount = useMemo(() => {
    return (
      cart?.items
        .filter((item) => item.isSelected)
        .reduce((sum, item) => sum + item.lineTotal, 0) || 0
    );
  }, [cart?.items]);

  const selectedCount = useMemo(() => {
    return cart?.items.filter((item) => item.isSelected).length || 0;
  }, [cart?.items]);

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await cartApi.updateQuantity(cartItemId, Math.max(1, quantity));
      await loadCart();
      setNotice("Đã cập nhật số lượng.");
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsMutating(false);
    }
  };

  const toggleSelection = async (cartItemId: string, isSelected: boolean) => {
    setIsMutating(true);
    setError(null);

    try {
      await cartApi.updateSelection(cartItemId, isSelected);
      await loadCart();
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsMutating(false);
    }
  };

  const removeItem = async (cartItemId: string) => {
    setIsMutating(true);
    setError(null);

    try {
      await cartApi.remove(cartItemId);
      await loadCart();
      setNotice("Đã xóa sản phẩm khỏi giỏ hàng.");
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsMutating(false);
    }
  };

  const clearCart = async () => {
    setIsMutating(true);
    setError(null);

    try {
      await cartApi.clear();
      await loadCart();
      setNotice("Đã xóa toàn bộ giỏ hàng.");
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading) {
    return <section className="surface-card">Đang tải giỏ hàng...</section>;
  }

  return (
    <section className="surface-card reveal-up">
      <div className="section-headline">
        <h2>Giỏ hàng</h2>
        <p>
          Lưu ý: totalAmount từ server là tổng tất cả sản phẩm, không chỉ các
          sản phẩm được chọn.
        </p>
      </div>

      {notice && <p className="alert success">{notice}</p>}
      {error && <p className="alert error">{error}</p>}

      {!cart || cart.items.length === 0 ? (
        <div className="empty-state">
          <p>Giỏ hàng đang trống.</p>
          <Link className="btn btn-primary" to="/products">
            Quay lại danh sách sản phẩm
          </Link>
        </div>
      ) : (
        <>
          <div className="list-stack">
            {cart.items.map((item) => (
              <article className="list-item-card" key={item.cartItemId}>
                <label className="check-inline">
                  <input
                    type="checkbox"
                    checked={item.isSelected}
                    onChange={(event) =>
                      void toggleSelection(
                        item.cartItemId,
                        event.target.checked,
                      )
                    }
                    disabled={isMutating}
                  />
                  Chọn để thanh toán
                </label>

                <h4>{item.productName}</h4>
                <p>
                  {item.size} / {item.color} - SKU: {item.sku}
                </p>

                <div className="muted-row">
                  <span>Đơn giá: {formatCurrency(item.unitPrice)}</span>
                  <span>Thành tiền: {formatCurrency(item.lineTotal)}</span>
                  <span>Tồn kho khả dụng: {item.stockAvailable}</span>
                </div>

                <div className="qty-row">
                  <button
                    className="btn btn-muted"
                    type="button"
                    disabled={isMutating || item.quantity <= 1}
                    onClick={() =>
                      void updateQuantity(item.cartItemId, item.quantity - 1)
                    }
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    className="btn btn-muted"
                    type="button"
                    disabled={isMutating}
                    onClick={() =>
                      void updateQuantity(item.cartItemId, item.quantity + 1)
                    }
                  >
                    +
                  </button>

                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={isMutating}
                    onClick={() => void removeItem(item.cartItemId)}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>

          <footer className="totals-panel">
            <p>
              Tổng sản phẩm: <strong>{cart.totalItems}</strong>
            </p>
            <p>
              Tổng từ server:{" "}
              <strong>{formatCurrency(cart.totalAmount)}</strong>
            </p>
            <p>
              Tổng đã chọn: <strong>{formatCurrency(selectedAmount)}</strong>
            </p>

            <div className="card-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={isMutating}
                onClick={() => void clearCart()}
              >
                Xóa giỏ hàng
              </button>

              <Link
                className={`btn btn-primary ${selectedCount === 0 ? "disabled-link" : ""}`}
                to={selectedCount > 0 ? "/checkout" : "#"}
                onClick={(event) => {
                  if (selectedCount === 0) {
                    event.preventDefault();
                    setError("Bạn cần chọn ít nhất 1 sản phẩm để thanh toán.");
                  }
                }}
              >
                Sang thanh toán ({selectedCount} sản phẩm)
              </Link>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
