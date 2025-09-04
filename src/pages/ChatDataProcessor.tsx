import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ChatDataForm {
  company_name: string;
  phone_brand: string;
  phone_model: string;
  storage: string;
  color: string;
  price_in_rials: number | '';
  price_date: string;
  image_url?: string;
}

export default function ChatDataProcessor() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ChatDataForm>({
    company_name: '',
    phone_brand: '',
    phone_model: '',
    storage: '',
    color: '',
    price_in_rials: '',
    price_date: new Date().toISOString().split('T')[0],
    image_url: ''
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
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

  // Use direct SQL query for tables not in TypeScript types
  const { data: recentData, refetch } = useQuery({
    queryKey: ['recent-chat-data'],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      
      try {
        // Fallback to direct query with type assertion
        const { data: fallbackData, error: fallbackError } = await (supabase as any)
          .from('ocr_extracted_prices')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      } catch (err) {
        console.warn('Could not fetch OCR data:', err);
        return [];
      }
    },
    enabled: !!userProfile?.org_id
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ChatDataForm) => {
      if (!userProfile?.org_id) throw new Error('Organization ID is required');

      const insertData = {
        org_id: userProfile.org_id,
        company_name: data.company_name || null,
        phone_brand: data.phone_brand || null,
        phone_model: data.phone_model || null,
        storage_gb: data.storage ? parseInt(data.storage) : null,
        color: data.color || null,
        price_rial: typeof data.price_in_rials === 'number' ? data.price_in_rials : null,
        date: data.price_date || null,
        image_url: data.image_url || null,
        source: 'manual',
        chat_id: `manual_${Date.now()}`,
        message_id: `manual_${Date.now()}_msg`
      };

      // Use type assertion for table not in types
      const { data: result, error } = await (supabase as any)
        .from('ocr_extracted_prices')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'موفقیت',
        description: 'داده‌های قیمت با موفقیت ذخیره شد'
      });
      
      // Reset form
      setFormData({
        company_name: '',
        phone_brand: '',
        phone_model: '',
        storage: '',
        color: '',
        price_in_rials: '',
        price_date: new Date().toISOString().split('T')[0],
        image_url: ''
      });
      
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره‌سازی داده‌ها: ' + error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phone_brand || !formData.phone_model) {
      toast({
        title: 'خطا',
        description: 'برند و مدل گوشی الزامی است',
        variant: 'destructive'
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof ChatDataForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatPrice = (price: any) => {
    if (!price) return 'نامشخص';
    const priceNum = typeof price === 'bigint' ? Number(price) : Number(price);
    return new Intl.NumberFormat('fa-IR').format(Math.round(priceNum / 10)) + ' تومان';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'نامشخص';
    return new Date(dateString).toLocaleDateString('fa-IR');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">پردازش داده‌های چت</h1>
        <p className="text-muted-foreground mt-2">
          ثبت و مدیریت داده‌های قیمت استخراج شده از چت‌ها
        </p>
      </div>

      {/* Manual Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            ثبت دستی داده‌های قیمت
          </CardTitle>
          <CardDescription>
            اطلاعات قیمت استخراج شده از چت‌ها را به صورت دستی وارد کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">نام شرکت</label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="مثال: فروشگاه تک موبایل"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">برند موبایل *</label>
                <Input
                  value={formData.phone_brand}
                  onChange={(e) => handleInputChange('phone_brand', e.target.value)}
                  placeholder="مثال: iPhone, Samsung"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">مدل موبایل *</label>
                <Input
                  value={formData.phone_model}
                  onChange={(e) => handleInputChange('phone_model', e.target.value)}
                  placeholder="مثال: 15 Pro Max"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">حافظه</label>
                <Input
                  value={formData.storage}
                  onChange={(e) => handleInputChange('storage', e.target.value)}
                  placeholder="مثال: 256"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">رنگ</label>
                <Input
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  placeholder="مثال: آبی تیتانیوم"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">قیمت (ریال)</label>
                <Input
                  type="number"
                  value={formData.price_in_rials}
                  onChange={(e) => handleInputChange('price_in_rials', parseInt(e.target.value) || '')}
                  placeholder="مثال: 485000000"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">تاریخ</label>
                <Input
                  type="date"
                  value={formData.price_date}
                  onChange={(e) => handleInputChange('price_date', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">لینک تصویر</label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => handleInputChange('image_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                {saveMutation.isPending ? 'در حال ذخیره...' : 'ذخیره داده'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Data */}
      <Card>
        <CardHeader>
          <CardTitle>داده‌های اخیر</CardTitle>
          <CardDescription>
            آخرین داده‌های قیمت ثبت شده
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentData && recentData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شرکت</TableHead>
                    <TableHead>برند و مدل</TableHead>
                    <TableHead>مشخصات</TableHead>
                    <TableHead>قیمت</TableHead>
                    <TableHead>تاریخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentData.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.company_name || (
                          <span className="text-muted-foreground">نامشخص</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.phone_brand || 'نامشخص'}</div>
                          <div className="text-sm text-muted-foreground">{item.phone_model || 'نامشخص'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {item.color && <Badge variant="outline">{item.color}</Badge>}
                          {item.storage_gb && <Badge variant="outline">{item.storage_gb}GB</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(item.price_rial)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              هنوز داده‌ای ثبت نشده است
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}