export interface FirmwareSeries {
  id: string;
  name: string;
  description: string;
  icon?: string;
  cover_image?: string;
  homepage?: string;
  tags?: string[];
  /** sha256 前 16 位 */
  firmware_ids: string[];
  supported_product_ids?: string[];
  admin_emails: string[];
  order?: number;
  created_at: string;
  updated_at: string;
  created_by_email?: string;
  updated_by_email?: string;
}

/** 从 sha256（完整或前缀）得到统一的 firmwareId（小写前 16 位） */
export function fwIdFromSha256(sha256?: string | null): string | null {
  if (!sha256) return null;
  const s = sha256.toLowerCase();
  if (s.length < 16) return null;
  return s.slice(0, 16);
}
