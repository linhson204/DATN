import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { parseApiError } from "../api/helpers";
import { useAuth } from "../context/AuthContext";

export function OAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { acceptOAuthTokens } = useAuth();

  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      token: params.get("token"),
      refreshToken: params.get("refreshToken"),
      oauthError: params.get("error"),
    };
  }, [location.search]);

  useEffect(() => {
    const run = async () => {
      if (query.oauthError) {
        setError(query.oauthError);
        return;
      }

      if (!query.token || !query.refreshToken) {
        setError("Không nhận được token từ OAuth callback.");
        return;
      }

      try {
        await acceptOAuthTokens(query.token, query.refreshToken);
        navigate("/products", { replace: true });
      } catch (rawError) {
        const apiError = parseApiError(rawError);
        setError(apiError.message);
      }
    };

    void run();
  }, [
    acceptOAuthTokens,
    navigate,
    query.oauthError,
    query.refreshToken,
    query.token,
  ]);

  if (error) {
    return (
      <section className="surface-card auth-card">
        <h2>Đăng nhập OAuth thất bại</h2>
        <p className="alert error">{error}</p>
        <Link className="btn btn-primary" to="/auth">
          Thử lại
        </Link>
      </section>
    );
  }

  return (
    <section className="surface-card auth-card">
      <h2>Đang xử lý đăng nhập Google...</h2>
      <p className="placeholder">Vui lòng chờ trong giây lát.</p>
    </section>
  );
}
