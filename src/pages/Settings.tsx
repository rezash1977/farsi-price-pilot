import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, User, Building, Database, Bell, Shield, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: 'owner' | 'admin' | 'viewer';
  created_at: string;
  org_id: string;
}

export default function Settings() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user?.id
  });

  const { data: organization } = useQuery({
    queryKey: ['organization', profile?.org_id],
    queryFn: async () => {
      if (!profile?.org_id) return null;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single();
      
      if (error) throw error;
      return data as Organization;
    },
    enabled: !!profile?.org_id
  });

  const { data: databaseStats } = useQuery({
    queryKey: ['database_stats'],
    queryFn: async () => {
      const [devicesRes, pricesRes, alertsRes, vendorsRes] = await Promise.all([
        supabase.from('devices').select('id', { count: 'exact' }),
        supabase.from('prices').select('id', { count: 'exact' }),
        supabase.from('alerts').select('id', { count: 'exact' }),
        supabase.from('vendors').select('id', { count: 'exact' })
      ]);

      return {
        devices: devicesRes.count || 0,
        prices: pricesRes.count || 0,
        alerts: alertsRes.count || 0,
        vendors: vendorsRes.count || 0
      };
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !fullName.trim()) return;
      
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'پروفایل به‌روزرسانی شد',
        description: 'اطلاعات پروفایل شما با موفقیت ذخیره شد'
      });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => {
      toast({
        title: 'خطا در به‌روزرسانی',
        description: 'مشکلی در ذخیره اطلاعات پیش آمد',
        variant: 'destructive'
      });
    }
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const { data: prices } = await supabase
        .from('prices')
        .select(`
          *,
          variant:variants(*,
            device:devices(*)
          ),
          vendor:vendors(*)
        `)
        .order('observed_at', { ascending: false })
        .limit(1000);

      const csvContent = [
        ['تاریخ', 'برند', 'مدل', 'رنگ', 'حافظه', 'ذخیره‌سازی', 'قیمت', 'فروشنده'].join(','),
        ...(prices || []).map(price => [
          new Date(price.observed_at).toLocaleDateString('fa-IR'),
          price.variant?.device?.brand || '',
          price.variant?.device?.model || '',
          price.variant?.color || '',
          `${price.variant?.ram_gb}GB` || '',
          `${price.variant?.storage_gb}GB` || '',
          price.price_toman,
          price.vendor?.name || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `prices_export_${new Date().getTime()}.csv`;
      link.click();
    },
    onSuccess: () => {
      toast({
        title: 'داده‌ها صادر شد',
        description: 'فایل CSV با موفقیت دانلود شد'
      });
    }
  });

  // Initialize form values when data loads
  useState(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
    if (organization) {
      setOrgName(organization.name || '');
    }
  });

  const getRoleText = (role: string) => {
    switch (role) {
      case 'owner': return 'مالک';
      case 'admin': return 'مدیر';
      case 'viewer': return 'بیننده';
      default: return role;
    }
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">تنظیمات</h1>
        <p className="text-muted-foreground mt-2">
          مدیریت حساب کاربری، سازمان و تنظیمات سیستم
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            اطلاعات پروفایل
          </CardTitle>
          <CardDescription>
            ویرایش اطلاعات شخصی و حساب کاربری
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                ایمیل قابل تغییر نیست
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullname">نام کامل</Label>
              <Input
                id="fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="نام و نام خانوادگی"
              />
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">نقش:</p>
                <Badge variant="outline">
                  {getRoleText(profile.role)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عضویت از:</p>
                <p className="text-sm">{formatDate(profile.created_at)}</p>
              </div>
            </div>
          )}

          <Button 
            onClick={() => updateProfileMutation.mutate()}
            disabled={!fullName.trim() || updateProfileMutation.isPending}
          >
            ذخیره تغییرات
          </Button>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            تنظیمات سازمان
          </CardTitle>
          <CardDescription>
            اطلاعات سازمان و تیم
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {organization && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>نام سازمان</Label>
                <Input
                  value={organization.name}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  برای تغییر نام سازمان با پشتیبانی تماس بگیرید
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">تاریخ ایجاد:</p>
                <p className="text-sm">{formatDate(organization.created_at)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            تنظیمات اعلان‌ها
          </CardTitle>
          <CardDescription>
            مدیریت اعلان‌ها و هشدارها
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">اعلان‌های ایمیل</p>
              <p className="text-sm text-muted-foreground">
                دریافت اعلان‌ها از طریق ایمیل
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">هشدار تغییر قیمت</p>
              <p className="text-sm text-muted-foreground">
                اعلان فوری هنگام تغییر قیمت‌های مهم
              </p>
            </div>
            <Switch
              checked={priceAlerts}
              onCheckedChange={setPriceAlerts}
            />
          </div>
        </CardContent>
      </Card>

      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            آمار پایگاه داده
          </CardTitle>
          <CardDescription>
            آمار و اطلاعات ذخیره شده در سیستم
          </CardDescription>
        </CardHeader>
        <CardContent>
          {databaseStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {databaseStats.devices}
                </p>
                <p className="text-sm text-muted-foreground">دستگاه</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {databaseStats.prices}
                </p>
                <p className="text-sm text-muted-foreground">قیمت</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {databaseStats.alerts}
                </p>
                <p className="text-sm text-muted-foreground">هشدار</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {databaseStats.vendors}
                </p>
                <p className="text-sm text-muted-foreground">فروشنده</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            مدیریت داده‌ها
          </CardTitle>
          <CardDescription>
            پشتیبان‌گیری و صادر کردن داده‌ها
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">پشتیبان‌گیری خودکار</p>
              <p className="text-sm text-muted-foreground">
                پشتیبان‌گیری روزانه از داده‌ها
              </p>
            </div>
            <Switch
              checked={autoBackup}
              onCheckedChange={setAutoBackup}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium">صادر کردن داده‌ها</p>
            <p className="text-sm text-muted-foreground">
              دانلود تمام قیمت‌ها در قالب فایل CSV
            </p>
            <Button 
              variant="outline" 
              onClick={() => exportDataMutation.mutate()}
              disabled={exportDataMutation.isPending}
            >
              <Download className="w-4 h-4 ml-2" />
              دانلود فایل CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}