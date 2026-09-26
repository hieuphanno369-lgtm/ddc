export type NotifyErrorCode =
  | 'invalid_url'
  | 'bad_protocol'
  | 'has_credentials'
  | 'host_not_allowed'
  | 'blocked_ip'
  | 'too_long'
  | 'dns_failed'
  | 'timeout'
  | 'conn_failed'
  | `http_${number}`
  | 'secret_missing'
  | 'secret_key_missing'
  | 'secret_decrypt_failed'
  | 'no_recipients'
  | 'smtp_auth'
  | 'smtp_conn'
  | 'smtp_rejected'
  | 'email_unavailable'
  | 'bad_config';

export type SendResult = { ok: true } | { ok: false; error: NotifyErrorCode };

export type LookupFn = (host: string) => Promise<Array<{ address: string; family: number }>>;
