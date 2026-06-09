export type ApiSuccess<T> = { message: string; data: T; status: number };
export type ApiMessage = { message: string; status: number };
export type ApiError = {
  message: string;
  status: number;
  errors?: Record<string, string> | null;
};

export type UserProfile = {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  address?: string | null;
  gender?: string | null;
  birthYear?: number | null;
  point?: number | null;
  balance?: number | null;
  totalSpent?: number | null;
  membershipLevel?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isActive?: boolean | null;
};

export type UpdateProfilePayload = {
  fullName?: string;
  gender?: string;
  birthYear?: number;
  phoneNumber?: string;
  address?: string;
};

export type LoginResponse = {
  token: string;
  refreshToken: string;
  user: UserProfile;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phoneNumber?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type PageResponse<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ProductCategory = {
  id: string;
  articleType: string;
  subCategory: string;
  masterCategory: string;
};

export type Material = {
  id: string;
  code: string;
  name: string;
  qualityScore: number;
  createdAt: string;
};

export type ProductVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  imageUrls: string[];
  stockQuantity: number;
  originalPrice: number;
  salePrice: number;
  status: boolean;
};

export type ProductAttribute = {
  attributeKey: string;
  attributeValue: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  material: Material | null;
  targetGender: "male" | "female" | "unisex";
  description: string;
  imageUrl: string | null;
  imageUrls: string[];
  originalPrice: number;
  salePrice: number;
  totalStock: number;
  status: boolean;
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  soldCount?: number;
  ratingAverage?: number | null;
  ratingCount?: number;
  /** Từ BE mới: averageRating & totalReviews */
  averageRating?: number | null;
  totalReviews?: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductListQuery = {
  page?: number;
  size?: number;
  sortBy?:
    | "createdAt"
    | "updatedAt"
    | "name"
    | "salePrice"
    | "originalPrice"
    | "totalStock";
  sortDir?: "asc" | "desc";
  name?: string;
  articleType?: string;
  masterCategory?: string;
  subCategory?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type CartItem = {
  cartItemId: string;
  variantId: string;
  productId: string;
  productName: string;
  productBrand: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  isSelected: boolean;
  stockAvailable: number;
  lineTotal: number;
};

export type Cart = {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
};

export type AddCartItemPayload = {
  variantId: string;
  quantity: number;
};

export type DeliveryInfo = {
  id?: string;
  recipientName: string;
  email: string;
  phoneNumber: string;
  address: string;
  deliveryMethod: string;
  deliveryTime: string;
  deliveryInstructions: string;
};

export type OrderItem = {
  orderItemId: string;
  variantId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  sku: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentOrderStatus =
  | "PENDING"
  | "PAID"
  | "UNPAID"

export type PaymentMethod = "COD" | "ZALOPAY" | "MOMO";

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  paymentUrl?: string | null;
  createdAt: string;
  deliveryInfo: DeliveryInfo;
  items: OrderItem[];
};

export type CreateOrderPayload = {
  status: OrderStatus;
  shippingFee: number;
  paymentMethod?: PaymentMethod;
  deliveryInfo: DeliveryInfo;
};

export type RecommendationCandidate = {
  productId: string;
  productName: string;
  brand: string;
  articleType: string;
  targetGender: "male" | "female" | "unisex";
  salePrice: number;
  materialCode: string | null;
  materialQualityScore: number | null;
  totalStock: number;
  status: boolean;
  sources: string[];
};

export type CandidateResponse = {
  seedProductId: string;
  totalCandidates: number;
  candidates: RecommendationCandidate[];
};

export type PersonalizedRecommendResponse = {
  strategy: string | null;
  product_ids: string[];
};

export type SimilarItemScore = {
  productId: string;
  score: number;
};

export type SimilarResponse = {
  productId: string;
  similarItems: SimilarItemScore[];
};

export type ShippingFeeResponse = {
  shippingFee: number;
  distance: string;
};

export type GoongLocationSuggestion = {
  description: string;
  place_id: string;
  compound: {
    district: string;
    commune: string;
    province: string;
  };
  structured_formatting: {
    main_text: string;
    secondary_text: string;
    main_text_matched_substrings: unknown[];
  };
};

export type WishlistItem = {
  wishlistItemId: string;
  productId: string;
  productName: string;
  productBrand: string;
  imageUrl: string | null;
  articleType: string;
  originalPrice: number;
  salePrice: number;
  status: boolean;
  addedAt: string;
};

export type Wishlist = {
  items: WishlistItem[];
  totalItems: number;
};

export type AddWishlistItemPayload = {
  productId: string;
};

// ── Reviews ──

export type ReviewRatingDistribution = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
};

export type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: ReviewRatingDistribution;
};

export type ReviewItem = {
  id: string;
  userId: string;
  userFullName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReviewPayload = {
  rating: number;
  comment?: string;
};
