import React, { useCallback, useRef } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { httpClient } from '../../api/httpClient';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Upload,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Redo,
  Undo,
  Code2,
} from 'lucide-react';

const lowlight = createLowlight(common);

// Custom Image extension with resizing and alignment
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      align: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-align') || 'left',
        renderHTML: attributes => {
          return { 'data-align': attributes.align };
        },
      },
    };
  },
  
  renderHTML({ HTMLAttributes }) {
    const { align, ...rest } = HTMLAttributes;
    const alignClass = align === 'center' ? 'mx-auto block' : align === 'right' ? 'ml-auto block' : '';
    
    return ['img', { ...rest, class: `${rest.class || ''} ${alignClass}`.trim() }];
  },
});
import { Button } from './button';
import { Separator } from './separator';
import { Label } from './label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './dialog';
import { Input } from './input';
import { useState, useEffect } from 'react';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  label?: React.ReactNode; // Changed from string to ReactNode
  helperText?: string;
  scenarioId?: string; // For organizing MinIO uploads by scenario
}

export const TiptapEditor = React.forwardRef<HTMLDivElement, TiptapEditorProps>(
  ({
    value,
    onChange,
    placeholder = 'Start typing...',
    minHeight = '400px',
    label,
    helperText,
    scenarioId,
  }, ref) => {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [resizeDialogOpen, setResizeDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [imageWidth, setImageWidth] = useState('');
  const [imageHeight, setImageHeight] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const minioImagesRef = useRef<Set<string>>(new Set()); // Track MinIO images for cleanup
  const selectedImagePos = useRef<number | null>(null);
  const isSyncingRef = useRef(false); // Prevent deletion during external content sync

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      ResizableImage.configure({
        inline: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg border my-4 resizable-image',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border border-border',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-3 min-w-[100px]',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border p-3 bg-muted font-semibold min-w-[100px]',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-muted p-4 rounded-lg my-4 overflow-x-auto',
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[${minHeight}] p-4`,
      },
      handleDOMEvents: {
        click: (view, event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === 'IMG') {
            event.preventDefault();
            const pos = view.posAtDOM(target, 0);
            selectedImagePos.current = pos;
            
            // Get current dimensions
            const currentWidth = target.getAttribute('width') || target.naturalWidth.toString();
            const currentHeight = target.getAttribute('height') || target.naturalHeight.toString();
            
            setImageWidth(currentWidth);
            setImageHeight(currentHeight);
            setResizeDialogOpen(true);
            return true;
          }
          return false;
        },
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            uploadImageDirectly(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                event.preventDefault();
                uploadImageDirectly(file);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      
      // Skip deletion during external sync (temp → permanent URL replacement)
      if (isSyncingRef.current) {
        return;
      }
      
      // Track MinIO images for cleanup when deleted from editor
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img');
      
      const currentImages = new Set<string>();
      images.forEach(img => {
        const src = img.getAttribute('src');
        // Track both new (/api/assets/file/) and legacy (/rangex-assets/) formats
        if (src && (src.includes('/api/assets/file/') || src.includes('/rangex-assets/'))) {
          currentImages.add(src);
        }
      });
      
      // Delete images that were removed from editor
      const imagesToDelete: string[] = [];
      minioImagesRef.current.forEach(imageUrl => {
        if (!currentImages.has(imageUrl)) {
          imagesToDelete.push(imageUrl);
        }
      });
      
      // Delete after iteration to avoid concurrent modification
      imagesToDelete.forEach(imageUrl => {
        deleteImageFromMinio(imageUrl);
        minioImagesRef.current.delete(imageUrl);
      });
      
      // Update tracked images
      minioImagesRef.current = currentImages;
    },
  });

  // ✅ Sync editor content when value prop changes (e.g., backend returns updated URLs)
  useEffect(() => {
    if (!editor) return;
    
    const currentHTML = editor.getHTML();
    // Only update if the value is significantly different (not just whitespace/formatting)
    const normalizeHTML = (html: string | undefined | null) => {
      if (!html || html === null || html === undefined) return '';
      return html.replace(/\s+/g, ' ').trim();
    };
    const valuesMatch = normalizeHTML(value) === normalizeHTML(currentHTML);
    
    console.log('[TiptapEditor useEffect] value prop length:', value?.length);
    console.log('[TiptapEditor useEffect] editor HTML length:', currentHTML?.length);
    console.log('[TiptapEditor useEffect] values match?', valuesMatch);
    
    if (!valuesMatch && value) {
      // Set sync flag to prevent deletion during update
      isSyncingRef.current = true;
      
      editor.commands.setContent(value, false); // false = don't trigger onUpdate
      
      // CRITICAL: Rebuild tracking refs after external content update (temp → permanent URLs)
      const parser = new DOMParser();
      const doc = parser.parseFromString(value, 'text/html');
      const images = doc.querySelectorAll('img');
      
      const newImages = new Set<string>();
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && (src.includes('/api/assets/file/') || src.includes('/rangex-assets/'))) {
          newImages.add(src);
        }
      });
      
      minioImagesRef.current = newImages;
      
      // Reset sync flag after update complete
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  // Upload image directly to MinIO on paste/drop (INDUSTRY STANDARD)
  const uploadImageDirectly = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      // Upload to MinIO temp folder - backend will move to permanent on save
      const { uploadImageToMinio } = await import('../../utils/imageUpload');
      const minioUrl = await uploadImageToMinio(file, 'temp', scenarioId);
      
      // Insert temp MinIO URL directly into editor (NO base64!)
      editor.chain().focus().setImage({ src: minioUrl }).run();
      console.log('[TiptapEditor] Uploaded image to MinIO temp:', minioUrl);
    } catch (error) {
      console.error('[TiptapEditor] Image upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const deleteImageFromMinio = async (imageUrl: string) => {
    try {
      // Extract path from API proxy URL: /api/assets/file/{path}
      const cleanUrl = imageUrl.split('?')[0];
      
      let objectPath: string | null = null;
      if (cleanUrl.includes('/api/assets/file/')) {
        // New format: /api/assets/file/scenarios/editor-images/uuid.png
        const parts = cleanUrl.split('/api/assets/file/');
        objectPath = parts[1] || null;
      } else if (cleanUrl.includes('/rangex-assets/')) {
        // Legacy format: http://localhost:9000/rangex-assets/scenarios/...
        const parts = cleanUrl.split('/rangex-assets/');
        objectPath = parts[1] || null;
      }
      
      if (!objectPath) {
        console.error('[TiptapEditor] Invalid URL format:', imageUrl);
        return;
      }
      
      // Only delete images from temp or editor-images folders (safety check)
      if (!objectPath.includes('editor-images/') && !objectPath.includes('temp/')) {
        console.warn('[TiptapEditor] Not deleting - not from temp or editor-images folder:', objectPath);
        return;
      }
      
      console.log('[TiptapEditor] Deleting from MinIO:', objectPath);
      await httpClient.delete(`/upload/image/${encodeURIComponent(objectPath)}`);
      console.log('[TiptapEditor] Successfully deleted:', objectPath);
    } catch (error) {
      console.error('[TiptapEditor] Failed to delete image from MinIO:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImageDirectly(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const insertLink = () => {
    if (linkUrl) {
      if (linkText) {
        editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkText}</a>`).run();
      } else {
        editor.chain().focus().setLink({ href: linkUrl }).run();
      }
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  const insertImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt }).run();
    }
    setImageDialogOpen(false);
    setImageUrl('');
    setImageAlt('');
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
    setTableDialogOpen(false);
    setTableRows(3);
    setTableCols(3);
  };

  const resizeImage = () => {
    if (selectedImagePos.current !== null && editor) {
      const attrs: any = {};
      
      if (imageWidth) attrs.width = imageWidth;
      if (imageHeight) attrs.height = imageHeight;
      
      editor.chain().focus().setNodeSelection(selectedImagePos.current).updateAttributes('image', attrs).run();
      
      setResizeDialogOpen(false);
      setImageWidth('');
      setImageHeight('');
      selectedImagePos.current = null;
    }
  };

  const alignImage = (alignment: 'left' | 'center' | 'right') => {
    if (selectedImagePos.current !== null && editor) {
      editor.chain().focus().setNodeSelection(selectedImagePos.current).updateAttributes('image', { align: alignment }).run();
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-semibold">{label}</Label>}

      <div className="border rounded-lg cyber-border overflow-hidden bg-background">
        {/* Toolbar */}
        <div className="bg-muted/50 border-b border-border p-2 flex flex-wrap items-center gap-1">
          {/* Text Formatting */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-accent' : ''}`}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-accent' : ''}`}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('underline') ? 'bg-accent' : ''}`}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('code') ? 'bg-accent' : ''}`}
          >
            <Code className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Headings */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}`}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}`}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''}`}
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Lists */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-accent' : ''}`}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-accent' : ''}`}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-accent' : ''}`}
          >
            <Quote className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Alignment */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent' : ''}`}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent' : ''}`}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent' : ''}`}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Insert Elements */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLinkDialogOpen(true)}
            className="h-8 w-8 p-0"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-8 w-8 p-0"
            title="Upload Image"
          >
            {uploading ? <Code className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImageDialogOpen(true)}
            className="h-8 w-8 p-0"
            title="Insert Image URL"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('codeBlock') ? 'bg-accent' : ''}`}
          >
            <Code2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTableDialogOpen(true)}
            className="h-8 w-8 p-0"
          >
            <TableIcon className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Undo/Redo */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Editor Content */}
        <EditorContent editor={editor} className="prose-editor" style={{ minHeight }} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>Add a hyperlink to your content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="link-text">Link Text (optional)</Label>
              <Input
                id="link-text"
                placeholder="Click here"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertLink}>Insert Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>Add an image to your content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="image-alt">Alt Text (optional)</Label>
              <Input
                id="image-alt"
                placeholder="Description of the image"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertImage}>Insert Image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
            <DialogDescription>Create a table with custom dimensions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="table-rows">Number of Rows</Label>
              <Input
                id="table-rows"
                type="number"
                min="1"
                max="20"
                value={tableRows}
                onChange={(e) => setTableRows(parseInt(e.target.value) || 3)}
              />
            </div>
            <div>
              <Label htmlFor="table-cols">Number of Columns</Label>
              <Input
                id="table-cols"
                type="number"
                min="1"
                max="10"
                value={tableCols}
                onChange={(e) => setTableCols(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertTable}>Insert Table</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resize & Align Image Dialog */}
      <Dialog open={resizeDialogOpen} onOpenChange={setResizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resize & Align Image</DialogTitle>
            <DialogDescription>Adjust image size and alignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alignment</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => alignImage('left')}
                  className="flex-1"
                >
                  <AlignLeft className="h-4 w-4 mr-2" />
                  Left
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => alignImage('center')}
                  className="flex-1"
                >
                  <AlignCenter className="h-4 w-4 mr-2" />
                  Center
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => alignImage('right')}
                  className="flex-1"
                >
                  <AlignRight className="h-4 w-4 mr-2" />
                  Right
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="image-width">Width (px or %)</Label>
              <Input
                id="image-width"
                placeholder="e.g., 500 or 50%"
                value={imageWidth}
                onChange={(e) => setImageWidth(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="image-height">Height (px or %)</Label>
              <Input
                id="image-height"
                placeholder="e.g., 300 or auto"
                value={imageHeight}
                onChange={(e) => setImageHeight(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              💡 Tip: Set only width to maintain aspect ratio. Click alignment buttons above to position the image.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resizeImage}>Apply Size</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

TiptapEditor.displayName = 'TiptapEditor';
