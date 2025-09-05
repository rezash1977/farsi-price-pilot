import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bell, Plus, TrendingUp, TrendingDown, Edit, Trash } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Alert {
  id: string;
  variant_id: string;
  threshold_toman: number;
  condition: 'lt' | 'lte' | 'eq';
  active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  variant?: {
    id: string;
    color: string;
    ram_gb: number;
    storage_gb: number;
    device: {
      brand: string;
      model: string;
    };
  };
}

interface Variant {
  id: string;
  color: string;
  ram_gb: number;
  storage_gb: number;
  device: {
    brand: string;
    model: string;
  };
}

export default function Alerts() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [threshold, setThreshold] = useState('');
  const [condition, setCondition] = useState<'lt' | 'lte' | 'eq'>('lt');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get user's org_id
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          variant:variants(
            id,
            color,
            ram_gb,
            storage_gb,
            device:devices(brand, model)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Alert[];
    }
  });

  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['variants_for_alerts', profile?.org_id],
    queryFn: async () => {
      if (!profile?.org_id) return [];
      
      const { data, error } = await supabase
        .from('variants')
        .select(`
          id,
          color,
          ram_gb,
          storage_gb,
          device:devices(brand, model)
        `)
        .order('device.brand', { ascending: true });
      
      if (error) throw error;
      return data as Variant[];
    },
    enabled: !!profile?.org_id
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          alert:alerts(
            id,
            variant:variants(
              device:devices(brand, model)
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const createAlertMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVariantId) throw new Error('لطفاً یک دستگاه انتخاب کنید');
      if (!user?.id || !profile?.org_id) throw new Error('کاربر وارد نشده است');
      
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          variant_id: selectedVariantId,
          user_id: user.id,
          org_id: profile.org_id,
          threshold_toman: parseFloat(threshold),
          condition,
          active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'هشدار ایجاد شد',
        description: 'هشدار قیمت با موفقیت تنظیم شد'
      });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setIsCreateDialogOpen(false);
      setSelectedVariantId('');
      setThreshold('');
      setCondition('lt');
    },
    onError: () => {
      toast({
        title: 'خطا در ایجاد هشدار',
        description: 'مشکلی در تنظیم هشدار پیش آمد',
        variant: 'destructive'
      });
    }
  });

  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('alerts')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'هشدار حذف شد',
        description: 'هشدار با موفقیت حذف شد'
      });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  const simulateAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      if (!profile?.org_id) throw new Error('کاربر وارد نشده است');
      
      // Create a sample notification
      const { error } = await supabase
        .from('notifications')
        .insert({
          alert_id: alertId,
          org_id: profile.org_id,
          channel: 'email',
          status: 'sent',
          payload: {
            message: 'قیمت به آستانه تعریف شده رسید',
            timestamp: new Date().toISOString()
          }
        });

      if (error) throw error;

      // Update alert last_triggered_at
      await supabase
        .from('alerts')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', alertId);
    },
    onSuccess: () => {
      toast({
        title: 'اعلان آزمایشی ارسال شد',
        description: 'اعلان نمونه برای هشدار ایجاد شد'
      });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'lt':
        return 'کمتر از';
      case 'lte':
        return 'کمتر یا مساوی';
      case 'eq':
        return 'برابر با';
      default:
        return 'کمتر از';
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'lt':
      case 'lte':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      case 'eq':
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      default:
        return <TrendingDown className="w-4 h-4 text-green-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">هشدار قیمت</h1>
          <p className="text-muted-foreground mt-2">
            هشدار دریافت کنید وقتی قیمت دستگاه‌ها به آستانه تعریف شده برسد
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              هشدار جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ایجاد هشدار قیمت</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>انتخاب دستگاه</Label>
                <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="دستگاه را انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {variantsLoading ? (
                      <SelectItem value="" disabled>در حال بارگذاری...</SelectItem>
                    ) : variants && variants.length > 0 ? (
                      variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.device.brand} {variant.device.model} - {variant.color} - {variant.ram_gb}GB/{variant.storage_gb}GB
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>هیچ دستگاهی یافت نشد</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>شرط هشدار</Label>
                <Select value={condition} onValueChange={(value: 'lt' | 'lte' | 'eq') => setCondition(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lt">کمتر از</SelectItem>
                    <SelectItem value="lte">کمتر یا مساوی</SelectItem>
                    <SelectItem value="eq">برابر با</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>آستانه قیمت (تومان)</Label>
                <Input
                  type="number"
                  placeholder="مثال: 50000000"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>

              <Button 
                onClick={() => createAlertMutation.mutate()}
                disabled={!selectedVariantId || !threshold}
                className="w-full"
              >
                <Bell className="w-4 h-4 ml-2" />
                ایجاد هشدار
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>هشدارهای فعال</CardTitle>
          <CardDescription>
            هشدارهای تنظیم شده برای دستگاه‌های مختلف
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="text-center py-8">در حال بارگذاری...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>دستگاه</TableHead>
                    <TableHead>شرط</TableHead>
                    <TableHead>آستانه قیمت</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>آخرین اعلان</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts?.map((alert: Alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        {alert.variant && (
                          <div>
                            <div className="font-medium">
                              {alert.variant.device.brand} {alert.variant.device.model}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {alert.variant.color} • {alert.variant.ram_gb}GB • {alert.variant.storage_gb}GB
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getConditionIcon(alert.condition)}
                          <span>{getConditionText(alert.condition)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(alert.threshold_toman)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={alert.active}
                            onCheckedChange={(checked) =>
                              toggleAlertMutation.mutate({
                                id: alert.id,
                                active: checked
                              })
                            }
                          />
                          <span className={alert.active ? 'text-green-600' : 'text-muted-foreground'}>
                            {alert.active ? 'فعال' : 'غیرفعال'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {alert.last_triggered_at ? (
                          formatDate(alert.last_triggered_at)
                        ) : (
                          <span className="text-muted-foreground">هیچ‌وقت</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => simulateAlertMutation.mutate(alert.id)}
                          >
                            <Bell className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAlertMutation.mutate(alert.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>اعلان‌های اخیر</CardTitle>
          <CardDescription>
            آخرین اعلان‌های ارسال شده
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notifications?.slice(0, 10).map((notification: any) => (
              <div key={notification.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    هشدار قیمت برای {notification.alert?.variant?.device?.brand || 'دستگاه'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(notification.created_at)}
                  </div>
                </div>
                <Badge variant={notification.status === 'sent' ? 'default' : 'secondary'}>
                  {notification.status === 'sent' ? 'ارسال شده' : 'در انتظار'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}