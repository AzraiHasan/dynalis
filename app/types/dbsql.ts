export interface Site {
  id: string;
  site_id: string;
  exp_date: string | null;
  total_rental: number;
  total_payment_to_pay: number;
  deposit: number;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Omit<Site, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Site, 'id'>> & { updated_at?: string };
      };
    };
  };
}