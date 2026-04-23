/**
 * DocEditor — TipTap-powered WYSIWYG editor
 * Notion + Google Docs style with toolbar
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Heading1, Heading2, Heading3, Minus, Undo, Redo,
  Type, Highlighter, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Toolbar button ────────────────────────────────────────────────────────────

const ToolBtn: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'p-1.5 rounded hover:bg-muted transition-colors text-sm',
      active ? 'bg-primary/10 text-primary' : 'text-foreground',
      disabled && 'opacity-30 pointer-events-none'
    )}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-border mx-0.5 self-center" />;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const EditorToolbar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-border bg-background sticky top-0 z-10">
      {/* Undo / Redo */}
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer">
        <Undo className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer">
        <Redo className="size-3.5" />
      </ToolBtn>
      <Divider />

      {/* Headings */}
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1">
        <Heading1 className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2">
        <Heading2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3">
        <Heading3 className="size-3.5" />
      </ToolBtn>
      <Divider />

      {/* Inline */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (Ctrl+B)">
        <Bold className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (Ctrl+I)">
        <Italic className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)">
        <UnderlineIcon className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
        <Strikethrough className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Destacar">
        <Highlighter className="size-3.5" />
      </ToolBtn>
      <Divider />

      {/* Alignment */}
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar à esquerda">
        <AlignLeft className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar">
        <AlignCenter className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar à direita">
        <AlignRight className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar">
        <AlignJustify className="size-3.5" />
      </ToolBtn>
      <Divider />

      {/* Lists */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista de bullets">
        <List className="size-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
        <ListOrdered className="size-3.5" />
      </ToolBtn>
      <Divider />

      {/* Divider line */}
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha divisória">
        <Minus className="size-3.5" />
      </ToolBtn>
    </div>
  );
};

// ─── Editor component ─────────────────────────────────────────────────────────

export interface DocEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export const DocEditor: React.FC<DocEditorProps> = ({
  content,
  onChange,
  placeholder = 'Comece a escrever… use / para adicionar blocos',
  className,
  editable = true,
}) => {
  // Keep onChange in a ref so TipTap's onUpdate always calls the latest version
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => { onChangeRef.current = onChange; });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
  });

  // Sync external content changes (e.g. document load) into the editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getJSON();
    if (JSON.stringify(content) !== JSON.stringify(current)) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]); // intentionally excludes `editor` — only run when content prop changes

  return (
    <div className={cn('flex flex-col border border-border rounded-xl overflow-hidden bg-background', className)}>
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className={cn(
          'flex-1 overflow-auto',
          'prose prose-sm max-w-none',
          '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:p-4',
          '[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-black [&_.ProseMirror_h1]:mb-3',
          '[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2',
          '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-1',
          '[&_.ProseMirror_p]:mb-3 [&_.ProseMirror_p]:leading-relaxed',
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:mb-3',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:mb-3',
          '[&_.ProseMirror_li]:mb-1',
          '[&_.ProseMirror_hr]:border-border [&_.ProseMirror_hr]:my-4',
          '[&_.ProseMirror_mark]:bg-yellow-100',
          '[&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground/50',
          '[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_.is-editor-empty:first-child::before]:h-0',
        )}
      />
    </div>
  );
};
