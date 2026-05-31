import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Offer = {
  id: number;
  geo_code: string;
  offer_code: string;
  country_name: string;
  offer_name: string;
  crm_id: string;
  active: boolean;
};

export type Entry = {
  id: number;
  date: string;
  account_id_fb: string | null;
  campaign_name: string | null;
  geo_code: string | null;
  offer_id: number | null;
  spend: number;
  deposits: number;
  payout_per_dep: number;
  note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  offers?: Offer;
};

export type DailyResult = {
  id: number;
  date: string;
  offer_id: number;
  deposits: number;
  payout_per_dep: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  offers?: Offer;
};
