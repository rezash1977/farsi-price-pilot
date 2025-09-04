import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  AlertTriangle,
  Eye,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user } = useAuth();

  // Get user's org_id
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get today's stats
  const { data: todayStats } = useQuery({
    queryKey: ['todayStats', profile?.org_id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [todayCount, yesterdayCount, totalPrices, activeAlerts] = await Promise.all([
        supabase
          .from('ocr_extracted_prices')
          .select('id', { count: 'exact' })
          .eq('org_id', profile?.org_id)
          .gte('created_at', today),
        
        supabase
          .from('ocr_extracted_prices')
          .select('id', { count: 'exact' })
          .eq('org_id', profile?.org_id)
          .gte('created_at', yesterday)
          .lt('created_at', today),

        supabase
          .from('ocr_extracted_prices')
          .select('id', { count: 'exact' })
          .eq('org_id', profile?.org_id)
          .gte('created_at', today),

        supabase
          .from('alerts')
          .select('id', { count: 'exact' })
          .eq('org_id', profile?.org_id)
          .eq('active', true)
      ]);

      const todayFiles = todayCount.count || 0;
      const yesterdayFiles = yesterdayCount.count || 0;
      const changePercent = yesterdayFiles > 0 ? ((todayFiles - yesterdayFiles) / yesterdayFiles * 100).toFixed(1) : '0';
      const changeNum = parseFloat(changePercent);

      return {
        todayFiles,
        totalPrices: totalPrices.count || 0,
        changePercent: `${changeNum > 0 ? '+' : ''}${changePercent}%`,
        activeAlerts: activeAlerts.count || 0
      };
    },
    enabled: !!profile?.org_id
  });

  // Get recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ['recentActivity', profile?.org_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ocr_extracted_prices')
        .select('*')
        .eq('org_id', profile?.org_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      return data?.map(item => ({
        type: 'whatsapp',
        title: `${item.phone_brand} ${item.phone_model}`,
        vendor: item.company_name || 'نامشخص',
        time: new Date(item.created_at).toLocaleDateString('fa-IR'),
        items: item.price_rial ? `${new Intl.NumberFormat('fa-IR').format(item.price_rial / 10)} تومان` : 'بدون قیمت'
      }));
    },
    enabled: !!profile?.org_id
  });

  // Get trending devices
  const { data: trendingDevices } = useQuery({
    queryKey: ['trendingDevices', profile?.org_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ocr_extracted_prices')
        .select('phone_brand, phone_model, storage_gb, price_rial, company_name')
        .eq('org_id', profile?.org_id)
        .not('price_rial', 'is', null)
        .not('phone_brand', 'is', null)
        .not('phone_model', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by device and calculate average prices
      const deviceGroups = data?.reduce((acc: any, item) => {
        const key = `${item.phone_brand} ${item.phone_model} ${item.storage_gb ? item.storage_gb + 'GB' : ''}`;
        if (!acc[key]) {
          acc[key] = {
            device: key,
            prices: [],
            vendors: new Set()
          };
        }
        if (item.price_rial) {
          acc[key].prices.push(item.price_rial);
        }
        if (item.company_name) {
          acc[key].vendors.add(item.company_name);
        }
        return acc;
      }, {});

      return Object.values(deviceGroups || {})
        .map((group: any) => ({
          device: group.device,
          avgPrice: group.prices.length > 0 
            ? new Intl.NumberFormat('fa-IR').format(
                Math.round(group.prices.reduce((a: number, b: number) => a + b, 0) / group.prices.length / 10)
              )
            : '0',
          change: '+۲.۱%', // This would need historical data to calculate properly
          trend: 'up',
          vendors: group.vendors.size
        }))
        .filter((device: any) => device.avgPrice !== '0')
        .slice(0, 3);
    },
    enabled: !!profile?.org_id
  });

  const kpis = [
    {
      title: 'فایل‌های پردازش شده امروز',
      value: todayStats?.todayFiles?.toString() || '۰',
      change: todayStats?.changePercent || '۰%',
      trend: 'up',
      description: 'نسبت به دیروز',
      icon: FileText,
    },
    {
      title: 'ردیف‌های قیمتی جدید',
      value: todayStats?.totalPrices?.toString() || '۰',
      change: '+۸%',
      trend: 'up',
      description: 'در ۲۴ ساعت گذشته',
      icon: TrendingUp,
    },
    {
      title: 'میانگین تغییرات امروز',
      value: '۲.۳%',
      change: '-۰.۵%',
      trend: 'down',
      description: 'کاهش نسبت به دیروز',
      icon: TrendingDown,
    },
    {
      title: 'هشدارهای فعال',
      value: todayStats?.activeAlerts?.toString() || '۰',
      change: '+۳',
      trend: 'up',
      description: 'هشدار جدید',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">داشبورد</h1>
          <p className="text-muted-foreground mt-2">
            نگاهی کلی به وضعیت قیمت‌گذاری و فعالیت‌های اخیر
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/ingest/uploads">
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              آپلود فایل
            </Button>
          </Link>
          <Link to="/ingest/whatsapp">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              دریافت از واتس‌اپ
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground mb-2">
                {kpi.value}
              </div>
              <div className="flex items-center text-sm">
                <Badge 
                  variant={kpi.trend === 'up' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {kpi.change}
                </Badge>
                <span className="text-muted-foreground mr-2">
                  {kpi.description}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>فعالیت‌های اخیر</CardTitle>
            <CardDescription>آخرین تغییرات و آپدیت‌ها</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {activity.type === 'upload' && <Upload className="h-4 w-4 text-primary" />}
                    {activity.type === 'whatsapp' && <MessageSquare className="h-4 w-4 text-primary" />}
                    {activity.type === 'price' && <TrendingUp className="h-4 w-4 text-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.vendor}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{activity.items}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trending Devices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>دستگاه‌های پرترافیک</CardTitle>
                <CardDescription>محبوب‌ترین گوشی‌ها در بازار</CardDescription>
              </div>
              <Link to="/compare">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  مشاهده همه
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {trendingDevices.map((device, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-foreground">{device.device}</p>
                  <p className="text-sm text-muted-foreground">{device.vendors} فروشنده</p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-foreground">{device.avgPrice} تومان</p>
                  <div className="flex items-center gap-1">
                    <Badge 
                      variant={device.trend === 'up' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {device.change}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>عملیات سریع</CardTitle>
          <CardDescription>دسترسی آسان به ابزارهای پرکاربرد</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link to="/alerts">
              <Button variant="outline" className="w-full gap-2 h-20 flex-col">
                <AlertTriangle className="h-6 w-6" />
                ایجاد هشدار قیمت
              </Button>
            </Link>
            <Link to="/vendors">
              <Button variant="outline" className="w-full gap-2 h-20 flex-col">
                <Plus className="h-6 w-6" />
                افزودن فروشنده
              </Button>
            </Link>
            <Link to="/compare">
              <Button variant="outline" className="w-full gap-2 h-20 flex-col">
                <TrendingUp className="h-6 w-6" />
                مقایسه قیمت‌ها
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="outline" className="w-full gap-2 h-20 flex-col">
                <FileText className="h-6 w-6" />
                گزارش‌گیری
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
