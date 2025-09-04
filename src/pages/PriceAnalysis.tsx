import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Search, Filter } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface PriceAnalysisData {
  phone_brand: string;
  phone_model: string;
  color: string;
  storage: string;
  min_price: number;
  max_price: number;
  avg_price: number;
  price_count: number;
  latest_date: string;
  company_names: string[];
}

export default function PriceAnalysis() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: profile } = useQuery({
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

  const { data: brands } = useQuery({
    queryKey: ['price-analysis-brands'],
    queryFn: async () => {
      if (!profile?.org_id) return [];
      
      try {
        // Use type assertion for table not in types
        const { data, error } = await (supabase as any)
          .from('ocr_extracted_prices')
          .select('phone_brand')
          .eq('org_id', profile.org_id)
          .not('phone_brand', 'is', null)
          .order('phone_brand');
        
        if (error) throw error;
        return [...new Set(data?.map((item: any) => item.phone_brand))].filter(Boolean);
      } catch (err) {
        console.warn('Could not fetch brands:', err);
        return [];
      }
    },
    enabled: !!profile?.org_id
  });

  const { data: analysisData, isLoading, refetch } = useQuery({
    queryKey: ['price-analysis', dateFrom, dateTo, selectedBrand, searchTerm, profile?.org_id],
    queryFn: async () => {
      if (!profile?.org_id) return [];
      
      try {
        // Use type assertion for table not in types
        let query = (supabase as any)
          .from('ocr_extracted_prices')
          .select('*')
          .eq('org_id', profile.org_id)
          .not('phone_brand', 'is', null)
          .not('phone_model', 'is', null)
          .not('price_rial', 'is', null);

        if (dateFrom) {
          query = query.gte('date', dateFrom);
        }
        if (dateTo) {
          query = query.lte('date', dateTo);
        }
        if (selectedBrand !== 'all') {
          query = query.eq('phone_brand', selectedBrand);
        }

        const { data, error } = await query.order('date', { ascending: false });
        
        if (error) throw error;

        // Group by brand, model, color, storage
        const grouped = data?.reduce((acc: any, item: any) => {
          const storageStr = item.storage_gb ? `${item.storage_gb}GB` : 'نامشخص';
          const key = `${item.phone_brand}-${item.phone_model}-${item.color || 'نامشخص'}-${storageStr}`;
          
          if (!acc[key]) {
            acc[key] = {
              phone_brand: item.phone_brand,
              phone_model: item.phone_model,
              color: item.color || 'نامشخص',
              storage: storageStr,
              prices: [],
              company_names: new Set()
            };
          }
          
          if (item.price_rial && item.price_rial > 0) {
            const priceNum = typeof item.price_rial === 'bigint' ? Number(item.price_rial) : item.price_rial;
            acc[key].prices.push(priceNum);
          }
          
          if (item.company_name) {
            acc[key].company_names.add(item.company_name);
          }
          
          acc[key].latest_date = item.date;
          
          return acc;
        }, {}) || {};

        // Calculate statistics
        const results: PriceAnalysisData[] = Object.values(grouped)
          .map((group: any) => {
            if (group.prices.length === 0) return null;
            
            const prices = group.prices.sort((a: number, b: number) => a - b);
            const min_price = prices[0];
            const max_price = prices[prices.length - 1];
            const avg_price = Math.round(prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length);
            
            return {
              phone_brand: group.phone_brand,
              phone_model: group.phone_model,
              color: group.color,
              storage: group.storage,
              min_price,
              max_price,
              avg_price,
              price_count: prices.length,
              latest_date: group.latest_date,
              company_names: Array.from(group.company_names)
            };
          })
          .filter(Boolean) as PriceAnalysisData[];

        // Apply search filter
        if (searchTerm) {
          return results.filter(item => 
            item.phone_brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.phone_model.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        return results.sort((a, b) => a.phone_brand.localeCompare(b.phone_brand));
      } catch (err) {
        console.warn('Could not fetch analysis data:', err);
        return [];
      }
    },
    enabled: !!profile?.org_id
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(Math.round(price / 10)) + ' تومان';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'نامشخص';
    return new Date(dateString).toLocaleDateString('fa-IR');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">تحلیل قیمت‌ها</h1>
        <p className="text-muted-foreground mt-2">
          تحلیل کمترین قیمت برندها در بازه زمانی مشخص
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            فیلترها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">از تاریخ</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">تا تاریخ</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">برند</label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب برند" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه برندها</SelectItem>
                  {brands?.map((brand: string) => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">جستجو</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="جستجوی مدل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => refetch()} className="gap-2">
              <TrendingUp className="h-4 w-4" />
              بروزرسانی تحلیل
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>نتایج تحلیل قیمت</CardTitle>
          <CardDescription>
            کمترین، بیشترین و میانگین قیمت‌های هر مدل در بازه انتخابی
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">در حال بارگذاری...</div>
          ) : analysisData && analysisData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>برند و مدل</TableHead>
                    <TableHead>مشخصات</TableHead>
                    <TableHead>کمترین قیمت</TableHead>
                    <TableHead>بیشترین قیمت</TableHead>
                    <TableHead>میانگین قیمت</TableHead>
                    <TableHead>تعداد قیمت</TableHead>
                    <TableHead>آخرین به‌روزرسانی</TableHead>
                    <TableHead>فروشندگان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.phone_brand}</div>
                          <div className="text-sm text-muted-foreground">{item.phone_model}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline">{item.color}</Badge>
                          <Badge variant="outline">{item.storage}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {formatPrice(item.min_price)}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {formatPrice(item.max_price)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(item.avg_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {item.price_count} قیمت
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.latest_date)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.company_names.length > 0 ? (
                            <div className="max-w-32 truncate" title={item.company_names.join(', ')}>
                              {item.company_names.slice(0, 2).join(', ')}
                              {item.company_names.length > 2 && ` و ${item.company_names.length - 2} مورد دیگر`}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">نامشخص</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              هیچ داده‌ای در بازه زمانی انتخابی یافت نشد
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}