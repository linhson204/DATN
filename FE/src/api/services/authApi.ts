import { http } from "../client";
import { unwrapApiResponse } from "../helpers";
import type {
  ApiMessage,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  UserProfile,
} from "../../types/api";

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const response = await http.post<LoginResponse>("/v1/auth/login", payload);
    return response.data;
  },

  async register(payload: RegisterPayload): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/auth/register", payload);
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async me(): Promise<UserProfile> {
    const response = await http.get<unknown>("/v1/users/me");
    return unwrapApiResponse<UserProfile>(response.data);
  },

  async logout(): Promise<ApiMessage> {
    const response = await http.get<unknown>("/v1/auth/logout");
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async sendOtp(email: string, type: string = "FORGOT_PASSWORD"): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/auth/send-otp", { email, type });
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async verifyOtpEmail(email: string, otpCode: string): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/auth/verify-email", { email, otpCode });
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async verifyOtpForgotPassword(email: string, otpCode: string): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/auth/verify-otp-forgot-password", { email, otpCode });
    return unwrapApiResponse<ApiMessage>(response.data);
  },

  async resetPassword(payload: { email: string; otpCode: string; newPassword: string }): Promise<ApiMessage> {
    const response = await http.post<unknown>("/v1/auth/reset-password", payload);
    return unwrapApiResponse<ApiMessage>(response.data);
  },
};
