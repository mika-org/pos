import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface DokuSettings {
  enabled: boolean;
  clientId: string;
  secretKey: string;
  apiKey: string;
  publicKey: string;
  isProduction: boolean;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxPercentage: number;
  qrisImage?: string;
  maxFileSize: number;
  bankAccounts: BankAccount[];
  doku: DokuSettings;
  xenditEnabled: boolean;
  xenditConfigured: boolean;
  xenditEnvironment: 'development' | 'production';
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

export const defaultDokuSettings: DokuSettings = {
  enabled: true,
  clientId: 'BRN-0232-1788668958800',
  secretKey: 'SK-ePUnXcEg73lttDKzMQS5',
  apiKey: 'doku_key_ad4e81ce69f3459c815eae45ba7d8183',
  publicKey: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn+jIsijtvIE9VgD0QLTohw1YcvN3KRWwRx20fpZqz0fwUZYj0AFZ27dzr7ICkzcMVbysaijJXx2/OMMFabEU8aWPOxodSKZLb1Sbax7fpJ3fsE0fu/0ESQPg+zb/v9D2VA2u81YBnbB16hRSf+uP//UYGcZxrFEZSWk6dCKsaDuZEfnRRUwXiyFrdn8B3RPjc1ttAsue9CgXDAtp0WMbzsz2LMwtFxeTpnt/kTdbofR1K6WuwPPxeYKEeh86HHQp4C0to2yGTgo6xSPlUdTs7SNsE6WZhK4hTTnsZ06gx+5WDB6AEfT02nnOrXmK803d7KUGLurFl/Lcp8pGKeuMMwIDAQAB\n-----END PUBLIC KEY-----`,
  isProduction: true,
};

const initialStoreSettings: StoreSettings = {
  storeName: 'ViorePos',
  storeAddress: 'Jl. Merdeka No. 1, Jakarta Pusat',
  storePhone: '08123456789',
  taxPercentage: 0,
  qrisImage: '',
  maxFileSize: 5,
  bankAccounts: defaultBankAccounts,
  doku: defaultDokuSettings,
  xenditEnabled: false,
  xenditConfigured: false,
  xenditEnvironment: 'development',
};

// Safe localStorage loader helper
const getCachedSettings = (): StoreSettings => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('viorepos_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...initialStoreSettings,
          ...parsed,
          doku: {
            ...defaultDokuSettings,
            ...(parsed.doku || {})
          }
        };
      }
    } catch {
      // Fallback
    }
  }
  return initialStoreSettings;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: getCachedSettings(),
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

        let parsedDoku = defaultDokuSettings;
        try {
          if (data.doku_settings) {
            parsedDoku = { ...defaultDokuSettings, ...JSON.parse(data.doku_settings) };
          }
        } catch (e) {
          console.error("Failed to parse doku_settings JSON", e);
        }

        const newSettings: StoreSettings = {
          storeName: data.storeName || get().settings.storeName,
          storeAddress: data.storeAddress || get().settings.storeAddress,
          storePhone: data.storePhone || get().settings.storePhone,
          taxPercentage: Number(data.taxPercentage || 0),
          qrisImage: data.qrisImage || '',
          maxFileSize: data.maxFileSize !== undefined && data.maxFileSize !== null ? Number(data.maxFileSize) : 5,
          bankAccounts: parsedBanks && parsedBanks.length > 0 ? parsedBanks : (get().settings.bankAccounts || defaultBankAccounts),
          doku: parsedDoku,
          xenditEnabled: Boolean(data.xenditEnabled),
          xenditConfigured: Boolean(data.xenditConfigured),
          xenditEnvironment: data.xenditEnvironment === 'production' ? 'production' : 'development',
        };

        set({ settings: newSettings });

        if (typeof window !== 'undefined') {
          localStorage.setItem('viorepos_settings', JSON.stringify(newSettings));
        }
      } else if (error && error.code === 'PGRST116') {
        // Record belum ada di PostgreSQL, buat nilai default untuk tenant ini.
        const currentSettings = get().settings;
        await supabase.from('settings').insert({
          id: 'default',
          storeName: currentSettings.storeName,
          storeAddress: currentSettings.storeAddress,
          storePhone: currentSettings.storePhone,
          taxPercentage: currentSettings.taxPercentage,
          qrisImage: currentSettings.qrisImage,
          maxFileSize: currentSettings.maxFileSize,
          bank_accounts: JSON.stringify(currentSettings.bankAccounts),
          doku_settings: JSON.stringify(currentSettings.doku),
          xenditEnabled: currentSettings.xenditEnabled,
          xenditConfigured: currentSettings.xenditConfigured,
          xenditEnvironment: currentSettings.xenditEnvironment,
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings from PostgreSQL:', err);
    } finally {
      set({ isLoading: false });
    }
  },
  updateSettings: async (newSettings) => {
    const updatedSettings: StoreSettings = {
      ...get().settings,
      ...newSettings,
      doku: {
        ...get().settings.doku,
        ...(newSettings.doku || {})
      }
    };

    set({ settings: updatedSettings });

    // Cache locally immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('viorepos_settings', JSON.stringify(updatedSettings));
    }

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
          doku_settings: JSON.stringify(updatedSettings.doku),
          xenditEnabled: updatedSettings.xenditEnabled,
          xenditConfigured: updatedSettings.xenditConfigured,
          xenditEnvironment: updatedSettings.xenditEnvironment,
          updatedAt: Date.now()
        });
      if (error) {
        console.error('Failed to save settings to PostgreSQL:', error);
      }
    } catch (err) {
      console.error('Failed to save settings to PostgreSQL:', err);
    }
  }
}));
