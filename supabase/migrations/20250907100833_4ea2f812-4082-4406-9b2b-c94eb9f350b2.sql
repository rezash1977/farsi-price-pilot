-- Fix security warnings by setting proper search_path for functions

-- Update encrypt_session_data function with secure search_path
CREATE OR REPLACE FUNCTION public.encrypt_session_data(data TEXT, key_id TEXT DEFAULT 'v1')
RETURNS TEXT AS $$
DECLARE
    encrypted_data TEXT;
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Simple base64 encryption (use proper encryption in production)
    encrypted_data := encode(data::bytea, 'base64');
    
    RETURN encrypted_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update decrypt_session_data function with secure search_path
CREATE OR REPLACE FUNCTION public.decrypt_session_data(encrypted_data TEXT, key_id TEXT DEFAULT 'v1')
RETURNS TEXT AS $$
DECLARE
    decrypted_data TEXT;
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    BEGIN
        decrypted_data := convert_from(decode(encrypted_data, 'base64'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    
    RETURN decrypted_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_whatsapp_qr_code function with secure search_path
CREATE OR REPLACE FUNCTION public.get_whatsapp_qr_code(session_id_param TEXT)
RETURNS TABLE(qr_code TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN ws.qr_expires_at > now() THEN 
                COALESCE(
                    public.decrypt_session_data(ws.qr_code_encrypted, ws.encryption_key_id),
                    ws.qr_code
                )
            ELSE NULL
        END as qr_code,
        ws.qr_expires_at as expires_at
    FROM public.whatsapp_sessions ws
    WHERE ws.session_id = session_id_param
    AND ws.user_id = auth.uid()
    AND ws.qr_expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update cleanup_expired_qr_codes function with secure search_path
CREATE OR REPLACE FUNCTION public.cleanup_expired_qr_codes()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE public.whatsapp_sessions 
    SET qr_code = NULL, 
        qr_code_encrypted = NULL,
        status = CASE 
            WHEN connected = true THEN status 
            ELSE 'expired'
        END
    WHERE qr_expires_at < now() 
    AND (qr_code IS NOT NULL OR qr_code_encrypted IS NOT NULL);
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update encrypt_whatsapp_session_data function with secure search_path
CREATE OR REPLACE FUNCTION public.encrypt_whatsapp_session_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt QR code and set expiration
    IF NEW.qr_code IS NOT NULL AND (OLD.qr_code IS NULL OR NEW.qr_code != OLD.qr_code) THEN
        NEW.qr_code_encrypted := public.encrypt_session_data(NEW.qr_code, NEW.encryption_key_id);
        NEW.qr_code := NULL; -- Clear plain text after encryption
        NEW.qr_expires_at := now() + interval '5 minutes';
    END IF;
    
    -- Encrypt phone number
    IF NEW.phone_number IS NOT NULL AND (OLD.phone_number IS NULL OR NEW.phone_number != OLD.phone_number) THEN
        NEW.phone_number_encrypted := public.encrypt_session_data(NEW.phone_number, NEW.encryption_key_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;