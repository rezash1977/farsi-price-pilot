import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Device {
  id: string;
  brand: string;
  model: string;
  normalized_name: string;
}

interface Variant {
  id: string;
  device_id: string;
  color: string;
  ram_gb: number;
  storage_gb: number;
  device: Device;
}

interface Price {
  id: string;
  price_toman: number;
  observed_at: string;
  vendor: {
    name: string;
    is_official: boolean;
  };
}

export default function Compare() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('brand', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['variants', searchTerm, selectedBrand],
    queryFn: async () => {
      let query = supabase
        .from('variants')
        .select(`
          *,
          device:devices(*)
        `)
        .order('device.brand', { ascending: true });

      if (selectedBrand !== 'all') {
        query = query.eq('device.brand', selectedBrand);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (searchTerm) {
        filteredData = filteredData.filter(variant => 
          variant.device.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          variant.device.brand.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return filteredData;
    },
    enabled: !devicesLoading
  });

  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['comparison', selectedVariants],
    queryFn: async () => {
      if (selectedVariants.length === 0) return [];

      const { data, error } = await supabase
        .from('prices')
        .select(`
          *,
          variant:variants!inner(*,
            device:devices(*)
          ),
          vendor:vendors(name, is_official)
        `)
        .in('variant_id', selectedVariants)
        .order('observed_at', { ascending: false });

      if (error) throw error;

      // Group by variant and calculate stats
      const grouped = data.reduce((acc: any, price: any) => {
        const variantId = price.variant_id;
        if (!acc[variantId]) {
          acc[variantId] = {
            variant: price.variant,
            prices: []
          };
        }
        acc[variantId].prices.push(price);
        return acc;
      }, {});

      return Object.values(grouped);
    },
    enabled: selectedVariants.length > 0
  });

  const brands = devices ? [...new Set(devices.map(d => d.brand))] : [];

  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariants(prev => 
      prev.includes(variantId) 
        ? prev.filter(id => id !== variantId)
        : [...prev, variantId]
    );
  };

  const calculatePriceStats = (prices: Price[]) => {
    const sortedPrices = prices.map(p => p.price_toman).sort((a, b) => a - b);
    const min = sortedPrices[0];
    const max = sortedPrices[sortedPrices.length - 1];
    const avg = sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length;
    
    return { min, max, avg: Math.round(avg) };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">مقایسه قیمت‌ها</h1>
        <p className="text-muted-foreground mt-2">
          دستگاه‌ها را انتخاب کنید و قیمت‌ها را مقایسه کنید
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="جستجوی دستگاه..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="انتخاب برند" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه برندها</SelectItem>
            {brands.map(brand => (
              <SelectItem key={brand} value={brand}>{brand}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Variant Selection */}
      <Card>
        <CardHeader>
          <CardTitle>انتخاب دستگاه‌ها برای مقایسه</CardTitle>
          <CardDescription>
            دستگاه‌هایی که می‌خواهید مقایسه کنید را انتخاب کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          {variantsLoading ? (
            <div className="text-center py-8">در حال بارگذاری...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants?.map((variant: any) => (
                <Card 
                  key={variant.id}
                  className={`cursor-pointer transition-colors ${
                    selectedVariants.includes(variant.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleVariantSelection(variant.id)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">
                        {variant.device.brand} {variant.device.model}
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{variant.color}</Badge>
                        <Badge variant="outline">{variant.ram_gb}GB RAM</Badge>
                        <Badge variant="outline">{variant.storage_gb}GB</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {selectedVariants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>نتایج مقایسه</CardTitle>
            <CardDescription>
              مقایسه قیمت‌های دستگاه‌های انتخاب شده
            </CardDescription>
          </CardHeader>
          <CardContent>
            {comparisonLoading ? (
              <div className="text-center py-8">در حال بارگذاری مقایسه...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>دستگاه</TableHead>
                      <TableHead>کمترین قیمت</TableHead>
                      <TableHead>بیشترین قیمت</TableHead>
                      <TableHead>میانگین قیمت</TableHead>
                      <TableHead>تعداد قیمت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData?.map((item: any) => {
                      const stats = calculatePriceStats(item.prices);
                      return (
                        <TableRow key={item.variant.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {item.variant.device.brand} {item.variant.device.model}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.variant.color} • {item.variant.ram_gb}GB • {item.variant.storage_gb}GB
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {formatPrice(stats.min)}
                          </TableCell>
                          <TableCell className="text-red-600 font-medium">
                            {formatPrice(stats.max)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatPrice(stats.avg)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.prices.length} قیمت
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}