// Database type definitions
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      resorts: {
        Row: {
          id: string
          name: string
          resort_type: 'value' | 'moderate' | 'deluxe' | 'partner' | 'villa'
          official_disney: boolean
          location: string | null
          address: string | null
          website_url: string | null
          image_url: string | null
          amenities: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['resorts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['resorts']['Insert']>
      }
      
      deals: {
        Row: {
          id: string
          resort_id: string | null
          source_id: string | null
          title: string
          description: string | null
          deal_type: 'room_discount' | 'free_dining' | 'room_upgrade' | 'package_discount' | 'free_nights' | 'passholder_exclusive' | 'other'
          discount_percentage: number | null
          discount_amount: number | null
          original_price: number | null
          deal_price: number | null
          valid_from: string
          valid_to: string
          booking_deadline: string | null
          travel_valid_from: string | null
          travel_valid_to: string | null
          blackout_dates: Json
          minimum_nights: number | null
          maximum_nights: number | null
          room_types: string[] | null
          ticket_required: boolean
          dining_plan_included: boolean
          deal_code: string | null
          terms_and_conditions: string | null
          source_url: string
          is_active: boolean
          priority: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['deals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
      }

      price_history: {
        Row: {
          id: string
          resort_id: string | null
          deal_id: string | null
          check_in_date: string
          check_out_date: string
          room_type: string | null
          price_per_night: number
          total_price: number
          currency: string
          source: string | null
          snapshot_date: string
          metadata: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['price_history']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>
      }

      user_alerts: {
        Row: {
          id: string
          user_id: string | null
          alert_name: string
          target_check_in_date: string | null
          target_check_out_date: string | null
          flexible_dates: boolean
          date_range_buffer_days: number
          resort_ids: string[]
          resort_types: string[]
          include_partner_hotels: boolean
          min_discount_percentage: number | null
          max_price_per_night: number | null
          deal_types: string[]
          require_dining_plan: boolean
          passholder_only: boolean
          email_notifications: boolean
          push_notifications: boolean
          notification_frequency: 'immediate' | 'daily' | 'weekly'
          last_notified_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_alerts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_alerts']['Insert']>
      }

      alert_matches: {
        Row: {
          id: string
          alert_id: string
          deal_id: string
          match_score: number
          was_notified: boolean
          notified_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['alert_matches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['alert_matches']['Insert']>
      }

      deal_calendar_cache: {
        Row: {
          cache_date: string
          deal_count: number
          best_discount_percentage: number | null
          best_deal_id: string | null
          deal_quality: 'excellent' | 'great' | 'good' | 'standard' | 'none' | null
          deals_by_type: Json
          last_updated: string
        }
        Insert: Omit<Database['public']['Tables']['deal_calendar_cache']['Row'], 'last_updated'>
        Update: Partial<Database['public']['Tables']['deal_calendar_cache']['Insert']>
      }

      deal_sources: {
        Row: {
          id: string
          name: string
          source_type: 'rss' | 'website' | 'email' | 'api' | 'manual'
          source_url: string | null
          is_active: boolean
          last_checked_at: string | null
          check_frequency_minutes: number
          error_count: number
          last_error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['deal_sources']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['deal_sources']['Insert']>
      }
    }
    Views: {}
    Functions: {
      calculate_deal_quality: {
        Args: { discount_pct: number }
        Returns: string
      }
      refresh_deal_calendar_cache: {
        Args: { start_date: string; end_date: string }
        Returns: void
      }
    }
  }
}

// Helper types
export type Resort = Database['public']['Tables']['resorts']['Row']
export type Deal = Database['public']['Tables']['deals']['Row']
export type PriceHistory = Database['public']['Tables']['price_history']['Row']
export type UserAlert = Database['public']['Tables']['user_alerts']['Row']
export type AlertMatch = Database['public']['Tables']['alert_matches']['Row']
export type DealCalendarCache = Database['public']['Tables']['deal_calendar_cache']['Row']
export type DealSource = Database['public']['Tables']['deal_sources']['Row']

// Extended types with relations
export type DealWithResort = Deal & {
  resort: Resort | null
}

export type DealCalendarDay = {
  date: Date
  dateString: string
  dealCount: number
  bestDiscount: number | null
  dealQuality: 'excellent' | 'great' | 'good' | 'standard' | 'none'
  deals: DealWithResort[]
}

export type DateRange = {
  from: Date | null
  to: Date | null
}

export type DealFilters = {
  resortTypes?: string[]
  dealTypes?: string[]
  minDiscount?: number
  maxPrice?: number
  includePartnerHotels?: boolean
  passholderOnly?: boolean
  dateRange?: DateRange
}
