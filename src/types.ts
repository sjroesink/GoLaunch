export interface LaunchItem {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  action_type: string;
  action_value: string;
  category: string;
  tags: string;
  frequency: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
