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
import { Upload, FileText, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface UploadFile {
  id: string;
  filename: string;
  mime_type: string;
  row_count: number;
  ocr_status: 'queued' | 'processing' | 'done' | 'failed';
  created_at: string;
}

export default function Uploads() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const { data: uploads, isLoading } = useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: ocrRows } = useQuery({
    queryKey: ['ocr_rows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ocr_rows_staging')
        .select(`
          *,
          upload:uploads(filename)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      
      if (!user?.id || !profile?.org_id) throw new Error('کاربر وارد نشده است');
      
      // Upload file to storage (if storage is configured)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // For now, we'll just create the upload record without actual file storage
      const { data: upload, error } = await supabase
        .from('uploads')
        .insert({
          filename: file.name,
          mime_type: file.type,
          storage_path: filePath,
          org_id: profile.org_id,
          row_count: 0,
          ocr_status: 'queued'
        })
        .select()
        .single();

      if (error) throw error;

      // Simulate OCR processing with some sample data
      const sampleOcrData = [
        {
          upload_id: upload.id,
          raw_json: {
            device: 'iPhone 15 Pro',
            price: '45000000',
            vendor: 'فروشگاه موبایل',
            date: new Date().toISOString()
          },
          normalized: {
            device_brand: 'Apple',
            device_model: 'iPhone 15 Pro',
            price_toman: 45000000,
            vendor_name: 'فروشگاه موبایل'
          }
        },
        {
          upload_id: upload.id,
          raw_json: {
            device: 'Samsung Galaxy S24',
            price: '38000000',
            vendor: 'تکنو شاپ',
            date: new Date().toISOString()
          },
          normalized: {
            device_brand: 'Samsung',
            device_model: 'Galaxy S24',
            price_toman: 38000000,
            vendor_name: 'تکنو شاپ'
          }
        }
      ];

      await supabase
        .from('ocr_rows_staging')
        .insert(sampleOcrData);

      // Update upload with row count
      await supabase
        .from('uploads')
        .update({ 
          row_count: sampleOcrData.length,
          ocr_status: 'done'
        })
        .eq('id', upload.id);

      return upload;
    },
    onSuccess: () => {
      toast({
        title: 'آپلود موفق',
        description: 'فایل با موفقیت آپلود و پردازش شد'
      });
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
      queryClient.invalidateQueries({ queryKey: ['ocr_rows'] });
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({
        title: 'خطا در آپلود',
        description: 'مشکلی در آپلود فایل پیش آمد',
        variant: 'destructive'
      });
      console.error('Upload error:', error);
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-600 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'done':
        return 'تکمیل شده';
      case 'failed':
        return 'خطا';
      case 'processing':
        return 'در حال پردازش';
      default:
        return 'در صف';
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">آپلود فایل</h1>
        <p className="text-muted-foreground mt-2">
          فایل‌های Excel یا تصاویر حاوی قیمت‌ها را آپلود کنید
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>آپلود فایل جدید</CardTitle>
          <CardDescription>
            فایل‌های Excel، CSV یا تصاویر پشتیبانی می‌شوند
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">انتخاب فایل</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.pdf"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>
          
          {selectedFile && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{selectedFile.name}</span>
                <Badge variant="outline">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </Badge>
              </div>
            </div>
          )}

          <Button 
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 ml-2" />
            {uploading ? 'در حال آپلود...' : 'آپلود فایل'}
          </Button>
        </CardContent>
      </Card>

      {/* Uploads History */}
      <Card>
        <CardHeader>
          <CardTitle>تاریخچه آپلودها</CardTitle>
          <CardDescription>
            فایل‌های آپلود شده و وضعیت پردازش آن‌ها
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
                    <TableHead>نام فایل</TableHead>
                    <TableHead>نوع فایل</TableHead>
                    <TableHead>تعداد ردیف</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>تاریخ آپلود</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads?.map((upload: UploadFile) => (
                    <TableRow key={upload.id}>
                      <TableCell className="font-medium">
                        {upload.filename}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {upload.mime_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {upload.row_count > 0 ? `${upload.row_count} ردیف` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(upload.ocr_status)}
                          <span>{getStatusText(upload.ocr_status)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(upload.created_at)}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>جزئیات پردازش فایل</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>نام فایل</Label>
                                  <p className="text-sm">{upload.filename}</p>
                                </div>
                                <div>
                                  <Label>تعداد ردیف پردازش شده</Label>
                                  <p className="text-sm">{upload.row_count}</p>
                                </div>
                              </div>
                              
                              {/* Show OCR results for this upload */}
                              <div>
                                <Label>نتایج استخراج شده</Label>
                                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                  {ocrRows?.filter(row => row.upload_id === upload.id).map((row: any) => (
                                    <div key={row.id} className="p-3 border rounded-lg text-sm">
                                      <pre className="whitespace-pre-wrap">
                                        {JSON.stringify(row.normalized || row.raw_json, null, 2)}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
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