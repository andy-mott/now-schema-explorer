export interface ServiceNowCredentials {
  url: string;
  username: string;
  password: string;
}

// With sysparm_display_value=all, all fields come back as { display_value, value } objects
type SnField = { display_value: string; value: string } | string;

export interface SysDbObjectRecord {
  sys_id: SnField;
  name: SnField;
  label: SnField;
  super_class: SnField;
  sys_scope: SnField;
  is_extendable: SnField;
  accessible_from: SnField;
  number_ref: SnField;
}

export interface SysDictionaryRecord {
  sys_id: SnField;
  name: SnField;
  element: SnField;
  column_label: SnField;
  internal_type: SnField;
  max_length: SnField;
  mandatory: SnField;
  read_only: SnField;
  active: SnField;
  reference: SnField;
  default_value: SnField;
  display: SnField;
  primary: SnField;
}

export interface ServiceNowApiResponse<T> {
  result: T[];
}

export interface IngestProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}
