import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productCategoriesApi, ordersApi, productsApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import type { Order, PageResponse, Product, ProductCategory } from "../../types/api";
import "../../styles/DashboardPage.css";

import {
  IconCategory,
  IconDashboard,
  IconHome,
  IconLogout,
  IconOrder,
  IconProduct,
  IconUsers,
} from "./DashboardIcons";
import { type Tab } from "./dashboardTypes";
import { OverviewAdminTab } from "./OverviewAdminTab";
import { ProductsAdminTab } from "./ProductsAdminTab";
import { CategoriesAdminTab } from "./CategoriesAdminTab";
import { OrdersAdminTab } from "./OrdersAdminTab";
import { UsersAdminTab } from "./UsersAdminTab";

// ─────────────────────────────────────────────
// Main DashboardPage – sidebar shell only
// ─────────────────────────────────────────────
export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Shared data for Overview stats
  const [overviewOrders, setOverviewOrders] = useState<PageResponse<Order>>({
    items: [],
    page: 0,
    size: 50,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [overviewProducts, setOverviewProducts] = useState<
    PageResponse<Product>
  >({
    items: [],
    page: 0,
    size: 1,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      setLoadingOrders(true);
      try {
        const [orders, products, cats] = await Promise.all([
          ordersApi.listAdmin(0, 50),
          productsApi.list({ page: 0, size: 1 }),
          productCategoriesApi.list(),
        ]);
        setOverviewOrders(orders);
        setOverviewProducts(products);
        setCategories(cats);
      } catch {
        // silent
      } finally {
        setLoadingOrders(false);
      }
    };
    void fetchOverview();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Tổng quan", icon: <IconDashboard /> },
    { id: "products", label: "Sản phẩm", icon: <IconProduct /> },
    { id: "categories", label: "Danh mục", icon: <IconCategory /> },
    { id: "orders", label: "Đơn hàng", icon: <IconOrder /> },
    { id: "users", label: "Dữ liệu người dùng", icon: <IconUsers /> },
  ];

  const tabTitles: Record<Tab, string> = {
    overview: "Tổng quan",
    products: "Quản lý sản phẩm",
    categories: "Quản lý danh mục",
    orders: "Quản lý đơn hàng",
    users: "Quản lý dữ liệu người dùng",
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-shell">
        {/* ── Sidebar ── */}
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-logo">ST</div>
            <div className="sidebar-brand-text">
              <h2>S and T</h2>
              <span>Admin Dashboard</span>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Dashboard navigation">
            <div className="sidebar-nav-label">Quản lý</div>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-footer-btn home-btn"
              onClick={() => navigate("/")}
            >
              <IconHome />
              Về trang chủ
            </button>
            <button
              type="button"
              className="sidebar-footer-btn"
              onClick={() => void handleLogout()}
            >
              <IconLogout />
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="dashboard-content">
          {/* Topbar */}
          <header className="dashboard-topbar">
            <div>
              <h1>{tabTitles[activeTab]}</h1>
              <div className="topbar-meta">
                {new Date().toLocaleDateString("vi-VN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
            <div className="topbar-user">
              <div className="topbar-user-avatar">
                {(user?.name?.[0] ?? "A").toUpperCase()}
              </div>
              <span>{user?.name ?? "Admin"}</span>
            </div>
          </header>

          {/* Tab Content */}
          <main className="dashboard-main">
            {activeTab === "overview" && (
              <OverviewAdminTab
                orders={overviewOrders}
                products={overviewProducts}
                categories={categories}
                loadingOrders={loadingOrders}
              />
            )}
            {activeTab === "products" && (
              <ProductsAdminTab categories={categories} />
            )}
            {activeTab === "categories" && (
              <CategoriesAdminTab
                categories={categories}
                onCategoriesChange={setCategories}
              />
            )}
            {activeTab === "orders" && <OrdersAdminTab />}
            {activeTab === "users" && <UsersAdminTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
