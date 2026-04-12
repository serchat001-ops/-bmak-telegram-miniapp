import { createContext, useContext } from 'react';

export interface User {
  id: number;
  email: string;
  display_name: string;
  first_name: string;
  username: string;
  bmak_balance: string;
  total_earned: string;
  checkin_streak: number;
  total_referrals: number;
  wallet_address: string;
  referral_code: string;
  last_checkin: string;
  payout_sent: boolean;
  auth_type: string;
}

export interface Config {
  contractAddress: string;
  network: string;
  chainId: number;
  tokenSymbol: string;
  dailyReward: number;
  referralReward: number;
  adminEmail: string;
}

export interface AuthContextType {
  user: User | null;
  config: Config | null;
  webUid: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string, refCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: User) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
