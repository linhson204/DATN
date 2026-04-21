import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cartApi, ordersApi, shippingApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Cart, DeliveryInfo, Order } from "../types/api";
import { formatCurrency } from "../utils/format";

type ShippingState = {
  shippingFee: number;
  distance: number;
} | null;

export function CheckoutPage() {
  const navigate = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [shipping, setShipping] = useState<ShippingState>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    recipientName: "",
    email: "",
    phoneNumber: "",
    address: "",
    deliveryMethod: "Standard",
    deliveryTime: "Ban ngày",
    deliveryInstructions: "",
  });

  useEffect(() => {
    const load = async () => {
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
    };

    void load();
  }, []);

  const selectedItems = useMemo(() => {
    return cart?.items.filter((item) => item.isSelected) || [];
  }, [cart?.items]);

  const selectedSubtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [selectedItems]);

  const totalWithShipping = useMemo(() => {
    return selectedSubtotal + (shipping?.shippingFee || 0);
  }, [selectedSubtotal, shipping?.shippingFee]);

  const calculateShipping = async () => {
    if (!deliveryInfo.address.trim()) {
      setError(
        "Vui lòng nhập địa chỉ giao hàng trước khi tính phí vận chuyển.",
      );
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await shippingApi.fee(deliveryInfo.address.trim());
      setShipping(response);
      setNotice("Đã tính phí vận chuyển thành công.");
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedItems.length === 0) {
      setError("Bạn cần chọn ít nhất một sản phẩm trong giỏ hàng.");
      return;
    }

    const shippingFee = shipping?.shippingFee ?? 0;

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await ordersApi.create({
        status: "PENDING",
        shippingFee,
        deliveryInfo,
      });

      setNotice("Tạo đơn hàng thành công.");

      const orderLike = response as Partial<Order>;
      if (orderLike.id) {
        navigate(`/orders/${orderLike.id}`);
      } else {
        navigate("/orders");
      }
    } catch (rawError) {
      const apiError = parseApiError(rawError);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="surface-card">
        Đang tải thông tin thanh toán...
      </section>
    );
  }

  if (!cart) {
    return <section className="surface-card">Không tải được giỏ hàng.</section>;
  }

  if (selectedItems.length === 0) {
    return (
      <section className="surface-card">
        <h2>Thanh toán</h2>
        <p>
          Không có sản phẩm nào được chọn. Hãy quay lại giỏ hàng và chọn sản
          phẩm cần mua.
        </p>
        <Link className="btn btn-primary" to="/cart">
          Quay lại giỏ hàng
        </Link>
      </section>
    );
  }

  return (
    <section className="checkout-layout reveal-up">
      <article className="surface-card">
        <div className="section-headline">
          <h2>Thông tin giao hàng</h2>
          <p>
            FE gửi shippingFee + deliveryInfo cho endpoint POST /v1/orders.
            Backend sẽ xử lý các sản phẩm đã chọn.
          </p>
        </div>

        {notice && <p className="alert success">{notice}</p>}
        {error && <p className="alert error">{error}</p>}

        <form className="form-grid" onSubmit={submitOrder}>
          <label>
            Tên người nhận
            <input
              required
              value={deliveryInfo.recipientName}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  recipientName: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Email
            <input
              required
              type="email"
              value={deliveryInfo.email}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Số điện thoại
            <input
              required
              value={deliveryInfo.phoneNumber}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  phoneNumber: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Địa chỉ
            <input
              required
              value={deliveryInfo.address}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
            />
          </label>

          <label>
            Phương thức giao hàng
            <input
              required
              value={deliveryInfo.deliveryMethod}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  deliveryMethod: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Thời gian giao hàng
            <input
              required
              value={deliveryInfo.deliveryTime}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  deliveryTime: event.target.value,
                }))
              }
            />
          </label>

          <label className="full-width">
            Ghi chú giao hàng
            <textarea
              rows={3}
              value={deliveryInfo.deliveryInstructions}
              onChange={(event) =>
                setDeliveryInfo((prev) => ({
                  ...prev,
                  deliveryInstructions: event.target.value,
                }))
              }
              placeholder="Để hàng ở lễ tân, gọi trước khi giao..."
            />
          </label>

          <div className="card-actions full-width">
            <button
              className="btn btn-muted"
              type="button"
              disabled={isSubmitting}
              onClick={() => void calculateShipping()}
            >
              Tính phí vận chuyển
            </button>
            <button
              className="btn btn-primary"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Đang tạo đơn..." : "Đặt hàng"}
            </button>
          </div>
        </form>
      </article>

      <aside className="surface-card">
        <div className="section-headline">
          <h3>Tổng kết sản phẩm đã chọn</h3>
        </div>

        <div className="list-stack">
          {selectedItems.map((item) => (
            <article key={item.cartItemId} className="list-item-card">
              <h4>{item.productName}</h4>
              <p>
                {item.size} / {item.color} x {item.quantity}
              </p>
              <p className="price">{formatCurrency(item.lineTotal)}</p>
            </article>
          ))}
        </div>

        <div className="totals-panel compact">
          <p>
            Tạm tính đã chọn:{" "}
            <strong>{formatCurrency(selectedSubtotal)}</strong>
          </p>
          <p>
            Phí vận chuyển:{" "}
            <strong>{formatCurrency(shipping?.shippingFee || 0)}</strong>
          </p>
          <p>
            Khoảng cách: <strong>{shipping?.distance ?? 0} km</strong>
          </p>
          <p>
            Tổng cuối: <strong>{formatCurrency(totalWithShipping)}</strong>
          </p>
        </div>
      </aside>
    </section>
  );
}
