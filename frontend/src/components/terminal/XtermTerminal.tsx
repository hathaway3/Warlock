import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Trash2, Terminal as TerminalIcon, Send } from 'lucide-react';

interface XtermTerminalProps {
  streamUrl?: string | null;
  onSendCommand?: (command: string) => Promise<any>;
  title?: string;
  enableInput?: boolean;
}

export const XtermTerminal: React.FC<XtermTerminalProps> = ({
  streamUrl,
  onSendCommand,
  title = 'Live Server Console',
  enableInput = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0a0b0f',
        foreground: '#e2e8f0',
        cursor: '#6366f1',
        cursorAccent: '#0a0b0f',
        selectionBackground: 'rgba(99, 102, 241, 0.4)',
        black: '#0a0e27',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd93d',
        blue: '#38bdf8',
        magenta: '#c084fc',
        cyan: '#4defff',
        white: '#f8fafc',
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;34m[WARLOCK CONSOLE]\x1b[0m Initializing terminal...');

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore fit error if container hidden
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalRef.current = null;
    };
  }, []);

  // Connect to SSE Log stream
  useEffect(() => {
    if (!streamUrl || !terminalRef.current) return;

    const term = terminalRef.current;
    term.writeln(`\x1b[36mConnecting to stream: ${streamUrl}\x1b[0m`);
    setIsStreaming(true);

    const es = new EventSource(streamUrl);

    es.onopen = () => {
      term.writeln('\x1b[32m[CONNECTED]\x1b[0m Streaming live journalctl output...');
      setIsStreaming(true);
    };

    es.onerror = () => {
      term.writeln('\x1b[33m[DISCONNECTED]\x1b[0m Stream closed or disconnected.');
      setIsStreaming(false);
    };

    es.addEventListener('stdout', (e: MessageEvent) => {
      term.writeln(e.data);
    });

    es.addEventListener('stderr', (e: MessageEvent) => {
      term.writeln(`\x1b[31m${e.data}\x1b[0m`);
    });

    es.addEventListener('done', (e: MessageEvent) => {
      term.writeln(`\x1b[35m[STREAM DONE]\x1b[0m ${e.data}`);
      setIsStreaming(false);
    });

    return () => {
      es.close();
      setIsStreaming(false);
    };
  }, [streamUrl]);

  const handleClear = () => {
    terminalRef.current?.clear();
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !onSendCommand) return;

    const cmd = commandInput.trim();
    setCommandInput('');
    terminalRef.current?.writeln(`\x1b[32m>\x1b[0m \x1b[1m${cmd}\x1b[0m`);

    setIsSending(true);
    try {
      const res = await onSendCommand(cmd);
      if (res && res.stdout) {
        terminalRef.current?.writeln(res.stdout);
      }
      if (res && res.stderr) {
        terminalRef.current?.writeln(`\x1b[31m${res.stderr}\x1b[0m`);
      }
    } catch (err: any) {
      terminalRef.current?.writeln(`\x1b[31m[ERROR] ${err.message || String(err)}\x1b[0m`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-[#0a0b0f] border border-indigo-900/30 rounded-xl overflow-hidden shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#12141c] border-b border-indigo-900/25">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <TerminalIcon size={14} className="text-indigo-400" />
          <span>{title}</span>
          <span className="flex items-center gap-1 text-[11px] font-normal text-slate-400 ml-2">
            <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {isStreaming ? 'Live' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClear}
            title="Clear Terminal"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 p-2 bg-[#0a0b0f] overflow-hidden" ref={containerRef} />

      {/* Command Prompt (if enabled) */}
      {enableInput && onSendCommand && (
        <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 p-2 bg-[#12141c] border-t border-indigo-900/30">
          <span className="text-indigo-400 font-mono text-sm pl-2 font-bold">&gt;</span>
          <input
            type="text"
            placeholder="Type console command (e.g. status, save, help)..."
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            disabled={isSending}
            className="flex-1 bg-black/40 border border-indigo-900/40 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isSending || !commandInput.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Send size={12} /> Send
          </button>
        </form>
      )}
    </div>
  );
};
