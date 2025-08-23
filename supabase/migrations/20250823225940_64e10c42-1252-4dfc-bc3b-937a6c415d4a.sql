-- Create enums first
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');
CREATE TYPE public.device_state AS ENUM ('active', 'not_active');
CREATE TYPE public.ocr_status AS ENUM ('queued', 'processing', 'done', 'failed');
CREATE TYPE public.source_type AS ENUM ('upload', 'whatsapp');
CREATE TYPE public.alert_condition AS ENUM ('lt', 'lte', 'eq');
CREATE TYPE public.notification_channel AS ENUM ('email', 'whatsapp', 'telegram');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE public.integration_type AS ENUM ('openai', 'whatsapp', 'telegram', 'email');

-- Organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendors table
CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_official BOOLEAN NOT NULL DEFAULT false,
    contact_info JSONB DEFAULT '{}',
    trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, name)
);

-- Devices table
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, normalized_name)
);

-- Variants table
CREATE TABLE public.variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    ram_gb INTEGER NOT NULL,
    storage_gb INTEGER NOT NULL,
    color TEXT NOT NULL,
    active_state public.device_state NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uploads table
CREATE TABLE public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    ocr_status public.ocr_status NOT NULL DEFAULT 'queued',
    row_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table (WhatsApp metadata)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    has_media BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Media files table
CREATE TABLE public.media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    ocr_status public.ocr_status NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prices table
CREATE TABLE public.prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
    price_toman NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'تومان',
    source public.source_type NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_file_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    is_outlier BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price history daily (aggregated data)
CREATE TABLE public.price_history_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    min_price NUMERIC NOT NULL,
    avg_price NUMERIC NOT NULL,
    max_price NUMERIC NOT NULL,
    sample_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(variant_id, day)
);

-- OCR rows staging
CREATE TABLE public.ocr_rows_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    media_file_id UUID REFERENCES public.media_files(id) ON DELETE CASCADE,
    raw_json JSONB NOT NULL,
    normalized JSONB,
    mapped BOOLEAN NOT NULL DEFAULT false,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((upload_id IS NOT NULL) OR (media_file_id IS NOT NULL))
);

-- Alerts table
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
    condition public.alert_condition NOT NULL,
    threshold_toman NUMERIC NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    channel public.notification_channel NOT NULL,
    status public.notification_status NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Integrations table
CREATE TABLE public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type public.integration_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, type)
);

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_prices_variant_observed ON public.prices(variant_id, observed_at DESC);
CREATE INDEX idx_prices_vendor_observed ON public.prices(vendor_id, observed_at DESC);
CREATE INDEX idx_prices_price_toman ON public.prices(price_toman);
CREATE INDEX idx_variants_device ON public.variants(device_id);
CREATE INDEX idx_devices_org ON public.devices(org_id);
CREATE INDEX idx_vendors_org ON public.vendors(org_id);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_rows_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Organizations - users can only see their own org
CREATE POLICY "Users can view their organization" ON public.organizations
    FOR SELECT USING (id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Profiles - users can see profiles in their org
CREATE POLICY "Users can view profiles in their org" ON public.profiles
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Generic org-scoped policies for all other tables
CREATE POLICY "Users can access data in their org" ON public.vendors
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.devices
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.variants
    FOR ALL USING (device_id IN (SELECT id FROM public.devices WHERE org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can access data in their org" ON public.uploads
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.messages
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.media_files
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.prices
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.price_history_daily
    FOR ALL USING (variant_id IN (SELECT id FROM public.variants WHERE device_id IN (SELECT id FROM public.devices WHERE org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))));

CREATE POLICY "Users can access data in their org" ON public.ocr_rows_staging
    FOR ALL USING (
        (upload_id IN (SELECT id FROM public.uploads WHERE org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())))
        OR 
        (media_file_id IN (SELECT id FROM public.media_files WHERE org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())))
    );

CREATE POLICY "Users can access data in their org" ON public.alerts
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.notifications
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.integrations
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can access data in their org" ON public.audit_logs
    FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Create a new organization for the user
    INSERT INTO public.organizations (name) 
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' Organization')
    RETURNING id INTO org_id;
    
    -- Create the user profile as owner
    INSERT INTO public.profiles (id, org_id, full_name, role)
    VALUES (
        NEW.id, 
        org_id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'owner'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();