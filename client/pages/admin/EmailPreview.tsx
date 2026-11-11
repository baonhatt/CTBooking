import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { request } from '@/lib/api/http';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Smartphone, Code, ScanFace, FileCode2, Eye, Copy, FileText, AlertTriangle, Users, UserCog, Send } from 'lucide-react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_CARD } from '@/components/admin/common/adminTokens';
import { EmptyState, InlineLoading } from '@/components/admin/common/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TemplateConfig {
  id: string;
  name: string;
  audience: 'user' | 'staff';
  /** The subject line the mail is really sent with */
  subject: string;
  /** False when no part of the app sends this mail yet */
  sent: boolean;
  html: string;
  text: string;
}

interface BrandSettings {
  supportEmail: string;
  hotline: string;
  companyAddress: string;
}

interface EmailPreviewResponse {
  status: string;
  data: TemplateConfig[];
  brand?: BrandSettings;
}

const AUDIENCE_GROUPS: { audience: 'user' | 'staff'; label: string; icon: React.ReactNode }[] = [
  { audience: 'user', label: 'Email gửi khách hàng', icon: <Users className="h-3.5 w-3.5" /> },
  { audience: 'staff', label: 'Email gửi nhân viên', icon: <UserCog className="h-3.5 w-3.5" /> }
];

/** Settings the mails print in the footer. A blank one is left out of the mail, so say so here. */
function missing_brand_settings(brand?: BrandSettings): string[] {
  if (!brand) return [];
  const missing: string[] = [];
  if (!brand.hotline) missing.push('hotline');
  if (!brand.companyAddress) missing.push('địa chỉ');
  return missing;
}

export default function EmailPreviewPage() {
  const [activeTab, setActiveTab] = useState<string>('');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [renderMode, setRenderMode] = useState<'render' | 'text' | 'source'>('render');
  const [active, setActive] = useState<any>('email-templates');

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminEmailTemplates'],
    queryFn: async () => {
      const res = await request<EmailPreviewResponse>('/api/admin/email-preview');
      return res;
    }
  });

  const templates = data?.data || [];
  const missing_settings = missing_brand_settings(data?.brand);
  const admin_email = localStorage.getItem('adminEmail') || '';

  const handle_logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    window.dispatchEvent(new Event('admin-auth-changed'));
    window.location.href = '/';
  };
  
  // Set default active tab
  React.useEffect(() => {
    if (templates.length > 0 && !activeTab) {
      setActiveTab(templates[0].id);
    }
  }, [templates, activeTab]);

  const currentTemplate = templates.find(t => t.id === activeTab);

  // Sends the selected sample to the address typed in the box next to the button
  const [test_email, setTestEmail] = useState<string>(() => localStorage.getItem('adminEmail') || '');
  const send_test = useMutation({
    mutationFn: async (input: { templateId: string; toEmail: string }) =>
      request<{ status: string; message: string }>('/api/admin/email-preview/send-test', {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    onSuccess: (res) => notify.success(res.message || 'Đã gửi thư thử'),
    onError: (err: any) => notify.error(err, 'Không gửi được thư thử')
  });

  const copy_source = async () => {
    if (!currentTemplate) return;
    try {
      await navigator.clipboard.writeText(currentTemplate.html);
      notify.success('Đã sao chép mã nguồn email');
    } catch {
      notify.error('Không sao chép được, hãy chọn mã nguồn và sao chép thủ công');
    }
  };

  const with_layout = (content: React.ReactNode) => (
    <AdminLayout active={active} setActive={setActive} adminEmailState={admin_email} handleLogout={handle_logout}>
      {content}
    </AdminLayout>
  );

  if (isLoading) {
    return with_layout(
      <div className="p-12">
        <InlineLoading />
      </div>
    );
  }

  if (error) {
    return with_layout(
      <div className={`${ADMIN_CARD} mx-2 mt-2`}>
        <EmptyState
          icon={<ScanFace className="h-6 w-6" />}
          title="Không tải được dữ liệu mẫu email"
          description="Vui lòng thử lại sau."
        />
      </div>
    );
  }

  if (templates.length === 0) {
    return with_layout(
      <div className={`${ADMIN_CARD} mx-2 mt-2`}>
        <EmptyState icon={<ScanFace className="h-6 w-6" />} title="Chưa có mẫu email nào" />
      </div>
    );
  }

  // Templates exist but the default tab is not selected yet (first render before the effect runs)
  if (!currentTemplate) {
    return with_layout(
      <div className="p-12">
        <InlineLoading />
      </div>
    );
  }

  const toggle_class = (selected: boolean) =>
    `h-7 px-3 text-xs font-semibold rounded-md ${selected ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`;

  return with_layout(
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-slate-50 md:flex-row overflow-hidden border border-slate-200 mt-2 mx-2 rounded-xl shadow-sm">
      {/* SIDEBAR */}
      <div className="w-full md:w-[290px] shrink-0 bg-white border-r border-slate-200 flex flex-col max-h-60 md:max-h-none">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
            <Eye className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-slate-800 text-sm">Danh sách mẫu email</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {AUDIENCE_GROUPS.map((group) => {
              const items = templates.filter((tmpl) => tmpl.audience === group.audience);
              if (items.length === 0) return null;
              return (
                <div key={group.audience} className="space-y-1">
                  <div className="px-2 pb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {group.icon}
                    {group.label}
                  </div>
                  {items.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => setActiveTab(tmpl.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-start gap-3
                        ${activeTab === tmpl.id
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                      <FileCode2 className={`w-4 h-4 mt-0.5 shrink-0 ${activeTab === tmpl.id ? 'text-blue-200' : 'text-slate-400'}`} />
                      <span className="leading-snug">
                        {tmpl.name}
                        {!tmpl.sent && (
                          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tmpl.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                            Chưa gửi
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* VIEWER PORTION */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 relative">
        <div className="min-h-14 border-b border-slate-200 bg-white shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('desktop')} className={toggle_class(viewMode === 'desktop')}>
              <Monitor className="w-3.5 h-3.5 mr-1.5" />
              Máy tính
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode('mobile')} className={toggle_class(viewMode === 'mobile')}>
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              Điện thoại
            </Button>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setRenderMode('render')} className={toggle_class(renderMode === 'render')}>
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Xem trước
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRenderMode('text')} className={toggle_class(renderMode === 'text')}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Văn bản thuần
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRenderMode('source')} className={toggle_class(renderMode === 'source')}>
              <Code className="w-3.5 h-3.5 mr-1.5" />
              Mã nguồn
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={copy_source}
            className={`${ADMIN_BTN_OUTLINE} h-8 shrink-0 px-3 text-xs`}
            title="Sao chép mã nguồn HTML của mẫu đang chọn"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Sao chép mã nguồn
          </Button>

          <form
            className="flex shrink-0 items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              send_test.mutate({ templateId: currentTemplate.id, toEmail: test_email.trim() });
            }}
          >
            <input
              type="email"
              value={test_email}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="Email nhận thư thử"
              aria-label="Email nhận thư thử"
              required
              className="h-8 w-56 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={send_test.isPending || !test_email.trim()}
              className={`${ADMIN_BTN_OUTLINE} h-8 shrink-0 px-3 text-xs`}
              title="Gửi mẫu đang chọn tới email vừa nhập để xem trong hộp thư thật"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {send_test.isPending ? 'Đang gửi...' : 'Gửi thử'}
            </Button>
          </form>
        </div>

        <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Tiêu đề thư: </span>
          <span className="font-medium text-slate-800">{currentTemplate.subject}</span>
        </div>

        {missing_settings.length > 0 && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Chưa có <strong>{missing_settings.join(', ')}</strong> để in ở chân thư. Hãy nhập trong
              Quản lý chi nhánh cho chi nhánh mặc định (hotline ở phần cài đặt chi nhánh), hoặc khai báo biến môi trường
              của worker. Cho tới lúc đó dòng này được bỏ khỏi thư.
            </span>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full flex justify-center">
          {renderMode === 'render' && (
            <Card className={`overflow-hidden transition-all duration-300 mx-auto border-slate-200 border-x-4 border-t-8 border-b-8 rounded-xl shadow-sm ${
              viewMode === 'mobile' ? 'max-w-[375px] w-full min-h-[667px]' : 'w-full max-w-4xl'
            } bg-white flex flex-col`}>
              {/* An empty sandbox blocks scripts, forms and navigation inside the previewed email */}
              <iframe
                sandbox=""
                srcDoc={currentTemplate.html}
                className="w-full flex-1 border-0 h-[900px] min-h-[600px] bg-white transition-all"
                title="Xem trước email"
              />
            </Card>
          )}
          {renderMode === 'text' && (
            <Card className="w-full max-w-3xl mx-auto overflow-hidden bg-white border-slate-200 flex flex-col p-0">
              <ScrollArea className="flex-1">
                <pre className="text-sm font-mono text-slate-700 p-6 whitespace-pre-wrap leading-relaxed">{currentTemplate.text}</pre>
              </ScrollArea>
            </Card>
          )}
          {renderMode === 'source' && (
            <Card className="w-full max-w-5xl mx-auto overflow-hidden bg-slate-900 border-slate-800 flex flex-col p-0">
              <ScrollArea className="flex-1">
                <pre className="text-xs font-mono text-emerald-400 p-6 break-all whitespace-pre-wrap leading-relaxed selection:bg-emerald-500/30">
                  {currentTemplate.html}
                </pre>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
