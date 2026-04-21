import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { authApi } from "../api/services";
import type {
  ApiMessage,
  LoginPayload,
  RegisterPayload,
  UserProfile,
} from "../types/api";
import { authStorage } from "../utils/storage";

type AuthContextValue = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<ApiMessage>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  acceptOAuthTokens: (
    accessToken: string,
    refreshToken: string,
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(authStorage.getUser());
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const accessToken = authStorage.getAccessToken();

    if (!accessToken) {
      setUser(null);
      return;
    }

    const profile = await authApi.me();
    setUser(profile);
    authStorage.setUser(profile);
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        await refreshProfile();
      } catch {
        authStorage.clear();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void boot();
  }, [refreshProfile]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authApi.login(payload);

    authStorage.setAccessToken(response.token);
    authStorage.setRefreshToken(response.refreshToken);
    authStorage.setUser(response.user);

    setUser(response.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    return authApi.register(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (authStorage.getAccessToken()) {
        await authApi.logout();
      }
    } catch {
      // Ignore logout errors and clear local session anyway.
    } finally {
      authStorage.clear();
      setUser(null);
    }
  }, []);

  const acceptOAuthTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      authStorage.setAccessToken(accessToken);
      authStorage.setRefreshToken(refreshToken);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      refreshProfile,
      acceptOAuthTokens,
    }),
    [
      acceptOAuthTokens,
      isLoading,
      login,
      logout,
      refreshProfile,
      register,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
