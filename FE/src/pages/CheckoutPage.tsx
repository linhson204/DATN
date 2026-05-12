import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { cartApi, ordersApi, shippingApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Cart, DeliveryInfo, GoongLocationSuggestion, Order } from "../types/api";
import { formatCurrency } from "../utils/format";
import { recordProductInteractionsBatch } from "../utils/productInteractions";
import { useAuth } from "../context/AuthContext";
import "../styles/CheckoutPage.css";

type ShippingState = {
  shippingFee: number;
  distance: string;
} | null;

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);
  const [shipping, setShipping] = useState<ShippingState>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Address autocomplete ──
  const [suggestions, setSuggestions] = useState<GoongLocationSuggestion[]>([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressWrapperRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false); // skip debounce when picking from dropdown

  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    recipientName: "",
    email: "",
    phoneNumber: "",
    address: "",
    deliveryMethod: "Tiêu chuẩn",
    deliveryTime: "Ban ngày",
    deliveryInstructions: "",
  });

  // Debounced address suggestions
  useEffect(() => {
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);

    // Skip fetch if this change came from selecting a dropdown item
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (addressInput.trim().length < 2) {
      setSuggestions([]);
      setIsSuggestOpen(false);
      return;
    }
    setIsSuggestLoading(true);
    addressDebounceRef.current = setTimeout(() => {
      void shippingApi
        .suggest(addressInput.trim())
        .then((data) => {
          setSuggestions(data);
          setIsSuggestOpen(data.length > 0);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setIsSuggestLoading(false));
    }, 380);
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, [addressInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addressWrapperRef.current && !addressWrapperRef.current.contains(e.target as Node)) {
        setIsSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await cartApi.get();
        setCart(response);
      } catch (rawError) {
        setError(parseApiError(rawError).message);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const selectedItems = useMemo(() =>
    cart?.items.filter((item) => item.isSelected) || [],
    [cart?.items]
  );

  const selectedSubtotal = useMemo(() =>
    selectedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [selectedItems]
  );

  const totalWithShipping = useMemo(() =>
    selectedSubtotal + (shipping?.shippingFee || 0),
    [selectedSubtotal, shipping?.shippingFee]
  );


  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedItems.length === 0) {
      toast.warning("Bạn cần chọn ít nhất một sản phẩm trong giỏ hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await ordersApi.create({
        status: "PENDING",
        shippingFee: shipping?.shippingFee ?? 0,
        deliveryInfo,
      });

      const orderCreatedAt =
        response.createdAt && !Number.isNaN(new Date(response.createdAt).getTime())
          ? new Date(response.createdAt)
          : new Date();

      recordProductInteractionsBatch(
        selectedItems.map((item) => ({
          userId: user?.id,
          productId: item.productId,
          eventType: "ORDER" as const,
          interactedAt: orderCreatedAt,
        })),
      );

      toast.success("Đặt hàng thành công! 🎉");
      const orderLike = response as Partial<Order>;
      if (orderLike.id) {
        navigate(`/orders/${orderLike.id}`);
      } else {
        navigate("/orders");
      }
    } catch (rawError) {
      toast.error(parseApiError(rawError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="surface-card">
        <div className="checkout-loading">
          <div className="checkout-spinner" />
          <span>Đang tải thông tin thanh toán...</span>
        </div>
      </div>
    );
  }

  /* ── Error loading cart ── */
  if (!cart) {
    return (
      <div className="surface-card">
        <div className="checkout-empty">
          <div className="checkout-empty-icon">⚠️</div>
          <h3>Không tải được giỏ hàng</h3>
          <p>{error || "Đã xảy ra lỗi, vui lòng thử lại."}</p>
          <Link className="btn btn-primary" to="/cart">Quay lại giỏ hàng</Link>
        </div>
      </div>
    );
  }

  /* ── No selected items ── */
  if (selectedItems.length === 0) {
    return (
      <div className="surface-card">
        <div className="checkout-empty">
          <div className="checkout-empty-icon">🛒</div>
          <h3>Chưa có sản phẩm được chọn</h3>
          <p>Hãy quay lại giỏ hàng và chọn sản phẩm cần mua.</p>
          <Link className="btn btn-primary" to="/cart">Quay lại giỏ hàng</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reveal-up">
      <div className="checkout-header">
        <h1>Thanh toán</h1>
      </div>

      <div className="checkout-page">
        {/* ── Left: delivery form ── */}
        <div className="checkout-form-card">
          {error && <div className="checkout-alert error">✕ {error}</div>}

          <p className="checkout-section-title">
            Thông tin giao hàng
          </p>

          <form onSubmit={submitOrder}>
            <div className="checkout-form-grid">
              <div className="checkout-field">
                <label htmlFor="co-name">Tên người nhận</label>
                <input
                  id="co-name"
                  required
                  placeholder="Nguyễn Văn A"
                  value={deliveryInfo.recipientName}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, recipientName: e.target.value }))}
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="co-email">Email</label>
                <input
                  id="co-email"
                  required
                  type="email"
                  placeholder="name@example.com"
                  value={deliveryInfo.email}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="co-phone">Số điện thoại</label>
                <input
                  id="co-phone"
                  required
                  type="tel"
                  placeholder="0901 234 567"
                  value={deliveryInfo.phoneNumber}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, phoneNumber: e.target.value }))}
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="co-method">Phương thức giao hàng</label>
                <select
                  id="co-method"
                  value={deliveryInfo.deliveryMethod}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, deliveryMethod: e.target.value }))}
                >
                  <option value="Tiêu chuẩn">Tiêu chuẩn</option>
                  <option value="Nhanh">Nhanh</option>
                  <option value="Hỏa tốc">Hỏa tốc</option>
                </select>
              </div>

              <div className="checkout-field full-width" ref={addressWrapperRef}>
                <label htmlFor="co-address">Địa chỉ giao hàng</label>
                <div className="address-autocomplete-wrap">
                  <input
                    id="co-address"
                    required
                    autoComplete="off"
                    placeholder="Nhập địa chỉ để tìm gợi ý..."
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      setDeliveryInfo((p) => ({ ...p, address: e.target.value }));
                      setShipping(null);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setIsSuggestOpen(true);
                    }}
                  />
                  {isSuggestLoading && (
                    <span className="address-suggest-spinner" />
                  )}
                  {isSuggestOpen && suggestions.length > 0 && (
                    <ul className="address-suggest-dropdown">
                      {suggestions.map((s) => (
                        <li
                          key={s.place_id}
                          className="address-suggest-item"
                          onMouseDown={(e) => {
                            e.preventDefault(); // keep input focus, prevent blur
                            justSelectedRef.current = true; // skip next debounce
                            const selected = s.description;
                            setAddressInput(selected);
                            setDeliveryInfo((p) => ({ ...p, address: selected }));
                            setIsSuggestOpen(false);
                            setSuggestions([]);
                            setShipping(null);
                            // Auto-calculate shipping fee
                            setIsSubmitting(true);
                            void shippingApi
                              .fee(selected)
                              .then((res) => {
                                setShipping(res);
                                toast.success(`🚚 Phí vận chuyển: ${res.distance}`);
                              })
                              .catch((rawErr) => toast.error(parseApiError(rawErr).message))
                              .finally(() => setIsSubmitting(false));
                          }}
                        >
                          <span className="address-suggest-main">{s.structured_formatting.main_text}</span>
                          <span className="address-suggest-sub">{s.structured_formatting.secondary_text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="co-time">Thời gian giao hàng</label>
                <select
                  id="co-time"
                  value={deliveryInfo.deliveryTime}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, deliveryTime: e.target.value }))}
                >
                  <option value="Ban ngày">Ban ngày (8:00 – 18:00)</option>
                  <option value="Ban tối">Ban tối (18:00 – 21:00)</option>
                  <option value="Bất kỳ">Bất kỳ lúc nào</option>
                </select>
              </div>

              <div className="checkout-field full-width">
                <label htmlFor="co-note">Ghi chú giao hàng</label>
                <textarea
                  id="co-note"
                  rows={3}
                  placeholder="Để hàng ở lễ tân, gọi trước khi giao..."
                  value={deliveryInfo.deliveryInstructions}
                  onChange={(e) => setDeliveryInfo((p) => ({ ...p, deliveryInstructions: e.target.value }))}
                />
              </div>
            </div>

            <div className="checkout-form-actions">
              <button
                className="checkout-btn-order"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang đặt hàng..." : "Đặt hàng →"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: order summary ── */}
        <aside className="checkout-summary-card">
          <p className="checkout-section-title">
            Đơn hàng ({selectedItems.length} sản phẩm)
          </p>

          <div className="checkout-items-list">
            {selectedItems.map((item) => (
              <div key={item.cartItemId} className="checkout-item-row">
                <div className="checkout-item-img">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} />
                  ) : (
                    <span className="checkout-item-img-placeholder">👕</span>
                  )}
                </div>

                <div className="checkout-item-info">
                  <span className="checkout-item-name" title={item.productName}>
                    {item.productName}
                  </span>
                  <span className="checkout-item-variant">
                    {item.size} / {item.color}
                  </span>
                  <div className="checkout-item-price-row">
                    <span className="checkout-item-price">{formatCurrency(item.lineTotal)}</span>
                    <span className="checkout-item-qty">×{item.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-totals">
            <div className="checkout-total-row">
              <span>Tạm tính</span>
              <span>{formatCurrency(selectedSubtotal)}</span>
            </div>
            <div className="checkout-total-row">
              <span>Phí vận chuyển</span>
              {shipping ? (
                <span className="checkout-shipping-calculated">
                  {formatCurrency(shipping.shippingFee)}
                </span>
              ) : (
                <span className="checkout-shipping-badge">Chưa tính</span>
              )}
            </div>
            {shipping && (
              <div className="checkout-total-row">
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Khoảng cách</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{shipping.distance}</span>
              </div>
            )}
            <div className="checkout-total-row grand-total">
              <span>Tổng cộng</span>
              <span className="total-amount">{formatCurrency(totalWithShipping)}</span>
            </div>
          </div>

          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.85rem" }}>
             Thanh toán an toàn và bảo mật
          </p>
        </aside>
      </div>
    </div>
  );
}
