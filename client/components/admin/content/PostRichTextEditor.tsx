import { useEffect, useMemo, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  Alignment,
  BlockQuote,
  Bold,
  ClassicEditor,
  EditorConfig,
  Essentials,
  Heading,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  List,
  Paragraph,
  PictureEditing,
  Underline,
  Undo
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';
import { toast } from 'sonner';

type PostRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

function normalizeInitialContent(value?: string) {
  if (!value) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;

  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
}

class CloudinaryUploadAdapter {
  private loader: any;

  constructor(loader: any) {
    this.loader = loader;
  }

  async upload() {
    const file = await this.loader.file;
    const result = await uploadDirectToCloudinary(file, 'posts');

    return {
      default: result.url
    };
  }

  abort() {
    return;
  }
}

function cloudinaryUploadPlugin(editor: any) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
    return new CloudinaryUploadAdapter(loader);
  };
}

export function PostRichTextEditor({ value, onChange }: PostRichTextEditorProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editorData, setEditorData] = useState(() => normalizeInitialContent(value));

  const editorConfig = useMemo<EditorConfig>(
    () => ({
      licenseKey: 'GPL',
      plugins: [
        Essentials,
        Paragraph,
        Heading,
        Alignment,
        Bold,
        Italic,
        Underline,
        Link,
        List,
        BlockQuote,
        Image,
        ImageToolbar,
        ImageCaption,
        ImageStyle,
        ImageResize,
        ImageUpload,
        PictureEditing,
        Undo
      ],
      toolbar: [
        'undo',
        'redo',
        '|',
        'heading',
        '|',
        'bold',
        'italic',
        'underline',
        'alignment',
        'link',
        '|',
        'bulletedList',
        'numberedList',
        'blockQuote',
        '|',
        'uploadImage'
      ],
      heading: {
        options: [
          {
            model: 'paragraph',
            title: 'Đoạn văn',
            class: 'ck-heading_paragraph'
          },
          {
            model: 'heading2',
            view: 'h2',
            title: 'Tiêu đề',
            class: 'ck-heading_heading2'
          }
        ]
      },
      alignment: {
        options: ['left', 'center', 'right', 'justify']
      },
      image: {
        toolbar: ['imageTextAlternative', '|', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side']
      },
      extraPlugins: [cloudinaryUploadPlugin]
    }),
    []
  );

  useEffect(() => {
    const nextValue = normalizeInitialContent(value);
    if (editorData !== nextValue) {
      setEditorData(nextValue);
    }
  }, [editorData, value]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm [&_.ck.ck-editor]:border-0 [&_.ck.ck-editor__main>.ck-editor__editable]:min-h-[260px] [&_.ck.ck-editor__main>.ck-editor__editable]:border-0 [&_.ck.ck-editor__main>.ck-editor__editable]:px-4 [&_.ck.ck-editor__main>.ck-editor__editable]:py-3 [&_.ck.ck-editor__main>.ck-editor__editable]:text-sm [&_.ck.ck-editor__main>.ck-editor__editable]:leading-6 [&_.ck.ck-editor__top_.ck-sticky-panel_.ck-toolbar]:border-0 [&_.ck.ck-toolbar]:border-0 [&_.ck.ck-toolbar]:border-b [&_.ck.ck-toolbar]:border-slate-200 [&_.ck.ck-toolbar]:bg-slate-50 [&_.ck-content_.image>img]:rounded-xl [&_.ck-content_.image>img]:max-w-full">
        <CKEditor
          editor={ClassicEditor}
          data={editorData}
          config={editorConfig}
          onReady={(editor) => {
            const fileRepository = editor.plugins.get('FileRepository');
            const originalCreateUploadAdapter = fileRepository.createUploadAdapter.bind(fileRepository);

            fileRepository.createUploadAdapter = (loader: any) => {
              setIsUploadingImage(true);
              const adapter = originalCreateUploadAdapter(loader);
              const originalUpload = adapter.upload.bind(adapter);

              adapter.upload = async () => {
                try {
                  const result = await originalUpload();
                  toast.success('Đã chèn ảnh vào nội dung');
                  return result;
                } catch (error: any) {
                  toast.error('Lỗi upload ảnh', {
                    description: error?.message || 'Không thể tải ảnh lên'
                  });
                  throw error;
                } finally {
                  setIsUploadingImage(false);
                }
              };

              return adapter;
            };
          }}
          onChange={(_, editor) => {
            const data = editor.getData();
            setEditorData(data);
            onChange(data);
          }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {isUploadingImage
          ? 'Đang tải ảnh lên Cloudinary...'
          : 'CKEditor 5 đang được dùng cho nội dung bài viết và hỗ trợ chèn ảnh trực tiếp.'}
      </p>
    </div>
  );
}
