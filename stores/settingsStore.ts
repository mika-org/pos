import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxPercentage: number;
}

interface SettingsState {
  settings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        storeName: 'POS System',
        storeAddress: 'Jl. Contoh Alamat No. 123',
        storePhone: '08123456789',
        taxPercentage: 0,
      },
      updateSettings: (newSettings) => 
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
    }),
    {
      name: 'pos-settings-storage',
    }
  )
);
