import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxPercentage: number;
  qrisImage?: string;
  maxFileSize: number;
  bankAccounts: BankAccount[];
}

interface SettingsState {
  settings: StoreSettings;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
}

const defaultBankAccounts: BankAccount[] = [
  {
    id: 'default_bca',
    bankName: 'Bank BCA',
    accountNumber: '8015-3928-11',
    accountHolder: 'PT POS Sukses Makmur'
  }
];

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    storeName: 'POS System',
    storeAddress: 'Jl. Contoh Alamat No. 123',
    storePhone: '08123456789',
    taxPercentage: 0,
    qrisImage: '',
    maxFileSize: 5,
    bankAccounts: defaultBankAccounts,
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
        let parsedBanks = [];
        try {
          parsedBanks = data.bank_accounts ? JSON.parse(data.bank_accounts) : [];
        } catch (e) {
          console.error("Failed to parse bank accounts JSON", e);
        }

        set({
          settings: {
            storeName: data.storeName,
            storeAddress: data.storeAddress,
            storePhone: data.storePhone,
            taxPercentage: Number(data.taxPercentage),
            qrisImage: data.qrisImage || '',
            maxFileSize: data.maxFileSize !== undefined && data.maxFileSize !== null ? Number(data.maxFileSize) : 5,
            bankAccounts: parsedBanks && parsedBanks.length > 0 ? parsedBanks : defaultBankAccounts,
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
          maxFileSize: defaultSettings.maxFileSize,
          bank_accounts: JSON.stringify(defaultSettings.bankAccounts),
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
          maxFileSize: updatedSettings.maxFileSize,
          bank_accounts: JSON.stringify(updatedSettings.bankAccounts),
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
