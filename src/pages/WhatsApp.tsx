import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquare, Phone, Settings, CheckCircle, XCircle, Image, QrCode, Calendar as CalendarIcon, Download, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

interface Integration {
  id: string;
  type: 'whatsapp';
  active: boolean;
  config: {
    session_id?: string;
    qr_code?: string;
    connected?: boolean;
    phone_number?: string;
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

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  last_message: string;
  last_activity: string;
  unread_count: number;
}

export default function WhatsApp() {
  const [qrCode, setQrCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
    from: undefined,
    to: undefined
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
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

  // Generate QR Code for WhatsApp Web connection using Puppeteer
  const generateQRCode = async () => {
    if (!user?.id) {
      toast({
        title: 'خطا',
        description: 'لطفا وارد حساب کاربری خود شوید',
        variant: 'destructive'
      });
      return;
    }

    setConnectionStatus('connecting');
    setQrCode('');

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: {
          action: 'generate_qr',
          user_id: user.id
        }
      });

      if (error) throw error;

      setQrCode(data.qr_code);
      setCurrentSession(data.session_id);
      
      // Start checking connection status
      checkConnectionStatus(data.session_id);
      
      toast({
        title: 'QR کد تولید شد',
        description: 'QR کد را با واتس‌اپ بیزینس خود اسکن کنید'
      });

    } catch (error) {
      console.error('Error generating QR code:', error);
      setConnectionStatus('failed');
      toast({
        title: 'خطا در تولید QR کد',
        description: 'مشکلی در اتصال به واتس‌اپ پیش آمد',
        variant: 'destructive'
      });
    }
  };

  // Check connection status periodically
  const checkConnectionStatus = async (sessionId: string) => {
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
          body: {
            action: 'check_status',
            session_id: sessionId
          }
        });

        if (error) throw error;

        if (data.connected) {
          setIsConnected(true);
          setConnectionStatus('connected');
          createIntegrationMutation.mutate();
          toast({
            title: 'اتصال برقرار شد',
            description: `با موفقیت به واتس‌اپ بیزینس متصل شدید${data.phone_number ? ` - ${data.phone_number}` : ''}`
          });
        } else if (data.status === 'failed') {
          setConnectionStatus('failed');
          toast({
            title: 'اتصال ناموفق',
            description: 'اتصال به واتس‌اپ با خطا مواجه شد',
            variant: 'destructive'
          });
        } else {
          // Continue checking
          setTimeout(checkStatus, 3000);
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setConnectionStatus('failed');
      }
    };

    setTimeout(checkStatus, 3000);
  };

  const createIntegrationMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.org_id) throw new Error('کاربر وارد نشده است');
      
      const { data, error } = await supabase
        .from('integrations')
        .insert({
          type: 'whatsapp',
          org_id: profile.org_id,
          active: true,
          config: {
            session_id: `session_${Date.now()}`,
            connected: true,
            phone_number: 'Connected via QR'
          }
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
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

  // Mock contacts data
  const contacts: Contact[] = [
    {
      id: '1',
      name: 'فروشگاه موبایل پارس',
      phone_number: '+98912xxxxxxx',
      last_message: 'iPhone 15 Pro 256GB آبی تیتانیوم 48,500,000 تومان',
      last_activity: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      unread_count: 2
    },
    {
      id: '2', 
      name: 'تک‌نولوژی سامسونگ',
      phone_number: '+98913xxxxxxx',
      last_message: 'Galaxy S24 Ultra 512GB مشکی موجود',
      last_activity: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      unread_count: 0
    },
    {
      id: '3',
      name: 'فروشگاه Apple Store',
      phone_number: '+98914xxxxxxx', 
      last_message: 'MacBook Air M3 قیمت ویژه',
      last_activity: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      unread_count: 1
    }
  ];

  const extractMessages = useMutation({
    mutationFn: async () => {
      if (!selectedContact || !dateRange.from || !dateRange.to || !profile?.org_id) {
        throw new Error('لطفا مخاطب و بازه تاریخ را انتخاب کنید');
      }

      setIsExtracting(true);
      
      // Simulate message extraction
      const extractedMessages = [
        {
          chat_id: `chat_${selectedContact.id}_${Date.now()}`,
          org_id: profile.org_id,
          sender: selectedContact.phone_number,
          text: `پیام استخراج شده از ${selectedContact.name} - iPhone 14 Pro Max 256GB طلایی 45,000,000 تومان`,
          has_media: true,
          timestamp: new Date(dateRange.from.getTime() + Math.random() * (dateRange.to.getTime() - dateRange.from.getTime())).toISOString()
        },
        {
          chat_id: `chat_${selectedContact.id}_${Date.now() + 1}`,
          org_id: profile.org_id,
          sender: selectedContact.phone_number,
          text: `پیام استخراج شده از ${selectedContact.name} - Galaxy S23 Ultra 512GB مشکی 38,500,000 تومان موجود`,
          has_media: false,
          timestamp: new Date(dateRange.from.getTime() + Math.random() * (dateRange.to.getTime() - dateRange.from.getTime())).toISOString()
        }
      ];

      const { error } = await supabase
        .from('messages')
        .insert(extractedMessages);

      if (error) throw error;

      // Add media files for messages with media
      for (const message of extractedMessages) {
        if (message.has_media) {
          const { data: messageData } = await supabase
            .from('messages')
            .select('id')
            .eq('chat_id', message.chat_id)
            .single();

          if (messageData) {
            await supabase
              .from('media_files')
              .insert({
                message_id: messageData.id,
                org_id: profile.org_id,
                storage_path: `/media/${selectedContact.name}_${Date.now()}.jpg`,
                mime_type: 'image/jpeg',
                ocr_status: 'queued'
              });
          }
        }
      }

      return extractedMessages;
    },
    onSuccess: (data) => {
      setIsExtracting(false);
      toast({
        title: 'استخراج موفق',
        description: `${data.length} پیام از ${selectedContact?.name} استخراج و ذخیره شد`
      });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media_files'] });
    },
    onError: () => {
      setIsExtracting(false);
      toast({
        title: 'خطا در استخراج',
        description: 'مشکلی در استخراج پیام‌ها پیش آمد',
        variant: 'destructive'
      });
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
          اتصال با واتس‌اپ بیزینس و استخراج پیام‌ها و رسانه‌ها
        </p>
      </div>

      {/* QR Code Connection */}
      <Card>
        <CardHeader>
          <CardTitle>اتصال با واتس‌اپ بیزینس</CardTitle>
          <CardDescription>
            برای اتصال، QR کد را با واتس‌اپ بیزینس خود اسکن کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected || activeIntegration ? (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-800">متصل شده</h3>
                  <p className="text-sm text-green-600">
                    اتصال با واتس‌اپ بیزینس برقرار است
                  </p>
                </div>
              </div>
              <Switch
                checked={activeIntegration?.active || isConnected}
                onCheckedChange={(checked) => {
                  if (activeIntegration) {
                    toggleIntegrationMutation.mutate({ 
                      id: activeIntegration.id, 
                      active: checked 
                    });
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center space-y-4">
              {qrCode ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img src={qrCode} alt="QR Code" className="w-48 h-48 border rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      QR کد را با واتس‌اپ بیزینس خود اسکن کنید
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connectionStatus === 'connecting' ? 'در حال بارگذاری واتس‌اپ وب...' : 'در حال انتظار برای اتصال...'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-48 h-48 mx-auto border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <Button 
                    onClick={generateQRCode} 
                    className="w-full"
                    disabled={connectionStatus === 'connecting'}
                  >
                    {connectionStatus === 'connecting' ? (
                      <>
                        <div className="w-4 h-4 ml-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        در حال اتصال به واتس‌اپ...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 ml-2" />
                        تولید QR کد
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts List */}
      {(isConnected || activeIntegration) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              لیست مخاطبین
            </CardTitle>
            <CardDescription>
              مخاطبین واتس‌اپ برای استخراج پیام‌ها
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div 
                  key={contact.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedContact?.id === contact.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Phone className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">{contact.name}</h3>
                        <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {contact.last_message}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(contact.last_activity)}
                      </p>
                      {contact.unread_count > 0 && (
                        <Badge variant="secondary" className="mt-1">
                          {contact.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Extraction */}
      {selectedContact && (
        <Card>
          <CardHeader>
            <CardTitle>استخراج پیام‌ها</CardTitle>
            <CardDescription>
              استخراج تمام پیام‌ها و رسانه‌های {selectedContact.name} در بازه زمانی انتخابی
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاریخ شروع</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from && !isNaN(dateRange.from.getTime()) ? format(dateRange.from, 'PPP') : 'انتخاب تاریخ'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>تاریخ پایان</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to && !isNaN(dateRange.to.getTime()) ? format(dateRange.to, 'PPP') : 'انتخاب تاریخ'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button 
              onClick={() => extractMessages.mutate()}
              disabled={!dateRange.from || !dateRange.to || isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  در حال استخراج...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 ml-2" />
                  استخراج پیام‌ها و رسانه‌ها
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

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