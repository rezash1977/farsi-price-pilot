-- Harden sensitive data handling for WhatsApp sessions
BEGIN;

-- 1) Ensure sensitive fields are always encrypted and plaintext cleared
DROP TRIGGER IF EXISTS trg_encrypt_whatsapp_session_data ON public.whatsapp_sessions;
CREATE TRIGGER trg_encrypt_whatsapp_session_data
BEFORE INSERT OR UPDATE ON public.whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_whatsapp_session_data();

-- 2) Ensure updated_at is maintained automatically
DROP TRIGGER IF EXISTS trg_update_whatsapp_sessions_updated_at ON public.whatsapp_sessions;
CREATE TRIGGER trg_update_whatsapp_sessions_updated_at
BEFORE UPDATE ON public.whatsapp_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Backfill: encrypt any existing plaintext values and clear them
UPDATE public.whatsapp_sessions
SET
  qr_code_encrypted = COALESCE(qr_code_encrypted, public.encrypt_session_data(qr_code, COALESCE(encryption_key_id, 'v1'))),
  phone_number_encrypted = COALESCE(phone_number_encrypted, public.encrypt_session_data(phone_number, COALESCE(encryption_key_id, 'v1'))),
  qr_code = NULL,
  phone_number = NULL
WHERE (qr_code IS NOT NULL OR phone_number IS NOT NULL);

-- 4) Cleanup any expired QR codes immediately
SELECT public.cleanup_expired_qr_codes();

-- 5) Restrict access beyond RLS: block direct table access for client roles
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sessions FROM anon, authenticated;

COMMIT;