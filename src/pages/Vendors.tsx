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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Star, Phone, Mail, MapPin, Edit, Trash, TrendingUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Vendor {
  id: string;
  name: string;
  is_official: boolean;
  trust_score: number;
  contact_info: {
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  };
  created_at: string;
}

interface VendorWithStats extends Vendor {
  price_count?: number;
  avg_price?: number;
  last_price_date?: string;
}

export default function Vendors() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [isOfficial, setIsOfficial] = useState(false);
  const [trustScore, setTrustScore] = useState(50);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
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

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Vendor[];
    }
  });

  const { data: vendorStats } = useQuery({
    queryKey: ['vendor_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prices')
        .select(`
          vendor_id,
          price_toman,
          observed_at,
          vendor:vendors!inner(name)
        `)
        .order('observed_at', { ascending: false });
      
      if (error) throw error;

      // Calculate stats per vendor
      const stats = data.reduce((acc: any, price: any) => {
        const vendorId = price.vendor_id;
        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendor_id: vendorId,
            vendor_name: price.vendor.name,
            prices: [],
            total_prices: 0,
            sum_prices: 0
          };
        }
        acc[vendorId].prices.push(price);
        acc[vendorId].total_prices++;
        acc[vendorId].sum_prices += price.price_toman;
        return acc;
      }, {});

      return Object.values(stats).map((stat: any) => ({
        vendor_id: stat.vendor_id,
        vendor_name: stat.vendor_name,
        price_count: stat.total_prices,
        avg_price: Math.round(stat.sum_prices / stat.total_prices),
        last_price_date: stat.prices[0]?.observed_at
      }));
    }
  });

  const createVendorMutation = useMutation({
    mutationFn: async () => {
      if (!vendorName.trim()) throw new Error('نام فروشنده الزامی است');
      if (!user?.id || !profile?.org_id) throw new Error('کاربر وارد نشده است');
      
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: vendorName,
          org_id: profile.org_id,
          is_official: isOfficial,
          trust_score: trustScore,
          contact_info: {
            phone: phone || undefined,
            email: email || undefined,
            address: address || undefined,
            website: website || undefined
          }
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'فروشنده اضافه شد',
        description: 'فروشنده جدید با موفقیت ثبت شد'
      });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'خطا در ثبت فروشنده',
        description: 'مشکلی در ثبت فروشنده پیش آمد',
        variant: 'destructive'
      });
    }
  });

  const updateVendorMutation = useMutation({
    mutationFn: async (vendor: Vendor) => {
      const { error } = await supabase
        .from('vendors')
        .update({
          name: vendorName,
          is_official: isOfficial,
          trust_score: trustScore,
          contact_info: {
            phone: phone || undefined,
            email: email || undefined,
            address: address || undefined,
            website: website || undefined
          }
        })
        .eq('id', vendor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'فروشنده ویرایش شد',
        description: 'اطلاعات فروشنده با موفقیت به‌روزرسانی شد'
      });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      resetForm();
      setEditingVendor(null);
    }
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'فروشنده حذف شد',
        description: 'فروشنده با موفقیت حذف شد'
      });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    }
  });

  const resetForm = () => {
    setVendorName('');
    setIsOfficial(false);
    setTrustScore(50);
    setPhone('');
    setEmail('');
    setAddress('');
    setWebsite('');
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorName(vendor.name);
    setIsOfficial(vendor.is_official);
    setTrustScore(vendor.trust_score || 50);
    setPhone(vendor.contact_info?.phone || '');
    setEmail(vendor.contact_info?.email || '');
    setAddress(vendor.contact_info?.address || '');
    setWebsite(vendor.contact_info?.website || '');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrustScoreText = (score: number) => {
    if (score >= 80) return 'عالی';
    if (score >= 60) return 'خوب';
    if (score >= 40) return 'متوسط';
    return 'ضعیف';
  };

  // Combine vendors with their stats
  const vendorsWithStats: VendorWithStats[] = vendors?.map(vendor => {
    const stats = vendorStats?.find(s => s.vendor_id === vendor.id);
    return {
      ...vendor,
      price_count: stats?.price_count || 0,
      avg_price: stats?.avg_price,
      last_price_date: stats?.last_price_date
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">فروشنده‌ها</h1>
          <p className="text-muted-foreground mt-2">
            مدیریت فروشنده‌ها و تامین‌کنندگان قیمت
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 ml-2" />
              فروشنده جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>اضافه کردن فروشنده</DialogTitle>
            </DialogHeader>
            <VendorForm
              vendorName={vendorName}
              setVendorName={setVendorName}
              isOfficial={isOfficial}
              setIsOfficial={setIsOfficial}
              trustScore={trustScore}
              setTrustScore={setTrustScore}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              address={address}
              setAddress={setAddress}
              website={website}
              setWebsite={setWebsite}
              onSubmit={() => createVendorMutation.mutate()}
              isLoading={createVendorMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Vendors Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">کل فروشنده‌ها</p>
                <p className="text-2xl font-bold">{vendors?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">فروشنده‌های رسمی</p>
                <p className="text-2xl font-bold">
                  {vendors?.filter(v => v.is_official).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">میانگین اعتماد</p>
                <p className="text-2xl font-bold">
                  {vendors?.length ? Math.round(vendors.reduce((sum, v) => sum + (v.trust_score || 50), 0) / vendors.length) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">کل قیمت‌ها</p>
                <p className="text-2xl font-bold">
                  {vendorStats?.reduce((sum, v) => sum + v.price_count, 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle>لیست فروشنده‌ها</CardTitle>
          <CardDescription>
            اطلاعات کامل فروشنده‌ها و آمار فعالیت آن‌ها
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">در حال بارگذاری...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام فروشنده</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>امتیاز اعتماد</TableHead>
                    <TableHead>تعداد قیمت</TableHead>
                    <TableHead>میانگین قیمت</TableHead>
                    <TableHead>آخرین قیمت</TableHead>
                    <TableHead>اطلاعات تماس</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorsWithStats.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        {vendor.name}
                      </TableCell>
                      <TableCell>
                        {vendor.is_official ? (
                          <Badge variant="default">رسمی</Badge>
                        ) : (
                          <Badge variant="secondary">غیررسمی</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${getTrustScoreColor(vendor.trust_score || 50)}`}>
                            {vendor.trust_score || 50}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({getTrustScoreText(vendor.trust_score || 50)})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {vendor.price_count} قیمت
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {vendor.avg_price ? formatPrice(vendor.avg_price) : '-'}
                      </TableCell>
                      <TableCell>
                        {vendor.last_price_date ? formatDate(vendor.last_price_date) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {vendor.contact_info?.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="w-3 h-3" />
                              {vendor.contact_info.phone}
                            </div>
                          )}
                          {vendor.contact_info?.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="w-3 h-3" />
                              {vendor.contact_info.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(vendor)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>ویرایش فروشنده</DialogTitle>
                              </DialogHeader>
                              <VendorForm
                                vendorName={vendorName}
                                setVendorName={setVendorName}
                                isOfficial={isOfficial}
                                setIsOfficial={setIsOfficial}
                                trustScore={trustScore}
                                setTrustScore={setTrustScore}
                                phone={phone}
                                setPhone={setPhone}
                                email={email}
                                setEmail={setEmail}
                                address={address}
                                setAddress={setAddress}
                                website={website}
                                setWebsite={setWebsite}
                                onSubmit={() => editingVendor && updateVendorMutation.mutate(editingVendor)}
                                isLoading={updateVendorMutation.isPending}
                                isEdit
                              />
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteVendorMutation.mutate(vendor.id)}
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
    </div>
  );
}

// Vendor Form Component
interface VendorFormProps {
  vendorName: string;
  setVendorName: (value: string) => void;
  isOfficial: boolean;
  setIsOfficial: (value: boolean) => void;
  trustScore: number;
  setTrustScore: (value: number) => void;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  website: string;
  setWebsite: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isEdit?: boolean;
}

function VendorForm({
  vendorName, setVendorName, isOfficial, setIsOfficial,
  trustScore, setTrustScore, phone, setPhone, email, setEmail,
  address, setAddress, website, setWebsite, onSubmit, isLoading, isEdit
}: VendorFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">نام فروشنده</Label>
        <Input
          id="name"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="نام فروشنده را وارد کنید"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={isOfficial}
          onCheckedChange={setIsOfficial}
        />
        <Label>فروشنده رسمی</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trust">امتیاز اعتماد ({trustScore})</Label>
        <Input
          id="trust"
          type="range"
          min="0"
          max="100"
          value={trustScore}
          onChange={(e) => setTrustScore(parseInt(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">تلفن</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="شماره تلفن"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">ایمیل</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="آدرس ایمیل"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">آدرس</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="آدرس فروشگاه"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">وب‌سایت</Label>
        <Input
          id="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="آدرس وب‌سایت"
        />
      </div>

      <Button
        onClick={onSubmit}
        disabled={!vendorName || isLoading}
        className="w-full"
      >
        {isEdit ? 'ویرایش فروشنده' : 'اضافه کردن فروشنده'}
      </Button>
    </div>
  );
}