import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Upload, 
  MessageSquare, 
  Bell, 
  Users, 
  Settings,
  Home,
  TrendingUp,
  Smartphone
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

const menuItems = [
  { title: 'داشبورد', url: '/', icon: Home },
  { title: 'مقایسه قیمت‌ها', url: '/compare', icon: BarChart3 },
  { title: 'تحلیل قیمت‌ها', url: '/price-analysis', icon: TrendingUp },
  { title: 'پردازش داده‌های چت', url: '/chat-data', icon: MessageSquare },
  { title: 'آپلود فایل', url: '/ingest/uploads', icon: Upload },
  { title: 'دریافت از واتس‌اپ', url: '/ingest/whatsapp', icon: MessageSquare },
  { title: 'هشدار قیمت', url: '/alerts', icon: Bell },
  { title: 'فروشنده‌ها', url: '/vendors', icon: Users },
  { title: 'تنظیمات', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  const getNavClass = (path: string) => {
    const active = isActive(path);
    return active 
      ? 'bg-primary text-primary-foreground font-medium' 
      : 'hover:bg-accent hover:text-accent-foreground';
  };

  return (
    <Sidebar
      className={collapsed ? 'w-14' : 'w-64'}
      collapsible="icon"
      side="right"
    >
      <SidebarContent>
        {/* App Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-lg font-bold text-sidebar-foreground">آسا موبایل</h2>
                <p className="text-xs text-sidebar-foreground/70">سامانه قیمت‌گذاری</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>منوی اصلی</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                     <NavLink 
                       to={item.url} 
                       end={item.url === '/'}
                       className={getNavClass(item.url)}
                     >
                       <item.icon className="mr-3 h-4 w-4" />
                       {!collapsed && <span>{item.title}</span>}
                     </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Stats (when expanded) */}
        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel>آمار سریع</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-sidebar-foreground/70">فایل‌های امروز</span>
                  <span className="font-medium text-sidebar-foreground">۲۴</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-sidebar-foreground/70">قیمت‌های جدید</span>
                  <span className="font-medium text-sidebar-foreground">۱۵۶</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-sidebar-foreground/70">هشدار فعال</span>
                  <span className="font-medium text-sidebar-foreground">۸</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}