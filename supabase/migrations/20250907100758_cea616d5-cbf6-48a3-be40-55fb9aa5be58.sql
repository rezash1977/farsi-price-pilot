-- Complete security improvements for whatsapp_sessions table

-- Only add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_sessions' AND column_name = 'qr_expires_at') THEN
        ALTER TABLE public.whatsapp_sessions 
        ADD COLUMN qr_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '5 minutes');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_sessions' AND column_name = 'encryption_key_id') THEN
        ALTER TABLE public.whatsapp_sessions 
        ADD COLUMN encryption_key_id TEXT DEFAULT 'v1';
    END IF;
END $$;

-- Create indexes (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_qr_expires_at ON public.whatsapp_sessions(qr_expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_created_at ON public.whatsapp_sessions(created_at);

-- Create security functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create secure QR code access function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create automatic cleanup function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security trigger for automatic encryption
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS encrypt_whatsapp_session_trigger ON public.whatsapp_sessions;
CREATE TRIGGER encrypt_whatsapp_session_trigger
    BEFORE INSERT OR UPDATE ON public.whatsapp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.encrypt_whatsapp_session_data();