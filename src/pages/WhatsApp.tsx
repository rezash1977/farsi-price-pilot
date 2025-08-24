import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { MessageSquare, Phone, Settings, CheckCircle, XCircle, Image } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Integration {
  id: string;
  type: 'whatsapp';
  active: boolean;
  config: {
    phone_number?: string;
    webhook_url?: string;
    api_token?: string;
  };
  created_at: string;
}

interface Message {
  id: string;
  chat_id: string;
  sender: string;
  text: string;
  has_media: boolean;
  timestamp: string;
  created_at: string;
}

export default function WhatsApp() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const queryClient = useQueryClient();

  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrations', 'whatsapp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'whatsapp')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Integration[];
    }
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as Message[];
    }
  });

  const { data: mediaFiles } = useQuery({
    queryKey: ['media_files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_files')
        .select(`
          *,
          message:messages(sender, chat_id)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .insert({
          type: 'whatsapp',
          active: true,
          config: {
            phone_number: phoneNumber,
            webhook_url: webhookUrl,
            api_token: apiToken
          }
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'اتصال واتس‌اپ ایجاد شد',
        description: 'اتصال با واتس‌اپ با موفقیت تنظیم شد'
      });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setPhoneNumber('');
      setWebhookUrl('');
      setApiToken('');
    },
    onError: () => {
      toast({
        title: 'خطا در ایجاد اتصال',
        description: 'مشکلی در تنظیم اتصال واتس‌اپ پیش آمد',
        variant: 'destructive'
      });
    }
  });

  const toggleIntegrationMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('integrations')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    }
  });

  const simulateMessageMutation = useMutation({
    mutationFn: async () => {
      // Simulate receiving a WhatsApp message with price information
      const sampleMessages = [
        {
          chat_id: `chat_${Date.now()}`,
          sender: '+98912xxxxxxx',
          text: 'سلام، iPhone 15 Pro 256GB آبی تیتانیوم 48,500,000 تومان موجود هست',
          has_media: false,
          timestamp: new Date().toISOString()
        },
        {
          chat_id: `chat_${Date.now() + 1}`,
          sender: '+98913xxxxxxx',
          text: 'Galaxy S24 Ultra 512GB مشکی 42,000,000 تومان فروش فوری',
          has_media: true,
          timestamp: new Date().toISOString()
        }
      ];

      const { error } = await supabase
        .from('messages')
        .insert(sampleMessages);

      if (error) throw error;

      // Simulate media file for second message
      if (sampleMessages[1]) {
        const { data: messageData } = await supabase
          .from('messages')
          .select('id')
          .eq('chat_id', sampleMessages[1].chat_id)
          .single();

        if (messageData) {
          await supabase
            .from('media_files')
            .insert({
              message_id: messageData.id,
              storage_path: '/media/sample_price_image.jpg',
              mime_type: 'image/jpeg',
              ocr_status: 'queued'
            });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'پیام‌های نمونه دریافت شد',
        description: 'پیام‌های نمونه حاوی قیمت اضافه شدند'
      });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media_files'] });
    }
  });

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const activeIntegration = integrations?.find(i => i.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">دریافت از واتس‌اپ</h1>
        <p className="text-muted-foreground mt-2">
          اتصال با واتس‌اپ و دریافت خودکار قیمت‌ها از پیام‌ها
        </p>
      </div>

      {/* Integration Setup */}
      <Card>
        <CardHeader>
          <CardTitle>تنظیمات اتصال واتس‌اپ</CardTitle>
          <CardDescription>
            برای دریافت خودکار قیمت‌ها از واتس‌اپ، اتصال را تنظیم کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeIntegration ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">اتصال فعال</h3>
                    <p className="text-sm text-muted-foreground">
                      شماره: {activeIntegration.config.phone_number}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={activeIntegration.active}
                  onCheckedChange={(checked) => 
                    toggleIntegrationMutation.mutate({ 
                      id: activeIntegration.id, 
                      active: checked 
                    })
                  }
                />
              </div>

              <Button 
                onClick={() => simulateMessageMutation.mutate()}
                variant="outline"
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 ml-2" />
                شبیه‌سازی دریافت پیام نمونه
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">شماره تلفن</Label>
                  <Input
                    id="phone"
                    placeholder="+98912xxxxxxx"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook">Webhook URL</Label>
                  <Input
                    id="webhook"
                    placeholder="https://yourapp.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="token">API Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="توکن API واتس‌اپ"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>

              <Button 
                onClick={() => createIntegrationMutation.mutate()}
                disabled={!phoneNumber || !webhookUrl || !apiToken}
                className="w-full"
              >
                <Settings className="w-4 h-4 ml-2" />
                ایجاد اتصال
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle>پیام‌های اخیر</CardTitle>
          <CardDescription>
            پیام‌های دریافت شده از واتس‌اپ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <div className="text-center py-8">در حال بارگذاری...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>فرستنده</TableHead>
                    <TableHead>متن پیام</TableHead>
                    <TableHead>فایل ضمیمه</TableHead>
                    <TableHead>زمان دریافت</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages?.map((message: Message) => (
                    <TableRow key={message.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {message.sender}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="truncate">{message.text}</p>
                      </TableCell>
                      <TableCell>
                        {message.has_media ? (
                          <Badge variant="secondary">
                            <Image className="w-3 h-3 ml-1" />
                            رسانه
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(message.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              مشاهده
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>جزئیات پیام</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>فرستنده</Label>
                                <p className="text-sm">{message.sender}</p>
                              </div>
                              <div>
                                <Label>متن کامل</Label>
                                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                              </div>
                              <div>
                                <Label>زمان ارسال</Label>
                                <p className="text-sm">{formatDate(message.timestamp)}</p>
                              </div>
                              
                              {/* Show related media files */}
                              {message.has_media && (
                                <div>
                                  <Label>فایل‌های ضمیمه</Label>
                                  <div className="mt-2 space-y-2">
                                    {mediaFiles?.filter(media => media.message_id === message.id).map((media: any) => (
                                      <div key={media.id} className="p-2 border rounded text-sm">
                                        <div className="flex items-center gap-2">
                                          <Image className="w-4 h-4" />
                                          <span>{media.storage_path}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {media.ocr_status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
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