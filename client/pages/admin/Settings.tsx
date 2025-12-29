import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/admin/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, LayoutDashboard, Users, Clapperboard, Package, Ticket, CreditCard, ScanLine, Eye, EyeOff } from "lucide-react";

const ALL_TABS = [
  { key: "dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
  { key: "users", label: "Người dùng", icon: Users },
  { key: "movies", label: "Phim", icon: Clapperboard },
  { key: "toys", label: "Đồ chơi", icon: Package },
  { key: "tickets", label: "Gói vé", icon: Ticket },
  { key: "transactions", label: "Giao dịch", icon: CreditCard },
  { key: "ticket-check", label: "Kiểm Tra Vé", icon: ScanLine },
  { key: "uploads", label: "Uploads", icon: Clapperboard },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(() => {
    const stored = localStorage.getItem("admin_sidebar_hidden_tabs");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    setAdminEmail(localStorage.getItem("adminEmail") || "admin@email.com");
  }, []);

  const handleToggleTab = (key: string) => {
    const newHidden = hiddenTabs.includes(key)
      ? hiddenTabs.filter(k => k !== key)
      : [...hiddenTabs, key];
    
    setHiddenTabs(newHidden);
    localStorage.setItem("admin_sidebar_hidden_tabs", JSON.stringify(newHidden));
    
    // Trigger sidebar update
    window.dispatchEvent(new Event("admin_sidebar_update"));
    // Also trigger storage event for other windows if necessary
    window.dispatchEvent(new Event("storage"));
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminEmail");
    window.dispatchEvent(new Event("admin-auth-changed"));
    navigate("/admin");
  };

  return (
    <AdminLayout
      active="settings"
      setActive={() => {}}
      adminEmailState={adminEmail}
      handleLogout={handleLogout}
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-200">
                 <SettingsIcon size={28} className="text-white" />
              </div>
              <div>
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Cấu hình Hệ thống</h1>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Tùy chỉnh không gian làm việc của bạn</p>
              </div>
           </div>
           <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold py-1.5 px-4 rounded-xl self-start md:self-center">
              V1.2.0 - Stable
           </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Left Column: UI Customization */}
           <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
                <div className="p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                   <div className="relative z-10 flex items-center gap-4">
                      <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                         <Eye size={24} className="text-blue-400" />
                      </div>
                      <div>
                         <CardTitle className="text-2xl font-black tracking-tight">Cấu hình Hiển thị Menu</CardTitle>
                         <p className="text-slate-400 text-sm font-medium mt-1">Bật/Tắt các đề mục trên thanh điều hướng để tối ưu hóa diện tích</p>
                      </div>
                   </div>
                </div>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ALL_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isHidden = hiddenTabs.includes(tab.key);
                      return (
                        <div 
                          key={tab.key} 
                          className={`group flex items-center justify-between p-5 rounded-[1.5rem] border transition-all duration-500 ${
                            isHidden 
                            ? 'bg-slate-50 border-slate-100' 
                            : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 cursor-pointer'
                          }`}
                          onClick={() => handleToggleTab(tab.key)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500 ${
                              isHidden ? 'bg-slate-200 text-slate-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                            }`}>
                              <Icon size={20} />
                            </div>
                            <div className="flex flex-col">
                              <span className={`font-black text-sm tracking-tight ${isHidden ? 'text-slate-400' : 'text-slate-900'}`}>{tab.label}</span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {isHidden ? 'Đang ẩn' : 'Hiển thị'}
                              </span>
                            </div>
                          </div>
                          <Switch 
                            checked={!isHidden} 
                            onCheckedChange={() => handleToggleTab(tab.key)}
                            className="data-[state=checked]:bg-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
           </div>

           {/* Right Column: Tips & Info */}
           <div className="space-y-6">
              <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] bg-indigo-600 text-white p-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                 <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                    <LayoutDashboard size={20} /> Mẹo nhỏ
                 </h3>
                 <p className="text-sm font-medium text-indigo-100 leading-[1.6]">
                    Bạn có thể ẩn đi những mục ít sử dụng như "Uploads" hoặc "Đồ chơi" để thanh điều hướng trông gọn gàng hơn. Đừng lo, các mục này sẽ không bị xóa vĩnh viễn!
                 </p>
              </Card>

              <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2rem] space-y-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                   <SettingsIcon size={20} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Quyền riêng tư</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                   Cài đặt hiển thị này được lưu trữ riêng trên trình duyệt của bạn (LocalStorage) và không ảnh hưởng đến các Admin khác trong hệ thống.
                </p>
              </div>
           </div>
        </div>
      </div>
    </AdminLayout>
  );
}
