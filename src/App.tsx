/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { 
  FileText, 
  Upload, 
  X, 
  Download, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  FilePlus,
  FileSearch,
  CheckCheck,
  Archive
} from 'lucide-react';
import { extractPdfData } from './lib/pdfUtils';
import { extractPdfMetadata, type ExtractionResult } from './services/geminiService';
import { cn } from './lib/utils';

interface FileItem {
  id: string;
  file: File;
  status: 'idle' | 'processing' | 'success' | 'error';
  originalName: string;
  newName?: string;
  error?: string;
  metadata?: ExtractionResult;
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    
    const newItems: FileItem[] = pdfFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'idle',
      originalName: f.name
    }));

    setFiles(prev => [...prev, ...newItems]);

    // Process each file
    for (const item of newItems) {
      processFile(item.id, item.file);
    }
  }, []);

  const processFile = async (id: string, file: File) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));

    try {
      const { text, firstPageImage } = await extractPdfData(file);
      const metadata = await extractPdfMetadata(text, firstPageImage);

      if (metadata && metadata.companyName && metadata.year) {
        const cleanName = metadata.companyName.trim();
        const year = metadata.year.replace(/[^0-9]/g, '');
        const newName = `решение об утверждении годового отчета ООО ${cleanName} за ${year} год.pdf`;
        
        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: 'success', 
          newName,
          metadata 
        } : f));
      } else {
        throw new Error('Не удалось извлечь данные (ООО или Год)');
      }
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: err instanceof Error ? err.message : 'Ошибка обработки' 
      } : f));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const downloadFile = (item: FileItem) => {
    if (!item.newName) return;
    const url = URL.createObjectURL(item.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const readyFiles = files.filter(f => f.status === 'success' && f.newName);
    if (readyFiles.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      for (const item of readyFiles) {
        const content = await item.file.arrayBuffer();
        zip.file(item.newName!, content);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `отчеты_ооо_${new Date().toLocaleDateString('ru-RU')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("ZIP Error:", error);
    } finally {
      setIsZipping(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#E2E8F0]">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-slate-100/50 blur-[120px]" />
      </div>

      <main className="relative max-w-4xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-12 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold uppercase tracking-wider">
            <FileSearch size={14} />
            <span>AI-Переименование PDF</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Переименуйте отчеты ООО <span className="text-blue-600">мгновенно</span>.
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">
            Загрузите решения об утверждении годовых отчетов. Наш ИИ автоматически извлечет 
            название ООО и год, подготовив файлы для корректного хранения.
          </p>
        </header>

        {/* Upload Area */}
        <section 
          id="upload-section"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative group cursor-pointer border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ease-out",
            isDragging 
              ? "border-blue-400 bg-blue-50/50 scale-[0.99] ring-4 ring-blue-50" 
              : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5"
          )}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept=".pdf"
            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          />
          
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
              isDragging ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
            )}>
              <Upload size={32} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xl font-medium text-slate-900">
                Перетащите PDF сюда или нажмите для выбора
              </p>
              <p className="text-slate-400 mt-1">
                Поддерживается несколько файлов одновременно
              </p>
            </div>
          </div>
        </section>

        {/* File List */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-12 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  Файлы в очереди ({files.length})
                </h2>
                {files.some(f => f.status === 'success') && (
                  <button 
                    onClick={downloadAll}
                    disabled={isZipping}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                  >
                    {isZipping ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Archive size={16} />
                    )}
                    {isZipping ? 'Создание архива...' : 'Скачать все архивом'}
                  </button>
                )}
              </div>

              <div className="grid gap-3">
                {files.map((item) => (
                  <motion.div 
                    key={item.id}
                    layoutId={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      item.status === 'success' ? "bg-emerald-50 text-emerald-600" :
                      item.status === 'error' ? "bg-rose-50 text-rose-600" :
                      "bg-blue-50 text-blue-600"
                    )}>
                      {item.status === 'processing' ? (
                        <Loader2 className="animate-spin" size={24} />
                      ) : item.status === 'success' ? (
                        <CheckCircle2 size={24} />
                      ) : item.status === 'error' ? (
                        <AlertCircle size={24} />
                      ) : (
                        <FileText size={24} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 truncate">
                          {item.originalName}
                        </p>
                        {item.status === 'processing' && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase font-bold animate-pulse">
                            Анализ...
                          </span>
                        )}
                      </div>
                      
                      {item.newName ? (
                        <p className="text-sm text-emerald-600 font-medium truncate mt-0.5">
                          → {item.newName}
                        </p>
                      ) : item.error ? (
                        <p className="text-sm text-rose-500 mt-0.5">
                          {item.error}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 mt-0.5">Ожидание анализа контента...</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <button 
                          onClick={() => downloadFile(item)}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Скачать переименованный файл"
                        >
                          <Download size={20} />
                        </button>
                      )}
                      <button 
                        onClick={() => removeFile(item.id)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Удалить"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {files.length === 0 && (
          <div className="mt-20 flex flex-col items-center justify-center opacity-20 pointer-events-none">
            <FilePlus size={64} className="text-slate-300" />
            <p className="mt-4 text-slate-400 font-medium">Нет загруженных файлов</p>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-400 mt-2">
          Работает на базе Gemini AI & PDF.js
        </p>
      </footer>
    </div>
  );
}
