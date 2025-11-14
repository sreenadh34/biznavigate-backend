/**
 * Notification Preference Entity
 * User/Customer notification preferences
 */

export class NotificationPreference {
  preference_id: string;

  // Owner (customer or user)
  customer_id?: string;
  user_id?: string;
  business_id?: string;

  // Channel preferences
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;

  // Notification type preferences
  preferences: {
    order_updates: boolean;
    payment_updates: boolean;
    promotional: boolean;
    newsletters: boolean;
    account_updates: boolean;
    [key: string]: boolean;
  };

  // Quiet hours
  quiet_hours: {
    enabled: boolean;
    start: string; // e.g., "22:00"
    end: string; // e.g., "08:00"
  };

  // Preferred channels per notification type
  channel_preferences: Record<string, string[]>;

  // Metadata
  created_at: Date;
  updated_at: Date;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationTypePreferences {
  order_updates: boolean;
  payment_updates: boolean;
  promotional: boolean;
  newsletters: boolean;
  account_updates: boolean;
}
