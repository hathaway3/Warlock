import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import type { FileItem } from '../../types';
import { CodeMirrorEditor } from '../editor/CodeMirrorEditor';
import {
  Folder,
  File,
  FileText,
  FileArchive,
  ArrowUp,
  RefreshCw,
  Upload,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit2,
  Download,
  Archive,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  HardDrive
} from 'lucide-react';

interface FileManagerProps {
  host: string;
  initialPath?: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ host, initialPath = '/root' }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Modals & Active Items
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFiles(host, path);
      if (res.success && res.files) {
        // Sort directories first, then alphabetically
        const sorted = [...res.files].sort((a, b) => {
          const aIsDir = a.mimetype === 'directory' || a.mimetype === 'inode/directory';
          const bIsDir = b.mimetype === 'directory' || b.mimetype === 'inode/directory';
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sorted);
        setCurrentPath(res.path || path);
      } else {
        setError(res.error || 'Failed to list directory contents');
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [host, currentPath]);

  // Navigation
  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const navigateUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    const upPath = '/' + segments.join('/');
    setCurrentPath(upPath || '/');
  };

  const isDirectory = (item: FileItem) => {
    return item.mimetype === 'directory' || item.mimetype === 'inode/directory';
  };

  const isArchive = (name: string) => {
    return /\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/i.test(name);
  };

  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return '--';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Open file for viewing / editing
  const handleOpenFile = async (item: FileItem) => {
    if (isDirectory(item)) {
      navigateTo(item.path);
      return;
    }

    try {
      setLoading(true);
      const res = await api.getFile(host, item.path);
      if (res.success && res.content !== null && res.content !== undefined) {
        setEditingFile({
          path: item.path,
          name: item.name,
          content: res.content,
        });
      } else if (res.success && !res.content) {
        // Binary or empty file - offer download
        handleDownloadFile(item.path);
      } else {
        showToast(res.error || 'Failed to read file', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Cannot open file', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save file content
  const handleSaveFile = async (newContent: string) => {
    if (!editingFile) return;
    try {
      const res = await api.saveFile(host, editingFile.path, newContent);
      if (res.success) {
        showToast(`Saved ${editingFile.name} successfully!`);
        loadDirectory(currentPath);
      } else {
        showToast(res.error || 'Failed to save file', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  };

  // Download file
  const handleDownloadFile = (filePath: string) => {
    const url = `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(filePath)}&download=1`;
    window.open(url, '_blank');
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await api.createDirectory(host, currentPath, newFolderName.trim());
      if (res.success) {
        showToast(`Created folder "${newFolderName.trim()}"`);
        setShowNewFolderModal(false);
        setNewFolderName('');
        loadDirectory(currentPath);
      } else {
        showToast(res.error || 'Failed to create directory', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating directory', 'error');
    }
  };

  // Create file
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      const res = await api.createEmptyFile(host, currentPath, newFileName.trim());
      if (res.success) {
        showToast(`Created file "${newFileName.trim()}"`);
        setShowNewFileModal(false);
        setNewFileName('');
        loadDirectory(currentPath);
      } else {
        showToast(res.error || 'Failed to create file', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating file', 'error');
    }
  };

  // Rename item
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameNewName.trim()) return;
    const parentDir = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'));
    const newPath = `${parentDir}/${renameNewName.trim()}`;
    try {
      const res = await api.renameFile(host, renameTarget.path, newPath);
      if (res.success) {
        showToast(`Renamed to "${renameNewName.trim()}"`);
        setRenameTarget(null);
        setRenameNewName('');
        loadDirectory(currentPath);
      } else {
        showToast(res.error || 'Failed to rename item', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error renaming', 'error');
    }
  };

  // Delete item
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.deleteFile(host, deleteTarget.path);
      if (res.success) {
        showToast(`Deleted "${deleteTarget.name}"`);
        setDeleteTarget(null);
        loadDirectory(currentPath);
      } else {
        showToast(res.error || 'Failed to delete item', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting', 'error');
    }
  };

  // Extract archive
  const handleExtract = async (item: FileItem) => {
    try {
      setLoading(true);
      const res = await api.extractArchive(host, item.path);
      if (res.success) {
        showToast(`Extracted "${item.name}"`);
        loadDirectory(currentPath);
      } else {
        showToast(res.error || 'Archive extraction failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Extraction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const targetPath = `${currentPath.replace(/\/+$/, '')}/${file.name}`;
      setUploadProgress(0);
      try {
        const res = await api.uploadFile(host, targetPath, file, (pct) => {
          setUploadProgress(pct);
        });
        if (res.success) {
          showToast(`Uploaded ${file.name} successfully!`);
        } else {
          showToast(res.error || `Upload failed for ${file.name}`, 'error');
        }
      } catch (err: any) {
        showToast(err.message || `Upload failed for ${file.name}`, 'error');
      } finally {
        setUploadProgress(null);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    loadDirectory(currentPath);
  };

  // Filtered files
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Path segments for breadcrumbs
  const pathSegments = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-[#07090e] shadow-2xl overflow-hidden min-h-[600px]">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          role={actionMessage.type === 'success' ? 'status' : 'alert'}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold select-none transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border-b border-rose-500/30'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="w-full bg-slate-900 border-b border-cyan-500/30 p-2">
          <div className="flex items-center justify-between text-xs text-cyan-400 mb-1">
            <span>Uploading file...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation & Top Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-[#0d121f] border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={navigateUp}
            disabled={currentPath === '/' || currentPath === ''}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Go up one folder"
            aria-label="Go up one folder"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigateTo('/')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-cyan-400 font-mono font-medium transition-colors"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>/</span>
          </button>

          {pathSegments.map((segment, idx) => {
            const segPath = '/' + pathSegments.slice(0, idx + 1).join('/');
            const isLast = idx === pathSegments.length - 1;
            return (
              <React.Fragment key={segPath}>
                <span className="text-slate-600">/</span>
                <button
                  type="button"
                  onClick={() => navigateTo(segPath)}
                  className={`px-2 py-1 rounded font-mono transition-colors truncate max-w-[140px] ${
                    isLast
                      ? 'bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Filter */}
          <div className="relative flex-1 md:w-48 min-w-[140px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search in folder..."
              aria-label="Search in folder"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewFolderModal(true)}
            aria-label="Create new folder"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-medium cursor-pointer transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Folder</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewFileModal(true)}
            aria-label="Create new file"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-medium cursor-pointer transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">File</span>
          </button>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold cursor-pointer transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Directory Content List */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        {error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3 opacity-80" />
            <p className="text-sm font-medium text-rose-300">{error}</p>
            <button
              onClick={() => navigateTo('/')}
              className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-lg text-slate-200 border border-white/10 transition-colors cursor-pointer"
            >
              Return to Root (/)
            </button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs font-mono">
            {searchFilter ? 'No matching files found' : 'Empty directory'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5">
            {filteredFiles.map((file) => {
              const isDir = isDirectory(file);
              const isArch = isArchive(file.name);

              return (
                <div
                  key={file.path}
                  className="group flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-cyan-500/20 transition-all select-none"
                >
                  {/* File / Folder Main Link */}
                  <button
                    type="button"
                    onClick={() => handleOpenFile(file)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer bg-transparent border-0 p-0 text-left"
                  >
                    <div className="shrink-0">
                      {isDir ? (
                        <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                      ) : isArch ? (
                        <FileArchive className="w-5 h-5 text-purple-400 fill-purple-400/20" />
                      ) : (
                        <FileText className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-slate-200 group-hover:text-cyan-300 truncate">
                          {file.name}
                        </span>
                        {file.symlink && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            link
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-0.5 sm:hidden">
                        <span>{isDir ? 'Directory' : formatBytes(file.size)}</span>
                        <span>{formatDate(file.modified)}</span>
                      </div>
                    </div>
                  </button>

                  {/* Desktop Metadata Columns */}
                  <div className="hidden sm:flex items-center gap-6 text-xs font-mono text-slate-400 mr-4">
                    <span className="w-20 text-right">{isDir ? '--' : formatBytes(file.size)}</span>
                    <span className="w-28 text-right text-slate-500">{formatDate(file.modified)}</span>
                    <span className="w-12 text-slate-500 text-center">{file.permissions || '---'}</span>
                    <span className="w-16 text-slate-600 truncate">{file.user}:{file.group}</span>
                  </div>

                  {/* Actions Dropdown / Quick Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isDir && (
                      <button
                        type="button"
                        onClick={() => handleOpenFile(file)}
                        title="View / Edit"
                        aria-label={`View or edit ${file.name}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isDir && (
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(file.path)}
                        title="Download"
                        aria-label={`Download ${file.name}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isArch && (
                      <button
                        type="button"
                        onClick={() => handleExtract(file)}
                        title="Extract Archive"
                        aria-label={`Extract archive ${file.name}`}
                        className="p-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget(file);
                        setRenameNewName(file.name);
                      }}
                      title="Rename"
                      aria-label={`Rename ${file.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                    >
                      <File className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(file)}
                      title="Delete"
                      aria-label={`Delete ${file.name}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CodeMirror Full-featured Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="file-editor-title" className="relative w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl border border-white/15 bg-[#0a0d14] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0d121f] border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span id="file-editor-title" className="font-mono text-sm font-semibold text-white truncate max-w-md">
                  {editingFile.path}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingFile(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-2">
              <CodeMirrorEditor
                value={editingFile.content}
                filename={editingFile.name}
                height="100%"
                language={
                  editingFile.name.endsWith('.json')
                    ? 'json'
                    : editingFile.name.endsWith('.yaml') || editingFile.name.endsWith('.yml')
                    ? 'yaml'
                    : 'text'
                }
                onSave={handleSaveFile}
              />
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="new-folder-modal-title" className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0e1320] p-5 shadow-2xl">
            <h3 id="new-folder-modal-title" className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              <span>Create New Folder</span>
            </h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                placeholder="Folder name..."
                aria-label="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono mb-4"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="new-file-modal-title" className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0e1320] p-5 shadow-2xl">
            <h3 id="new-file-modal-title" className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-cyan-400" />
              <span>Create New File</span>
            </h3>
            <form onSubmit={handleCreateFile}>
              <input
                type="text"
                autoFocus
                placeholder="e.g. server_override.ini"
                aria-label="File name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono mb-4"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFileName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="rename-modal-title" className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0e1320] p-5 shadow-2xl">
            <h3 id="rename-modal-title" className="text-sm font-semibold text-white mb-3">
              Rename "{renameTarget.name}"
            </h3>
            <form onSubmit={handleRename}>
              <input
                type="text"
                autoFocus
                aria-label="New name"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono mb-4"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameNewName.trim() || renameNewName === renameTarget.name}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-file-modal-title" className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[#160c12] p-5 shadow-2xl">
            <h3 id="delete-file-modal-title" className="text-sm font-semibold text-rose-300 mb-2 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Confirm Deletion</span>
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Are you sure you want to permanently delete{' '}
              <strong className="font-mono text-white break-all">{deleteTarget.name}</strong>?
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
