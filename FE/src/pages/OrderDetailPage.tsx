import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi } from "../api/services";
import { parseApiError } from "../api/helpers";
import type { Order } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await ordersApi.byId(id);
        setOrder(response);
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id]);

  if (isLoading) {
    return (
      <section className="surface-card">Đang tải chi tiết đơn hàng...</section>
    );
  }

  if (error) {
    return <section className="surface-card alert error">{error}</section>;
  }

  if (!order) {
    return <section className="surface-card">Không tìm thấy đơn hàng.</section>;
  }

  return (
    <section className="detail-layout reveal-up">
      <article className="surface-card">
        <div className="section-headline">
          <h2>Order #{order.id}</h2>
          <p>Trạng thái: {order.status}</p>
        </div>

        <div className="stats-row">
          <div>
            <small>Ngày tạo</small>
            <p>{formatDateTime(order.createdAt)}</p>
          </div>
          <div>
            <small>Phí ship</small>
            <p>{formatCurrency(order.shippingFee)}</p>
          </div>
          <div>
            <small>Tổng</small>
            <p className="price">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        <h3>Sản phẩm trong đơn</h3>
        <div className="list-stack">
          {order.items.map((item) => (
            <article className="list-item-card" key={item.orderItemId}>
              <h4>{item.productName}</h4>
              <p>
                SKU: {item.sku} - {item.size}/{item.color}
              </p>
              <p>
                Số lượng: {item.quantity} - Đơn giá:{" "}
                {formatCurrency(item.unitPrice)}
              </p>
              <p className="price">
                Thành tiền: {formatCurrency(item.lineTotal)}
              </p>
            </article>
          ))}
        </div>
      </article>

      <aside className="surface-card">
        <div className="section-headline">
          <h3>Thông tin giao hàng</h3>
        </div>

        <p>Người nhận: {order.deliveryInfo.recipientName}</p>
        <p>Email: {order.deliveryInfo.email}</p>
        <p>Số điện thoại: {order.deliveryInfo.phoneNumber}</p>
        <p>Địa chỉ: {order.deliveryInfo.address}</p>
        <p>Phương thức: {order.deliveryInfo.deliveryMethod}</p>
        <p>Thời gian: {order.deliveryInfo.deliveryTime}</p>
        <p>Ghi chú: {order.deliveryInfo.deliveryInstructions || "-"}</p>

        <Link className="btn btn-outline" to="/orders">
          Quay lại danh sách đơn
        </Link>
      </aside>
    </section>
  );
}
