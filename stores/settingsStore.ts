import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxPercentage: number;
  qrisImage?: string;
}

interface SettingsState {
  settings: StoreSettings;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    storeName: 'POS System',
    storeAddress: 'Jl. Contoh Alamat No. 123',
    storePhone: '08123456789',
    taxPercentage: 0,
    qrisImage: '',
  },
  isLoading: false,
  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (data && !error) {
        set({
          settings: {
            storeName: data.storeName,
            storeAddress: data.storeAddress,
            storePhone: data.storePhone,
            taxPercentage: Number(data.taxPercentage),
            qrisImage: data.qrisImage || '',
          }
        });
      } else if (error && error.code === 'PGRST116') {
        // Record doesn't exist on Supabase, insert the default one
        const defaultSettings = get().settings;
        await supabase.from('settings').insert({
          id: 'default',
          storeName: defaultSettings.storeName,
          storeAddress: defaultSettings.storeAddress,
          storePhone: defaultSettings.storePhone,
          taxPercentage: defaultSettings.taxPercentage,
          qrisImage: defaultSettings.qrisImage,
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings from Supabase:', err);
    } finally {
      set({ isLoading: false });
    }
  },
  updateSettings: async (newSettings) => {
    const updatedSettings = { ...get().settings, ...newSettings };
    set({ settings: updatedSettings });
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 'default',
          storeName: updatedSettings.storeName,
          storeAddress: updatedSettings.storeAddress,
          storePhone: updatedSettings.storePhone,
          taxPercentage: updatedSettings.taxPercentage,
          qrisImage: updatedSettings.qrisImage,
          updatedAt: Date.now()
        });
      if (error) {
        console.error('Failed to save settings to Supabase:', error);
      }
    } catch (err) {
      console.error('Failed to save settings to Supabase:', err);
    }
  }
}));
