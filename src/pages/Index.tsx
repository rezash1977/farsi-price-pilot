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

const Index = () => {
  // Sample KPI data
  const kpis = [
    {
      title: 'فایل‌های پردازش شده امروز',
      value: '۲۴',
      change: '+۱۲%',
      trend: 'up',
      description: 'نسبت به دیروز',
      icon: FileText,
    },
    {
      title: 'ردیف‌های قیمتی جدید',
      value: '۱,۵۶۳',
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
      value: '۸',
      change: '+۳',
      trend: 'up',
      description: 'هشدار جدید',
      icon: AlertTriangle,
    },
  ];

  // Sample recent activity
  const recentActivity = [
    {
      type: 'upload',
      title: 'آپلود لیست قیمت جدید',
      vendor: 'فروشگاه تک موبایل',
      time: '۱۰ دقیقه پیش',
      items: '۱۲۳ آیتم',
    },
    {
      type: 'whatsapp',
      title: 'دریافت پیام واتس‌اپ',
      vendor: 'گروه عمده‌فروشان',
      time: '۳۰ دقیقه پیش',
      items: '۴۵ آیتم',
    },
    {
      type: 'price',
      title: 'تغییر قیمت مهم',
      vendor: 'iPhone ۱۵ Pro Max',
      time: '۱ ساعت پیش',
      items: 'کاهش ۵%',
    },
  ];

  // Sample trending devices
  const trendingDevices = [
    {
      device: 'iPhone ۱۵ Pro Max ۲۵۶GB',
      avgPrice: '۹۵,۰۰۰,۰۰۰',
      change: '-۳.۲%',
      trend: 'down',
      vendors: 12,
    },
    {
      device: 'Samsung Galaxy S24 Ultra ۲۵۶GB',
      avgPrice: '۶۸,۰۰۰,۰۰۰',
      change: '+۱.۸%',
      trend: 'up',
      vendors: 8,
    },
    {
      device: 'iPhone ۱۴ Pro ۱۲۸GB',
      avgPrice: '۷۲,۰۰۰,۰۰۰',
      change: '+۰.۵%',
      trend: 'up',
      vendors: 15,
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
