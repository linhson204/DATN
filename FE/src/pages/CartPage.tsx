import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { cartApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Cart } from "../types/api";
import { formatCurrency } from "../utils/format";
import { IconTrash } from "../components/icons/AppIcons";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import "../styles/CartPage.css";


export function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const loadCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await cartApi.get();
      setCart(response);
    } catch (rawError) {
      toast.error(parseApiError(rawError).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadCart(); }, [loadCart]);

  const selectedAmount = useMemo(() =>
    cart?.items.filter((i) => i.isSelected).reduce((sum, i) => sum + i.lineTotal, 0) || 0,
    [cart?.items]
  );

  const selectedCount = useMemo(() =>
    cart?.items.filter((i) => i.isSelected).length || 0,
    [cart?.items]
  );

  const allSelected = useMemo(() =>
    !!cart && cart.items.length > 0 && cart.items.every((i) => i.isSelected),
    [cart]
  );

  /* ── Handlers ── */
  const updateQuantity = async (cartItemId: string, quantity: number) => {
    setIsMutating(true);
    try {
      await cartApi.updateQuantity(cartItemId, Math.max(1, quantity));
      await loadCart();
      toast.success("Đã cập nhật số lượng.");
    } catch (rawError) { toast.error(parseApiError(rawError).message); }
    finally { setIsMutating(false); }
  };

  const toggleSelection = async (cartItemId: string, isSelected: boolean) => {
    setIsMutating(true);
    try {
      await cartApi.updateSelection(cartItemId, isSelected);
      await loadCart();
    } catch (rawError) { toast.error(parseApiError(rawError).message); }
    finally { setIsMutating(false); }
  };

  const toggleAll = async (selected: boolean) => {
    if (!cart) return;
    setIsMutating(true);
    try {
      await Promise.all(
        cart.items.map((item) =>
          item.isSelected !== selected
            ? cartApi.updateSelection(item.cartItemId, selected)
            : Promise.resolve()
        )
      );
      await loadCart();
    } catch (rawError) { toast.error(parseApiError(rawError).message); }
    finally { setIsMutating(false); }
  };

  const removeItem = async (cartItemId: string) => {
    setIsMutating(true);
    try {
      await cartApi.remove(cartItemId);
      await loadCart();
      toast.success("Đã xóa sản phẩm khỏi giỏ hàng.");
    } catch (rawError) { toast.error(parseApiError(rawError).message); }
    finally { setIsMutating(false); }
  };

  const clearCart = async () => {
    setIsMutating(true);
    try {
      await cartApi.clear();
      await loadCart();
      toast.success("Đã xóa toàn bộ giỏ hàng.");
    } catch (rawError) { toast.error(parseApiError(rawError).message); }
    finally { setIsMutating(false); }
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="surface-card">
        <Spinner message="Đang tải giỏ hàng..." />
      </div>
    );
  }

  /* ── Empty ── */
  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="reveal-up">
      <div className="cart-header">
        <h1>Giỏ hàng</h1>
        {!isEmpty && (
          <span className="cart-badge">{cart!.totalItems}</span>
        )}
      </div>

      {isEmpty ? (
        <div className="surface-card">
          <EmptyState
            icon="🛒"
            title="Giỏ hàng trống"
            description="Hãy thêm sản phẩm vào giỏ hàng để tiến hành thanh toán."
            actionLabel="Khám phá sản phẩm"
            actionTo="/products"
          />
        </div>
      ) : (
        <div className="cart-page">
          {/* ── Left: item list ── */}
          <div>
            {/* Select all toolbar */}
            <div className="cart-toolbar">
              <label className="cart-select-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => void toggleAll(e.target.checked)}
                  disabled={isMutating}
                />
                Chọn tất cả ({cart!.items.length} sản phẩm)
              </label>
              <button
                className="cart-clear-btn"
                type="button"
                disabled={isMutating}
                onClick={() => void clearCart()}
              >
                Xóa tất cả
              </button>
            </div>

            {/* Items */}
            <div className="cart-items">
              {cart!.items.map((item) => (
                <article
                  className={`cart-item-card ${item.isSelected ? "selected" : ""}`}
                  key={item.cartItemId}
                >
                  {/* Checkbox */}
                  <div className="cart-item-check">
                    <input
                      type="checkbox"
                      checked={item.isSelected}
                      onChange={(e) => void toggleSelection(item.cartItemId, e.target.checked)}
                      disabled={isMutating}
                    />
                  </div>

                  {/* Image */}
                  <div className="cart-item-img">
                    {item.imageUrl && <img src={item.imageUrl} alt={item.productName} />}
                  </div>

                  {/* Info */}
                  <div className="cart-item-info">
                    <h3 className="cart-item-name">{item.productName}</h3>
                    <p className="cart-item-variant">
                      {item.size && <span>{item.size}</span>}
                      {item.color && <span>{item.color}</span>}
                    </p>
                    <p className="cart-item-price">
                      {formatCurrency(item.lineTotal)}
                      <span className="cart-item-unit-price"> ({formatCurrency(item.unitPrice)} × {item.quantity})</span>
                    </p>
                  </div>

                  {/* Actions row */}
                  <div className="cart-item-actions">
                    <span className={`cart-item-stock ${item.stockAvailable <= 5 ? "low" : ""}`}>
                      Còn {item.stockAvailable} sp
                    </span>

                    <div className="qty-stepper">
                      <button
                        type="button"
                        disabled={isMutating || item.quantity <= 1}
                        onClick={() => void updateQuantity(item.cartItemId, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={isMutating || item.quantity >= item.stockAvailable}
                        onClick={() => void updateQuantity(item.cartItemId, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="cart-remove-btn"
                      type="button"
                      disabled={isMutating}
                      onClick={() => void removeItem(item.cartItemId)}
                      aria-label="Xóa sản phẩm"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* ── Right: order summary ── */}
          <aside className="cart-summary">
            <h2>Tóm tắt đơn hàng</h2>

            <div className="cart-summary-row">
              <span className="summary-label">Loại SP đã chọn</span>
              <span>{selectedCount} / {cart!.items.length}</span>
            </div>
            <div className="cart-summary-row">
              <span className="summary-label">Tạm tính</span>
              <span>{formatCurrency(selectedAmount)}</span>
            </div>
            <div className="cart-summary-row">
              <span className="summary-label">Phí vận chuyển</span>
              <span style={{ color: "#22c55e", fontWeight: 600 }}>Miễn phí</span>
            </div>
            <div className="cart-summary-row total">
              <span>Tổng cộng</span>
              <span className="summary-amount">{formatCurrency(selectedAmount)}</span>
            </div>

            <Link
              className={`cart-checkout-btn ${selectedCount === 0 ? "disabled-link" : ""}`}
              to={selectedCount > 0 ? "/checkout" : "#"}
              onClick={(e) => {
                if (selectedCount === 0) {
                  e.preventDefault();
                  toast.warning("Bạn cần chọn ít nhất 1 sản phẩm để thanh toán.");
                }
              }}
            >
              Thanh toán ({selectedCount} sản phẩm)
            </Link>

            <p className="cart-summary-note"> Thanh toán an toàn và bảo mật</p>
          </aside>
        </div>
      )}
    </div>
  );
}
