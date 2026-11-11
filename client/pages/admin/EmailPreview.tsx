import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api/http';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Smartphone, Code, ScanFace, FileCode2, Eye, Copy } from 'lucide-react';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_CARD } from '@/components/admin/common/adminTokens';
import { EmptyState, InlineLoading } from '@/components/admin/common/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TemplateConfig {
  id: string;
  name: string;
  html: string;
}

export default function EmailPreviewPage() {
  const [activeTab, setActiveTab] = useState<string>('');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [renderMode, setRenderMode] = useState<'render' | 'source'>('render');

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminEmailTemplates'],
    queryFn: async () => {
      const res = await request<{ status: string; data: TemplateConfig[] }>('/api/admin/email-preview');
      return res.data;
    }
  });

  const templates = data || [];
  
  // Set default active tab
  React.useEffect(() => {
    if (templates.length > 0 && !activeTab) {
      setActiveTab(templates[0].id);
    }
  }, [templates, activeTab]);

  const currentTemplate = templates.find(t => t.id === activeTab);

  const copy_source = async () => {
    if (!currentTemplate) return;
    try {
      await navigator.clipboard.writeText(currentTemplate.html);
      notify.success('Đã sao chép mã nguồn email');
    } catch {
      notify.error('Không sao chép được, hãy chọn mã nguồn và sao chép thủ công');
    }
  };

  if (isLoading) {
    return (
      <div className="p-12">
        <InlineLoading />
      </div>
    );
  }

  if (error) {
    return (
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
    return (
      <div className={`${ADMIN_CARD} mx-2 mt-2`}>
        <EmptyState icon={<ScanFace className="h-6 w-6" />} title="Chưa có mẫu email nào" />
      </div>
    );
  }

  // Templates exist but the default tab is not selected yet (first render before the effect runs)
  if (!currentTemplate) {
    return (
      <div className="p-12">
        <InlineLoading />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-slate-50 md:flex-row overflow-hidden border border-slate-200 mt-2 mx-2 rounded-xl shadow-sm">
      {/* SIDEBAR */}
      <div className="w-full md:w-[280px] shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
            <Eye className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-slate-800 text-sm">Danh sách mẫu email</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {templates.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => setActiveTab(tmpl.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-start gap-3
                  ${activeTab === tmpl.id 
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                <FileCode2 className={`w-4 h-4 mt-0.5 shrink-0 ${activeTab === tmpl.id ? 'text-blue-200' : 'text-slate-400'}`} />
                <span className="leading-snug">{tmpl.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* VIEWER PORTION */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 relative">
        <div className="h-14 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between px-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('desktop')}
              className={`h-7 px-3 text-xs font-semibold rounded-md ${viewMode === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Monitor className="w-3.5 h-3.5 mr-1.5" />
              Máy tính
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('mobile')}
              className={`h-7 px-3 text-xs font-semibold rounded-md ${viewMode === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              Điện thoại
            </Button>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRenderMode('render')}
              className={`h-7 px-3 text-xs font-semibold rounded-md ${renderMode === 'render' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Xem trước
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRenderMode('source')}
              className={`h-7 px-3 text-xs font-semibold rounded-md ${renderMode === 'source' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
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
        </div>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full flex justify-center">
          {renderMode === 'render' ? (
            <Card className={`overflow-hidden transition-all duration-300 mx-auto border-slate-200 border-x-4 border-t-8 border-b-8 rounded-xl shadow-sm ${
              viewMode === 'mobile' ? 'max-w-[375px] w-full min-h-[667px]' : 'w-full max-w-4xl'
            } bg-white flex flex-col`}>
              {/* An empty sandbox blocks scripts, forms and navigation inside the previewed email */}
              <iframe
                sandbox=""
                srcDoc={currentTemplate.html}
                className="w-full flex-1 border-0 h-[800px] min-h-[600px] bg-white transition-all"
                title="Xem trước email"
              />
            </Card>
          ) : (
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
