import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { Save, RotateCcw, Copy, Check, FileCode, Maximize2, Minimize2 } from 'lucide-react';

interface CodeMirrorEditorProps {
  value: string;
  onChange?: (val: string) => void;
  onSave?: (val: string) => void;
  language?: 'json' | 'yaml' | 'shell' | 'ini' | 'text';
  readOnly?: boolean;
  filename?: string;
  height?: string;
  className?: string;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  onSave,
  language = 'text',
  readOnly = false,
  filename,
  height = '500px',
  className = '',
}) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lineWrap, setLineWrap] = useState(true);

  const readOnlyCompartment = useRef(new Compartment());
  const lineWrapCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());

  // Detect language parser
  const getLanguageExtension = (lang: string) => {
    switch (lang) {
      case 'json':
        return json();
      case 'yaml':
        return yaml();
      default:
        return [];
    }
  };

  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Save keybinding handler
    const saveKeyBinding = keymap.of([
      {
        key: 'Mod-s',
        run: (view) => {
          const content = view.state.doc.toString();
          if (onSave) {
            onSave(content);
            setIsDirty(false);
          }
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newDoc = update.state.doc.toString();
        setIsDirty(true);
        if (onChange) {
          onChange(newDoc);
        }
      }
    });

    const customTheme = EditorView.theme({
      '&': {
        height: isFullscreen ? 'calc(100vh - 54px)' : height,
        backgroundColor: '#0c0f17',
        color: '#e2e8f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        fontSize: '13.5px',
      },
      '.cm-content': {
        padding: '12px 0',
      },
      '.cm-gutters': {
        backgroundColor: '#07090e',
        color: '#64748b',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        color: '#38bdf8',
      },
      '&.cm-focused': {
        outline: 'none',
      },
    });

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
        ]),
        saveKeyBinding,
        updateListener,
        oneDark,
        customTheme,
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        lineWrapCompartment.current.of(lineWrap ? EditorView.lineWrapping : []),
        languageCompartment.current.of(getLanguageExtension(language)),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isFullscreen]);

  // Synchronize external value changes if not modified by user
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString() && !isDirty) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value },
      });
    }
  }, [value, isDirty]);

  // Update line wrapping
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: lineWrapCompartment.current.reconfigure(lineWrap ? EditorView.lineWrapping : []),
      });
    }
  }, [lineWrap]);

  // Update read only
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
      });
    }
  }, [readOnly]);

  const handleCopy = async () => {
    if (!viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevert = () => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      changes: { from: 0, to: viewRef.current.state.doc.length, insert: value },
    });
    setIsDirty(false);
  };

  const handleSaveClick = () => {
    if (!viewRef.current || !onSave) return;
    const content = viewRef.current.state.doc.toString();
    onSave(content);
    setIsDirty(false);
  };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#07090e] shadow-2xl overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      } ${className}`}
    >
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d121f] border-b border-white/10 text-xs select-none">
        <div className="flex items-center space-x-2 min-w-0">
          <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-mono font-medium text-slate-200 truncate">
            {filename || 'Configuration Editor'}
          </span>
          {isDirty && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Unsaved changes
            </span>
          )}
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] uppercase">
            {language}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setLineWrap(!lineWrap)}
            title="Toggle Line Wrap"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              lineWrap
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            Wrap
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy Content"
            className="p-1.5 rounded text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {isDirty && !readOnly && (
            <button
              type="button"
              onClick={handleRevert}
              title="Revert Changes"
              className="p-1.5 rounded text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {!readOnly && onSave && (
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={!isDirty}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
                isDirty
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white cursor-pointer active:scale-95'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
              <span className="hidden md:inline text-[10px] opacity-75">(Ctrl+S)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div ref={editorContainerRef} className="flex-1 overflow-auto" />
    </div>
  );
};
