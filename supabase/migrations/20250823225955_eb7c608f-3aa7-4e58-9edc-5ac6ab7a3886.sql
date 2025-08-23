-- Fix security issue: Set stable search_path for the function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;