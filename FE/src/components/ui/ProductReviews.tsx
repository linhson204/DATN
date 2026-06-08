import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { reviewsApi } from "../../api/services";
import { parseApiError } from "../../api/helpers";
import { useAuth } from "../../context/AuthContext";
import type { PageResponse, ReviewItem, ReviewSummary } from "../../types/api";
import { Spinner } from "./Spinner";

interface ProductReviewsProps {
  productId: string;
  /** Callback khi summary load xong – dùng để đồng bộ rating lên parent */
  onSummaryLoaded?: (averageRating: number, totalReviews: number) => void;
}

/** Số sao dạng ★★★★☆ */
function StarDisplay({
  rating,
  size = "1rem",
}: {
  rating: number;
  size?: string;
}) {
  return (
    <span className="star-display" style={{ fontSize: size }} aria-label={`${rating} sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= Math.round(rating) ? "star filled" : "star empty"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/** Interactive star picker */
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <span className="star-picker" role="group" aria-label="Chọn số sao">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn ${star <= (hovered || value) ? "active" : ""}`}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          aria-label={`${star} sao`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/** Rating distribution bar */
function RatingBar({
  star,
  count,
  total,
}: {
  star: number;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rating-bar-row">
      <span className="rating-bar-label">{star}★</span>
      <div className="rating-bar-track">
        <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="rating-bar-count">{count}</span>
    </div>
  );
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ProductReviews({ productId, onSummaryLoaded }: ProductReviewsProps) {
  const { isAuthenticated, user } = useAuth();

  // ── Summary ──
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ── Reviews list ──
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  // ── Write form ──
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Delete ──
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  // ─── Lưu callback vào ref để tránh gây re-trigger useEffect ────
  const onSummaryLoadedRef = useRef(onSummaryLoaded);
  useEffect(() => {
    onSummaryLoadedRef.current = onSummaryLoaded;
  });

  // ─── Load summary ───────────────────────────────────────────
  useEffect(() => {
    setSummaryLoading(true);

    reviewsApi
      .getSummary(productId)
      .then((data) => {
        setSummary(data);
        onSummaryLoadedRef.current?.(data.averageRating, data.totalReviews);
      })
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [productId]); // onSummaryLoaded KHÔNG vào dep array – dùng ref ở trên

  // ─── Load reviews list ───────────────────────────────────────
  useEffect(() => {
    setListLoading(true);
    setReviews([]);

    reviewsApi
      .list(productId, page, 8)
      .then((res: PageResponse<ReviewItem>) => {
        setReviews(res.items);
        setTotalPages(res.totalPages);
      })
      .catch(() => {
        setReviews([]);
      })
      .finally(() => setListLoading(false));
  }, [productId, page]);

  // ─── Reset khi chuyển sản phẩm ──────────────────────────────
  useEffect(() => {
    setPage(0);
    setFormOpen(false);
    setRating(5);
    setComment("");
  }, [productId]);

  // ─── Submit review ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      toast.warning("Vui lòng chọn số sao từ 1 đến 5.");
      return;
    }

    setSubmitting(true);

    try {
      const newReview = await reviewsApi.create(productId, {
        rating,
        comment: comment.trim() || undefined,
      });

      toast.success("Đánh giá của bạn đã được ghi nhận!");
      setFormOpen(false);
      setRating(5);
      setComment("");

      // Prepend vào đầu danh sách
      setReviews((prev) => [newReview, ...prev]);

      // Refresh summary
      reviewsApi.getSummary(productId).then((data) => {
        setSummary(data);
        onSummaryLoadedRef.current?.(data.averageRating, data.totalReviews);
      }).catch(() => null);
    } catch (rawError) {
      const err = parseApiError(rawError);
      if (err.status === 422) {
        if (err.message.toLowerCase().includes("already")) {
          toast.error("Bạn đã đánh giá sản phẩm này rồi.");
        } else {
          toast.error(err.message);
        }
      } else if (err.status === 403) {
        toast.error(
          "Bạn chưa mua sản phẩm này hoặc đơn hàng chưa được giao thành công.",
        );
      } else {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete review ───────────────────────────────────────────
  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá này không?")) return;

    setDeletingId(reviewId);
    try {
      await reviewsApi.remove(productId, reviewId);
      toast.success("Đã xóa đánh giá.");
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      reviewsApi.getSummary(productId).then((data) => {
        setSummary(data);
        onSummaryLoadedRef.current?.(data.averageRating, data.totalReviews);
      }).catch(() => null);
    } catch (rawError) {
      toast.error(parseApiError(rawError).message);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Distribution keys ───────────────────────────────────────
  const distKeys = [5, 4, 3, 2, 1] as const;

  return (
    <section className="product-reviews-panel" id="product-reviews">
      <div className="section-headline">
        <h3>Đánh giá sản phẩm</h3>
      </div>

      {/* ── Summary ── */}
      {summaryLoading ? (
        <Spinner message="Đang tải đánh giá..." />
      ) : summary ? (
        <div className="reviews-summary-box">
          {/* Left: Overall score */}
          <div className="reviews-score-col">
            <p className="reviews-avg-number">
              {summary.averageRating > 0
                ? summary.averageRating.toFixed(1)
                : "–"}
            </p>
            <StarDisplay rating={summary.averageRating} size="1.5rem" />
            <p className="reviews-total-count">
              {summary.totalReviews} đánh giá
            </p>
          </div>

          {/* Right: Distribution bars */}
          <div className="reviews-dist-col">
            {distKeys.map((star) => (
              <RatingBar
                key={star}
                star={star}
                count={summary.ratingDistribution[String(star) as keyof typeof summary.ratingDistribution] ?? 0}
                total={summary.totalReviews}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="placeholder">Chưa có đánh giá nào cho sản phẩm này.</p>
      )}

      {/* ── Write review CTA ── */}
      {isAuthenticated && !formOpen && (
        <button
          type="button"
          className="btn btn-outline reviews-write-btn"
          onClick={() => setFormOpen(true)}
        >
          ✏️ Viết đánh giá
        </button>
      )}

      {!isAuthenticated && (
        <p className="placeholder" style={{ marginTop: "0.6rem" }}>
          <a href="/auth" style={{ color: "var(--accent-cyan)" }}>
            Đăng nhập
          </a>{" "}
          để viết đánh giá.
        </p>
      )}

      {/* ── Write form ── */}
      {formOpen && (
        <form className="review-form reveal-up" onSubmit={handleSubmit}>
          <p className="review-form-title">Đánh giá của bạn</p>

          <div className="review-form-row">
            <label htmlFor="review-rating-picker">Số sao</label>
            <StarPicker value={rating} onChange={setRating} />
            <span className="review-rating-label">
              {["", "Rất tệ", "Tệ", "Bình thường", "Tốt", "Tuyệt vời"][rating]}
            </span>
          </div>

          <div className="review-form-row">
            <label htmlFor="review-comment">Nhận xét (tùy chọn)</label>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={1000}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <span className="review-char-count">{comment.length}/1000</span>
          </div>

          <div className="review-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => {
                setFormOpen(false);
                setRating(5);
                setComment("");
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* ── Review list ── */}
      <div className="reviews-list-section">
        {listLoading ? (
          <Spinner message="Đang tải bình luận..." />
        ) : reviews.length === 0 ? (
          <p className="placeholder" style={{ marginTop: "0.5rem" }}>
            Chưa có bình luận nào.
          </p>
        ) : (
          <ul className="reviews-list">
            {reviews.map((review) => {
              const isOwner = user?.id === review.userId;
              const canDelete = isOwner || isAdmin;

              return (
                <li key={review.id} className="review-card reveal-up">
                  <div className="review-card-header">
                    <div className="review-avatar">
                      {review.userFullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="review-card-meta">
                      <p className="review-author">{review.userFullName}</p>
                      <div className="review-card-meta-row">
                        <StarDisplay rating={review.rating} size="0.95rem" />
                        <span className="review-date">
                          {formatReviewDate(review.createdAt)}
                        </span>
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-danger review-delete-btn"
                        disabled={deletingId === review.id}
                        onClick={() => handleDelete(review.id)}
                        aria-label="Xóa đánh giá"
                      >
                        {deletingId === review.id ? "..." : "✕"}
                      </button>
                    )}
                  </div>

                  {review.comment && (
                    <p className="review-comment">{review.comment}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="reviews-pagination">
            <button
              type="button"
              className="btn btn-muted"
              disabled={page === 0 || listLoading}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Trước
            </button>
            <span className="reviews-page-info">
              Trang {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-muted"
              disabled={page >= totalPages - 1 || listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
