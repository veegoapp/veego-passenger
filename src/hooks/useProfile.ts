import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

export interface UserProfile {
  id: number | null;
  name: string;
  email: string;
  dob: string;
  phone: string;
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
}

const EMPTY_PROFILE: UserProfile = {
  id: null,
  name: '',
  email: '',
  dob: '',
  phone: '',
  biometricEnabled: false,
  twoFactorEnabled: false,
};

interface UseProfileResult {
  profile: UserProfile;
  loading: boolean;
  error: string | null;
  saveProfile: (updates: Partial<Omit<UserProfile, 'id'>>) => Promise<{ success: boolean; error?: string }>;
  refresh: () => void;
}

function mapApiProfile(d: any): UserProfile {
  return {
    id: d.id ?? d.userId ?? d.user_id ?? null,
    name: d.name ?? d.fullName ?? d.displayName ?? '',
    email: d.email ?? d.emailAddress ?? '',
    dob: d.dob ?? d.dateOfBirth ?? d.birthdate ?? '',
    phone: d.phone ?? d.phoneNumber ?? d.mobile ?? '',
    biometricEnabled: d.biometricEnabled ?? d.biometric_enabled ?? false,
    twoFactorEnabled: d.twoFactorEnabled ?? d.two_factor_enabled ?? d.twoFA ?? false,
  };
}

export const BIOMETRIC_KEY = 'veego_biometric';
export const TWO_FA_KEY = 'veego_2fa';

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/users/me');
      const d = data.user ?? data.profile ?? data;
      setProfile(mapApiProfile(d));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveProfile = useCallback(async (updates: Partial<Omit<UserProfile, 'id'>>) => {
    try {
      const { data } = await api.patch('/users/me', updates);
      const d = data.user ?? data.profile ?? data;
      setProfile((prev) => ({ ...prev, ...mapApiProfile(d) }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.response?.data?.error ?? e?.response?.data?.message ?? 'Save failed' };
    }
  }, []);

  return { profile, loading, error, saveProfile, refresh: fetchProfile };
}
