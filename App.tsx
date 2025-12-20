
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { GeneratedImageDisplay } from './components/GeneratedImageDisplay';
import { editImageWithGemini, generateCreativePromptFromImage, initializeAiClient, processBPTemplate, setThirdPartyConfig } from './services/geminiService';
import { ApiStatus, GeneratedContent, CreativeIdea, SmartPlusConfig, ThirdPartyApiConfig, GenerationHistory, DesktopItem, DesktopImageItem, DesktopFolderItem } from './types';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { AddCreativeIdeaModal } from './components/AddCreativeIdeaModal';
import { SettingsModal } from './components/SettingsModal';
import { CreativeLibrary } from './components/CreativeLibrary';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LibraryIcon } from './components/icons/LibraryIcon';
import { SettingsIcon } from './components/icons/SettingsIcon';
import { BoltIcon } from './components/icons/BoltIcon';
import { PlusCircleIcon } from './components/icons/PlusCircleIcon';
import { GenerateButton } from './components/GenerateButton';
import { PenguinIcon } from './components/icons/PenguinIcon';
import { PIcon, PlugIcon, DiamondIcon, WarningIcon } from './components/icons/PIcon';
import { ImageIcon } from './components/icons/ImageIcon';
import { LightbulbIcon } from './components/icons/LightbulbIcon';
import { HistoryStrip } from './components/HistoryStrip';
import * as creativeIdeasApi from './services/api/creativeIdeas';
import * as historyApi from './services/api/history';
import * as desktopApi from './services/api/desktop';
import { saveToOutput } from './services/api/files';
import { ThemeProvider, useTheme, SnowfallEffect } from './contexts/ThemeContext';
import { Desktop, createDesktopItemFromHistory, TOP_OFFSET } from './components/Desktop';
import { HistoryDock } from './components/HistoryDock';


interface LeftPanelProps {
  files: File[];
  activeFileIndex: number | null;
  onFileSelection: (files: FileList | null) => void;
  onFileRemove: (index: number) => void;
  onFileSelect: (index: number) => void;
  onTriggerUpload: () => void;
  // 设置
  onSettingsClick: () => void;
  // 当前 API 模式状态
  currentApiMode: 'local-thirdparty' | 'local-gemini';
  // 参数与提示词相关 (从RightPanel移入)
  prompt: string;
  setPrompt: (value: string) => void;
  activeSmartTemplate: CreativeIdea | null;
  activeSmartPlusTemplate: CreativeIdea | null;
  activeBPTemplate: CreativeIdea | null;
  bpInputs: Record<string, string>;
  setBpInput: (id: string, value: string) => void;
  smartPlusOverrides: SmartPlusConfig;
  setSmartPlusOverrides: (config: SmartPlusConfig) => void;
  handleGenerateSmartPrompt: () => void;
  canGenerateSmartPrompt: boolean;
  smartPromptGenStatus: ApiStatus;
  onCancelSmartPrompt: () => void;
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  imageSize: string;
  setImageSize: (value: string) => void;
  isThirdPartyApiEnabled: boolean;
  onClearTemplate: () => void;
}

interface RightPanelProps {
  // 创意库相关
  creativeIdeas: CreativeIdea[];
  handleUseCreativeIdea: (idea: CreativeIdea) => void;
  setAddIdeaModalOpen: (isOpen: boolean) => void;
  setView: (view: 'editor' | 'local-library') => void;
  onDeleteIdea: (id: number) => void;
  onEditIdea: (idea: CreativeIdea) => void;
  onToggleFavorite?: (id: number) => void; // 切换收藏状态
}

interface CanvasProps {
  view: 'editor' | 'local-library';
  setView: (view: 'editor' | 'local-library') => void;
  files: File[];
  onUploadClick: () => void;
  creativeIdeas: CreativeIdea[];
  localCreativeIdeas: CreativeIdea[];
  onBack: () => void;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onEdit: (idea: CreativeIdea) => void;
  onUse: (idea: CreativeIdea) => void;
  status: ApiStatus;
  error: string | null;
  content: GeneratedContent | null;
  onPreviewClick: (url: string) => void;
    onExportIdeas: () => void;
  onImportIdeas: () => void;
  isImporting?: boolean; // 导入状态
  onReorderIdeas: (ideas: CreativeIdea[]) => void;
  onToggleFavorite?: (id: number) => void;
  onEditAgain?: () => void; // 再次编辑
  onRegenerate?: () => void; // 重新生成
  onDismissResult?: () => void; // 关闭结果浮层
  // 故事系统相关
  prompt?: string;
  imageSize?: string;
  // 历史记录相关
  history: GenerationHistory[];
  onHistorySelect: (item: GenerationHistory) => void;
  onHistoryDelete: (id: number) => void;
  onHistoryClear: () => void;
  // 框面模式相关
  desktopItems: DesktopItem[];
  onDesktopItemsChange: (items: DesktopItem[]) => void;
  onDesktopImageDoubleClick: (item: DesktopImageItem) => void;
  desktopSelectedIds: string[];
  onDesktopSelectionChange: (ids: string[]) => void;
  openFolderId: string | null;
  onFolderOpen: (id: string) => void;
  onFolderClose: () => void;
  openStackId: string | null; // 叠放打开状态
  onStackOpen: (id: string) => void;
  onStackClose: () => void;
  onRenameItem: (id: string, newName: string) => void;
  // 图片操作回调
  onDesktopImagePreview?: (item: DesktopImageItem) => void;
  onDesktopImageEditAgain?: (item: DesktopImageItem) => void;
  onDesktopImageRegenerate?: (item: DesktopImageItem) => void;
  // 拖放文件回调
  onFileDrop?: (files: FileList) => void;
  // 最小化结果状态
  isResultMinimized: boolean;
  setIsResultMinimized: (value: boolean) => void;
}

// --- IndexedDB Service ---
const DB_NAME = 'PenguinElloDB';
const DB_VERSION = 3; // Incremented for history store
const STORE_NAME = 'creativeIdeas';
const HISTORY_STORE_NAME = 'generationHistory';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error("Error opening DB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const getAllFromDB = async (): Promise<CreativeIdea[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(new Error("Error fetching all ideas from DB."));
    request.onsuccess = () => resolve(request.result);
  });
};

const saveToDB = async (idea: CreativeIdea) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(idea);
    request.onerror = () => reject(new Error("Error saving idea to DB."));
    request.onsuccess = () => resolve();
  });
};

const deleteFromDB = async (id: number) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(new Error("Error deleting idea from DB."));
    request.onsuccess = () => resolve();
  });
};

const importToDB = async (ideas: CreativeIdea[]) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        if (ideas.length === 0) return resolve();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error("Import transaction failed."));
        ideas.forEach(idea => {
            if (idea.order === undefined) {
                idea.order = idea.id;
            }
            store.put(idea);
        });
    });
};

// --- History IndexedDB Operations ---
const getAllHistoryFromDB = async (): Promise<GenerationHistory[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(new Error("Error fetching history from DB."));
    request.onsuccess = () => resolve(request.result);
  });
};

const saveHistoryToDB = async (item: GenerationHistory) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.put(item);
    request.onerror = () => reject(new Error("Error saving history to DB."));
    request.onsuccess = () => resolve();
  });
};

const deleteHistoryFromDB = async (id: number) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(new Error("Error deleting history from DB."));
    request.onsuccess = () => resolve();
  });
};

const clearAllHistoryFromDB = async () => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(new Error("Error clearing history from DB."));
    request.onsuccess = () => resolve();
  });
};
// --- End History IndexedDB Operations ---
// --- End IndexedDB Service ---


const LeftPanel: React.FC<LeftPanelProps> = ({
  files,
  activeFileIndex,
  onFileSelection,
  onFileRemove,
  onFileSelect,
  onTriggerUpload,
  onSettingsClick,
  currentApiMode,
  // 参数与提示词
  prompt,
  setPrompt,
  activeSmartTemplate,
  activeSmartPlusTemplate,
  activeBPTemplate,
  bpInputs,
  setBpInput,
  smartPlusOverrides,
  setSmartPlusOverrides,
  handleGenerateSmartPrompt,
  canGenerateSmartPrompt,
  smartPromptGenStatus,
  onCancelSmartPrompt,
  aspectRatio,
  setAspectRatio,
  imageSize,
  setImageSize,
  isThirdPartyApiEnabled,
  onClearTemplate,
}) => {
  const { theme, themeName, setTheme } = useTheme();
  
  // 提示词放大弹窗状态
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const expandedPromptRef = useRef<HTMLTextAreaElement>(null);
  
  // 处理ESC关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPromptExpanded) {
        setIsPromptExpanded(false);
      }
    };
    if (isPromptExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      // 聚焦到放大的输入框
      setTimeout(() => expandedPromptRef.current?.focus(), 100);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPromptExpanded]);
  
  // 明暗切换
  const toggleDarkMode = () => {
    setTheme(themeName === 'light' ? 'dark' : 'light');
  };
  const isDark = themeName !== 'light';
  
  // 根据模式获取显示信息 - 本地版本
  const getModeDisplay = () => {
    switch (currentApiMode) {
      case 'local-thirdparty':
        return {
          icon: <PlugIcon className="w-3 h-3" />,
          text: '贞贞API',
          bgClass: 'modern-badge warning',
        };
      case 'local-gemini':
        return {
          icon: <DiamondIcon className="w-3 h-3" />,
          text: 'Gemini本地',
          bgClass: 'modern-badge success',
        };
    }
  };
  
  const modeDisplay = getModeDisplay();
  
  const hasActiveTemplate = activeSmartTemplate || activeSmartPlusTemplate || activeBPTemplate;
  const activeTemplateName = activeBPTemplate?.title || activeSmartPlusTemplate?.title || activeSmartTemplate?.title;
  const activeTemplate = activeBPTemplate || activeSmartPlusTemplate || activeSmartTemplate;
  const canViewPrompt = activeTemplate?.allowViewPrompt !== false;
  const canEditPrompt = activeTemplate?.allowEditPrompt !== false;
  
  return (
  <aside 
    className="w-[280px] flex-shrink-0 flex flex-col h-full z-20 relative transition-colors duration-300"
    style={{
      background: theme.colors.bgPrimary,
      borderRight: `1px solid ${theme.colors.border}`,
    }}
  >
      {/* 微妙的内发光效果 */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,130,246,0.03) 0%, transparent 50%)',
        }}
      />
      
      {/* 顶部导航栏 */}
      <div 
        className="relative px-4 py-3.5 flex items-center justify-between"
        style={{ 
          borderBottom: `1px solid ${theme.colors.border}` 
        }}
      >
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ring-1"
            style={{
              backgroundColor: isDark ? '#000000' : theme.colors.bgTertiary,
              boxShadow: isDark ? '0 10px 15px -3px rgba(0,0,0,0.5)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
              ringColor: theme.colors.border
            }}
          >
            <PIcon className="w-5 h-5" style={{ strokeWidth: 3, color: theme.colors.textPrimary }} />
          </div>
          <div>
            <h1 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>Penguin UI</h1>
            <p className="text-[9px] font-medium tracking-wide" style={{ color: theme.colors.textMuted }}>PenguinPebbling</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* 明暗切换 */}
          <button
            onClick={toggleDarkMode}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white/10 text-neutral-400 hover:text-white"
            title={isDark ? '浅色' : '深色'}
          >
            {isDark ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          {/* 设置按钮 */}
          <button
            onClick={onSettingsClick}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white/10 text-neutral-400 hover:text-white"
            title="设置"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* 本地版模式信息栏 */}
      <div 
        className="relative mx-3 mt-3 p-3 rounded-2xl transition-colors duration-300"
        style={{ 
          background: theme.colors.bgSecondary,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.colors.shadow,
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* 本地版图标 */}
          <div 
            className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg ring-2 ring-white/20"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          
          {/* 模式信息 */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: theme.colors.textPrimary }}>
              本地版本
            </p>
            <div 
              className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80'
              }}
            >
              <span className="text-[8px]">{modeDisplay.icon}</span>
              <span>{modeDisplay.text}</span>
            </div>
          </div>
          
          {/* 数据本地存储标识 */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
            title="数据存储在本地"
          >
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-[10px] font-medium text-green-400">本地</span>
          </div>
        </div>
      </div>
      
      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col min-h-0">
        {/* 固定内容区域 - 资源素材 */}
        <div className="flex-shrink-0 mb-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: theme.colors.textMuted }}>资源素材</h2>
          <ImageUploader 
            files={files}
            activeFileIndex={activeFileIndex}
            onFileChange={onFileSelection}
            onFileRemove={onFileRemove}
            onFileSelect={onFileSelect}
            onTriggerUpload={onTriggerUpload}
          />
        </div>
        
        {/* 模型参数卡片 */}
        <div 
          className="flex-shrink-0 p-4 rounded-2xl mb-4 transition-colors duration-300"
          style={{
            background: theme.colors.bgSecondary,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
           <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/20">
                <ImageIcon className="w-3 h-3 text-blue-400"/>
              </div>
              <h3 className="text-[11px] font-semibold" style={{ color: theme.colors.textPrimary }}>参数配置</h3>
           </div>
           
           <div className="space-y-3">
              {/* 画面比例 */}
              <div>
                  <div className="flex justify-between mb-2">
                       <span className="text-[10px] font-medium" style={{ color: theme.colors.textMuted }}>画面比例</span>
                       <span className="text-[10px] font-mono font-semibold text-blue-400">{aspectRatio}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                      {['Auto', '1:1', '3:4', '4:3', '9:16', '16:9'].map(ratio => (
                          <button
                              key={ratio}
                              onClick={() => setAspectRatio(ratio)}
                              className={`py-1.5 text-[9px] font-semibold rounded-lg transition-all duration-200 ${
                                  aspectRatio === ratio
                                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                                      : 'bg-white/5 text-neutral-500 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                              {ratio}
                          </button>
                      ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-1">
                      {['2:3', '3:2', '4:5', '5:4', '21:9'].map(ratio => (
                          <button
                              key={ratio}
                              onClick={() => setAspectRatio(ratio)}
                              className={`py-1.5 text-[9px] font-semibold rounded-lg transition-all duration-200 ${
                                  aspectRatio === ratio
                                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                                      : 'bg-white/5 text-neutral-500 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                              {ratio}
                          </button>
                      ))}
                  </div>
              </div>
              
              {/* 分辨率 */}
              <div>
                  <div className="flex justify-between mb-2">
                       <span className="text-[10px] font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>分辨率</span>
                       <span className="text-[10px] font-mono font-semibold text-blue-400">{imageSize}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                       {['1K', '2K', '4K'].map(size => (
                          <button
                              key={size}
                              onClick={() => setImageSize(size)}
                              className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
                                  imageSize === size
                                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20'
                                      : `${isDark ? 'bg-white/[0.03] text-gray-500 hover:bg-white/[0.06]' : 'bg-black/[0.03] text-gray-500 hover:bg-black/[0.06]'} hover:text-blue-400`
                              }`}
                          >
                              {size}
                          </button>
                      ))}
                  </div>
              </div>
           </div>
        </div>
        
        {/* 提示词区域 - 自动扩展到底部 */}
        <div className="flex-1 flex flex-col min-h-[150px]">
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-1.5">
               <h2 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                  {hasActiveTemplate ? '关键词' : '提示词'}
               </h2>
               {/* 放大按钮 */}
               {canViewPrompt && canEditPrompt && !activeBPTemplate && (
                 <button
                   onClick={() => setIsPromptExpanded(true)}
                   className="w-5 h-5 rounded-md flex items-center justify-center transition-all hover:scale-110 hover:bg-white/10"
                   style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
                   title="放大编辑 (Esc关闭)"
                 >
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                   </svg>
                 </button>
               )}
             </div>
             <div className="flex items-center gap-1.5">
               {hasActiveTemplate && (
                 <div className="flex items-center gap-1">
                   <span 
                     className="px-2 py-0.5 rounded-md text-[9px] font-semibold"
                     style={{
                       background: activeBPTemplate 
                         ? 'rgba(59,130,246,0.15)'
                         : activeSmartPlusTemplate
                         ? 'rgba(59,130,246,0.15)'
                         : 'rgba(59,130,246,0.15)',
                       color: activeBPTemplate
                         ? '#3b82f6'
                         : activeSmartPlusTemplate
                         ? '#60a5fa'
                         : '#60a5fa',
                     }}
                   >
                     {activeTemplateName}
                   </span>
                   <button
                     onClick={onClearTemplate}
                     className="w-5 h-5 rounded-md flex items-center justify-center transition-all hover:scale-110"
                     style={{ 
                       color: isDark ? '#6b7280' : '#9ca3af',
                     }}
                     title="卸载 (Esc)"
                   >
                     <svg className="w-3 h-3 hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   </button>
                 </div>
               )}
               <span 
                 className="px-2 py-0.5 rounded-md text-[9px] font-semibold"
                 style={{
                   background: isThirdPartyApiEnabled ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.12)',
                   color: isThirdPartyApiEnabled ? '#3b82f6' : '#60a5fa'
                 }}
               >
                 {isThirdPartyApiEnabled ? 'Nano' : 'Gemini'}
               </span>
             </div>
          </div>
          
          {activeBPTemplate && (
              <BPModePanel 
                   template={activeBPTemplate}
                   inputs={bpInputs}
                   onInputChange={setBpInput}
              />
          )}

          {canViewPrompt ? (
            <div className="relative group flex-1 flex flex-col">
             <textarea
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder={
                   activeBPTemplate
                     ? "生成的提示词显示在这里..."
                     : activeSmartTemplate
                     ? `"${activeSmartTemplate.title}" 关键词...`
                     : activeSmartPlusTemplate
                     ? `场景关键词 (可选)...`
                     : "描述想生成的画面..."
                 }
                 readOnly={!!activeBPTemplate || !canEditPrompt}
                 className={`w-full flex-1 min-h-[100px] p-3 pr-11 rounded-xl resize-none text-[11px] transition-all ${
                     !canEditPrompt ? 'cursor-not-allowed opacity-60' : ''
                 }`}
                 style={{
                   background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                   border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                   color: isDark ? '#fff' : '#0f172a',
                 }}
               />
               <button
                 onClick={smartPromptGenStatus === ApiStatus.Loading ? onCancelSmartPrompt : handleGenerateSmartPrompt}
                 disabled={smartPromptGenStatus !== ApiStatus.Loading && !canGenerateSmartPrompt}
                 className={`absolute top-2 right-2 w-8 h-8 rounded-lg text-white shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center justify-center ring-1 ring-white/20 ${
                     smartPromptGenStatus === ApiStatus.Loading
                     ? 'bg-gradient-to-br from-gray-500 to-gray-600 shadow-gray-500/30'
                     : activeBPTemplate 
                     ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30' 
                     : 'bg-blue-500 shadow-blue-500/30'
                 }`}
                 title={smartPromptGenStatus === ApiStatus.Loading ? "取消" : "生成"}
               >
                   {smartPromptGenStatus === ApiStatus.Loading ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                   ) : (
                     <PenguinIcon className="w-4 h-4" />
                   )}
               </button>
            </div>
          ) : (
            <div 
              className="p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
                border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.15)' }}
                >
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-blue-400">提示词已加密</span>
              </div>
              <p className="text-[10px]" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                填写输入框后点击生成即可
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* 底部免责声明 - 更简洁 */}
      <div 
        className="mx-3 mb-3 px-3 py-2 rounded-lg text-center"
        style={{ 
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        }}
      >
        <p className="text-[9px] font-medium flex items-center justify-center gap-1" style={{ color: isDark ? '#4b5563' : '#9ca3af' }}>
          <WarningIcon className="w-3 h-3" />
          AI 内容仅供学习测试
        </p>
      </div>
      
      {/* 提示词放大弹窗 */}
      {isPromptExpanded && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPromptExpanded(false);
          }}
        >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* 弹窗内容 */}
          <div 
            className="relative w-[560px] max-w-[90vw] p-4 rounded-2xl shadow-2xl"
            style={{
              background: isDark 
                ? 'linear-gradient(135deg, rgba(20,20,28,0.98) 0%, rgba(15,15,20,0.99) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/20">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                  编辑提示词
                </h3>
              </div>
              <button
                onClick={() => setIsPromptExpanded(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105 hover:bg-gray-500/20"
                style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                title="关闭 (Esc)"
              >
                <svg className="w-4 h-4 hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 放大的提示词输入框 */}
            <textarea
              ref={expandedPromptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述想生成的画面..."
              className="w-full h-[300px] p-4 rounded-xl resize-none text-sm leading-relaxed"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                color: isDark ? '#fff' : '#0f172a',
              }}
            />
            
            {/* 底部提示 */}
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                按 Esc 或点击外部关闭
              </p>
              <button
                onClick={() => setIsPromptExpanded(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-500 shadow-lg shadow-blue-500/25 hover:bg-blue-400 hover:scale-105 active:scale-95 transition-all"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
  </aside>
  );
};

const SmartPlusDirector: React.FC<{
    config: SmartPlusConfig;
    onConfigChange: (config: SmartPlusConfig) => void;
    templateConfig?: SmartPlusConfig;
}> = ({ config, onConfigChange, templateConfig }) => {
    const { themeName } = useTheme();
    const isDark = themeName !== 'light';
    
    const handleConfigChange = (
        id: number,
        field: 'enabled' | 'features',
        value: boolean | string
    ) => {
        onConfigChange(
            config.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    const visibleComponents = config.filter(component => {
        const templateComponent = templateConfig?.find(t => t.id === component.id);
        return templateComponent?.enabled;
    });

    if (visibleComponents.length === 0) {
        return null;
    }

    return (
        <div 
          className="p-3 rounded-xl"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(20,184,166,0.04) 100%)'
              : 'rgba(20,184,166,0.06)',
            border: `1px solid ${isDark ? 'rgba(20,184,166,0.15)' : 'rgba(20,184,166,0.1)'}`,
          }}
        >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <LightbulbIcon className="w-3 h-3 text-blue-400"/>
              </div>
              <h3 className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#0f172a' }}>导演模式</h3>
            </div>
            <div className="space-y-3">
            {visibleComponents.map(component => (
                <div key={component.id} className="flex items-start gap-2">
                    <label className="relative inline-flex items-center cursor-pointer pt-0.5" htmlFor={`smart-plus-override-${component.id}`}>
                        <input
                            type="checkbox"
                            id={`smart-plus-override-${component.id}`}
                            className="sr-only peer"
                            checked={component.enabled}
                            onChange={(e) => handleConfigChange(component.id, 'enabled', e.target.checked)}
                        />
                         <div 
                           className="w-7 h-4 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500 transition-colors"
                           style={{ background: isDark ? '#374151' : '#d1d5db' }}
                         ></div>
                    </label>
                    <div className="flex-grow">
                        <label 
                          htmlFor={`smart-plus-override-${component.id}-features`} 
                          className="text-[10px] font-medium mb-1 block"
                          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                        >
                            {component.label}
                        </label>
                        <textarea
                            id={`smart-plus-override-${component.id}-features`}
                            value={component.features}
                            onChange={(e) => handleConfigChange(component.id, 'features', e.target.value)}
                            className="w-full text-xs p-2 rounded-lg resize-none transition-all"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                              color: isDark ? '#fff' : '#0f172a',
                            }}
                            placeholder={component.enabled ? '描述...' : '自动'}
                            disabled={!component.enabled}
                            rows={2}
                        />
                    </div>
                </div>
            ))}
            </div>
        </div>
    );
};

const BPModePanel: React.FC<{
    template: CreativeIdea;
    inputs: Record<string, string>;
    onInputChange: (id: string, value: string) => void;
}> = ({ template, inputs, onInputChange }) => {
    const { themeName } = useTheme();
    const isDark = themeName !== 'light';
    
    // Only show manual inputs (type === 'input')
    const manualFields = template.bpFields?.filter(f => f.type === 'input') || [];
    const agentFields = template.bpFields?.filter(f => f.type === 'agent') || [];

    if (manualFields.length === 0 && agentFields.length === 0) return null;

    return (
        <div 
          className="p-3 mb-3 rounded-xl"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.04) 100%)'
              : 'rgba(59,130,246,0.06)',
            border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}`,
          }}
        >
             <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <BoltIcon className="w-3 h-3 text-amber-400"/>
                  </div>
                  <h3 className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#0f172a' }}>BP 模式</h3>
                </div>
                {agentFields.length > 0 && (
                  <span 
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-1"
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: '#a5b4fc',
                    }}
                  >
                    <LightbulbIcon className="w-2.5 h-2.5"/> {agentFields.length}
                  </span>
                )}
             </div>
             
             <div className="space-y-2">
             {manualFields.length > 0 ? manualFields.map(v => (
                 <div key={v.id}>
                     <label 
                       className="text-[10px] font-medium mb-1 flex justify-between"
                       style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                     >
                        <span>{v.label}</span>
                        <span className="text-[9px] font-mono" style={{ color: 'rgba(59,130,246,0.6)' }}>/{v.name}</span>
                     </label>
                     <input 
                        type="text"
                        value={inputs[v.id] || ''}
                        onChange={(e) => onInputChange(v.id, e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg transition-all"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
                          color: isDark ? '#fff' : '#0f172a',
                        }}
                        placeholder={`输入 ${v.label}...`}
                     />
                 </div>
             )) : (
                 <p 
                   className="text-[10px] italic p-2 rounded text-center"
                   style={{ 
                     background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                     color: isDark ? '#6b7280' : '#9ca3af',
                   }}
                 >
                   仅含智能体，点击生成自动运行
                 </p>
             )}
             </div>
        </div>
    );
}

const RightPanel: React.FC<RightPanelProps> = ({
  creativeIdeas,
  handleUseCreativeIdea,
  setAddIdeaModalOpen,
  setView,
  onDeleteIdea,
  onEditIdea,
  onToggleFavorite,
}) => {
  const { theme } = useTheme();
  
  // 收藏的创意库
  const favoriteIdeas = creativeIdeas.filter(idea => idea.isFavorite);
  // 最近使用的创意库（按order排序，取前5个）
  const recentIdeas = [...creativeIdeas].sort((a, b) => (b.order || 0) - (a.order || 0)).slice(0, 5);
  
  // 渲染单个创意项 - 改进版本，支持收藏和BP标签
  const renderIdeaItem = (idea: CreativeIdea, showFavorite = true) => (
    <div
      key={idea.id}
      className="group liquid-card p-2 hover:border-blue-500/30 transition-all cursor-pointer"
      onClick={() => handleUseCreativeIdea(idea)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {idea.imageUrl ? (
            <img src={idea.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
          ) : (
            <span className="text-sm flex-shrink-0">✨</span>
          )}
          <span className="text-[11px] font-medium truncate" style={{ color: theme.colors.textPrimary }}>
            {idea.title}
          </span>
          {/* BP标签 */}
          {idea.isBP && (
            <span className="px-1 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-bold rounded flex-shrink-0">
              BP
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 收藏按钮 */}
          {showFavorite && onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(idea.id); }}
              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                idea.isFavorite 
                  ? 'text-blue-400 hover:text-blue-300' 
                  : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/10'
              }`}
              title={idea.isFavorite ? '取消收藏' : '收藏'}
            >
              <svg className="w-3 h-3" fill={idea.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEditIdea(idea); }}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            title="编辑"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteIdea(idea.id); }}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-gray-400 hover:bg-gray-500/10 transition-all"
            title="删除"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderGroup = (title: string, ideas: CreativeIdea[], badge: string, badgeClass: string) => {
    if (ideas.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium" style={{ color: theme.colors.textMuted }}>{title}</span>
          <span className={`liquid-badge ${badgeClass}`}>{ideas.length}</span>
        </div>
        <div className="space-y-1.5">
          {ideas.slice(0, 5).map(idea => renderIdeaItem(idea))}
          {ideas.length > 5 && (
            <button 
              onClick={() => setView('library')}
              className="w-full py-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              查看全部 {ideas.length} 个...
            </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
  <aside className="w-[220px] flex-shrink-0 flex flex-col h-full liquid-panel border-l z-20">
     {/* 标题栏 */}
     <div className="liquid-panel-section flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-500/15 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h2 className="text-[12px] font-semibold" style={{ color: theme.colors.textPrimary }}>收藏创意</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAddIdeaModalOpen(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:scale-105 press-scale"
            style={{ 
              background: 'var(--glass-bg)',
              color: theme.colors.textSecondary 
            }}
            title="新建创意"
          >
            <PlusCircleIcon className="w-3 h-3" />
          </button>
          <button
            onClick={() => setView('local-library')}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:scale-105 press-scale"
            style={{ 
              background: 'var(--glass-bg)',
              color: theme.colors.textSecondary 
            }}
            title="全部创意库"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
     </div>
     
     {/* 收藏列表 */}
     <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {favoriteIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-[11px] font-medium" style={{ color: theme.colors.textPrimary }}>还没有收藏</p>
            <p className="text-[10px] mt-1" style={{ color: theme.colors.textMuted }}>在创意库中点击星标收藏</p>
            <button
              onClick={() => setView('local-library')}
              className="mt-4 px-4 py-2 liquid-btn text-[11px]"
            >
              <LibraryIcon className="w-3.5 h-3.5 mr-1.5" />
              浏览创意库
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {favoriteIdeas.map(idea => renderIdeaItem(idea, false))}
          </div>
        )}
        
        {/* 最近使用 - 当收藏不多时显示 */}
        {favoriteIdeas.length < 3 && recentIdeas.length > 0 && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: theme.colors.border }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium" style={{ color: theme.colors.textMuted }}>最近使用</span>
            </div>
            <div className="space-y-1.5">
              {recentIdeas.slice(0, 3).map(idea => renderIdeaItem(idea))}
            </div>
          </div>
        )}
     </div>
     
     {/* 底部统计 */}
     {creativeIdeas.length > 0 && (
       <div className="mx-3 mb-3 px-2.5 py-2 liquid-card">
         <div className="flex items-center justify-between text-[10px]">
           <span style={{ color: theme.colors.textMuted }}>共 {creativeIdeas.length} 个创意</span>
           <button
             onClick={() => setView('local-library')}
             className="text-blue-400 hover:text-blue-300 transition-colors"
           >
             管理全部 →
           </button>
         </div>
       </div>
     )}
  </aside>
);
};

const Canvas: React.FC<CanvasProps> = ({
  view,
  setView,
  files,
  onUploadClick,
  creativeIdeas,
  localCreativeIdeas,
  onBack,
  onAdd,
  onDelete,
  onEdit,
  onUse,
  status,
  error,
  content,
  onPreviewClick,
  onExportIdeas,
  onImportIdeas,
  onReorderIdeas,
  onEditAgain,
  onRegenerate,
  onDismissResult,
  prompt,
  imageSize,
  history,
  onHistorySelect,
  onHistoryDelete,
  onHistoryClear,
  desktopItems,
  onDesktopItemsChange,
  onDesktopImageDoubleClick,
  desktopSelectedIds,
  onDesktopSelectionChange,
  openFolderId,
  onFolderOpen,
  onFolderClose,
  openStackId,
  onStackOpen,
  onStackClose,
  onRenameItem,
  onDesktopImagePreview,
  onDesktopImageEditAgain,
  onDesktopImageRegenerate,
    onFileDrop,
  isResultMinimized,
  setIsResultMinimized,
  onToggleFavorite,
  isImporting,
}) => {
  const { theme, themeName } = useTheme();
  const isDark = themeName !== 'light';
  
  return (
   <main 
     className="flex-1 flex flex-col min-w-0 relative overflow-hidden select-none" 
     style={{ backgroundColor: theme.colors.bgPrimary }}
     onDragStart={(e) => e.preventDefault()}
   >
      {/* 背景效果 - 适配明暗主题 */}
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-gray-950 to-gray-950 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),transparent)] pointer-events-none"></div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-white to-gray-50/20 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.08),transparent)] pointer-events-none"></div>
        </>
      )}
      
      {/* 顶部切换标签 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 liquid-tabs">
        <button
          onClick={() => setView('editor')}
          className={`liquid-tab flex items-center gap-1 ${
            view === 'editor' ? 'active' : ''
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          桌面
        </button>
        <button
          onClick={() => setView('local-library')}
          className={`liquid-tab flex items-center gap-1 ${
            view === 'local-library' ? 'active' : ''
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          本地创意
          {localCreativeIdeas.length > 0 && (
            <span className="px-1 py-0.5 text-[8px] rounded bg-white/20 font-medium">
              {localCreativeIdeas.length}
            </span>
          )}
        </button>

      </div>
      
      {view === 'local-library' ? (
        <div className="relative z-10 w-full flex-1 p-8 pt-16 flex flex-col overflow-hidden">
                    <CreativeLibrary
            ideas={localCreativeIdeas}
            onBack={onBack}
            onAdd={onAdd}
            onDelete={onDelete}
            onEdit={onEdit}
            onUse={onUse}
            onExport={onExportIdeas}
            onImport={onImportIdeas}
            onReorder={onReorderIdeas}
            onToggleFavorite={onToggleFavorite}
            isImporting={isImporting}
          />
        </div>
      ) : (
        /* 桌面模式 - 始终显示 */
        <div className="relative z-10 flex-1 overflow-hidden">
          <Desktop
            items={desktopItems}
            onItemsChange={onDesktopItemsChange}
            onImageDoubleClick={onDesktopImageDoubleClick}
            onFolderDoubleClick={(folder) => onFolderOpen(folder.id)}
            onStackDoubleClick={(stack) => onStackOpen(stack.id)}
            openFolderId={openFolderId}
            onFolderClose={onFolderClose}
            openStackId={openStackId}
            onStackClose={onStackClose}
            selectedIds={desktopSelectedIds}
            onSelectionChange={onDesktopSelectionChange}
            onRenameItem={onRenameItem}
            onImagePreview={onDesktopImagePreview}
            onImageEditAgain={onDesktopImageEditAgain}
            onImageRegenerate={onDesktopImageRegenerate}
            history={history}
            creativeIdeas={creativeIdeas}
            onFileDrop={onFileDrop}
          />
          
          {/* 生成结果浮层 - 毛玻璃效果 + 最小化联动 */}
          {(status === ApiStatus.Loading || (status === ApiStatus.Success && content) || (status === ApiStatus.Error && error)) && (
            <>
              {/* 正常展开状态 - 居中显示 */}
              {!isResultMinimized && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 animate-scale-in">
                  <div className="
                    bg-gradient-to-br from-gray-900/90 via-gray-900/80 to-gray-800/90
                    backdrop-blur-xl backdrop-saturate-150
                    rounded-2xl
                    border-2 border-blue-400/50
                    shadow-[0_0_20px_rgba(59,130,246,0.3)]
                    ring-1 ring-blue-500/20
                    overflow-hidden p-5
                  ">
                    {/* 标题栏 */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        {status === ApiStatus.Loading ? (
                          <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : status === ApiStatus.Success ? (
                          <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-500/30 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            {status === ApiStatus.Loading ? 'AI 正在创作中...' : status === ApiStatus.Success ? '作品已完成' : '生成遇到问题'}
                          </h3>
                          <p className="text-xs text-blue-300/70">
                            {status === ApiStatus.Loading ? '请稍等，魔法正在发生' : status === ApiStatus.Success ? '点击图片查看大图' : '请稍后重试'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsResultMinimized(true)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-300 hover:text-white hover:bg-white/10 transition-all"
                          title="收起到按钮旁"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {status !== ApiStatus.Loading && onDismissResult && (
                          <button
                            onClick={onDismissResult}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-300 hover:text-gray-300 hover:bg-gray-500/20 transition-all"
                            title="关闭"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <GeneratedImageDisplay
                      status={status}
                      error={error}
                      content={content}
                      onPreviewClick={onPreviewClick}
                      onEditAgain={onEditAgain}
                      onRegenerate={onRegenerate}
                      prompt={prompt}
                      imageSize={imageSize}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
   </main>
  );
};

export const defaultSmartPlusConfig: SmartPlusConfig = [
    { id: 1, label: 'Product', enabled: true, features: '' },
    { id: 2, label: 'Person', enabled: true, features: '' },
    { id: 3, label: 'Scene', enabled: true, features: '' },
];

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);

  const [prompt, setPrompt] = useState<string>('');
  const [status, setStatus] = useState<ApiStatus>(ApiStatus.Idle);
  const [error, setError] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  const [smartPromptGenStatus, setSmartPromptGenStatus] = useState<ApiStatus>(ApiStatus.Idle);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // 取消 BP/Smart 处理
  const handleCancelSmartPrompt = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setSmartPromptGenStatus(ApiStatus.Idle);
    }
  }, [abortController]);

  const [apiKey, setApiKey] = useState<string>('');
  
  // 创意库状态：本地存储
  const [localCreativeIdeas, setLocalCreativeIdeas] = useState<CreativeIdea[]>([]);
  
  // 本地版本直接使用本地创意库
  const creativeIdeas = useMemo(() => {
    return [...localCreativeIdeas].sort((a, b) => (b.order || 0) - (a.order || 0));
  }, [localCreativeIdeas]);
  
  const [view, setView] = useState<'editor' | 'local-library'>('editor'); // 默认桌面模式
  const [isAddIdeaModalOpen, setAddIdeaModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<CreativeIdea | null>(null);
  
  const [activeSmartTemplate, setActiveSmartTemplate] = useState<CreativeIdea | null>(null);
  const [activeSmartPlusTemplate, setActiveSmartPlusTemplate] = useState<CreativeIdea | null>(null);
  const [smartPlusOverrides, setSmartPlusOverrides] = useState<SmartPlusConfig>(() => JSON.parse(JSON.stringify(defaultSmartPlusConfig)));

  // BP Mode States
  const [activeBPTemplate, setActiveBPTemplate] = useState<CreativeIdea | null>(null);
  const [bpInputs, setBpInputs] = useState<Record<string, string>>({});
  
  // 当前使用的创意库（用于获取扣费金额，不论类型）
  const [activeCreativeIdea, setActiveCreativeIdea] = useState<CreativeIdea | null>(null);
  
  // No global polish switch needed for BP anymore, as agents handle intelligence
  // const [bpPolish, setBpPolish] = useState(false); 

  // New State for Model Config
  const [aspectRatio, setAspectRatio] = useState<string>('Auto');
  const [imageSize, setImageSize] = useState<string>('2K');

  const [autoSave, setAutoSave] = useState(true);
  
  // 贞贞API配置状态
  const [thirdPartyApiConfig, setThirdPartyApiConfig] = useState<ThirdPartyApiConfig>({
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: 'nano-banana-2'
  });
  
  // 历史记录状态
  const [generationHistory, setGenerationHistory] = useState<GenerationHistory[]>([]);
  
  // 设置弹窗状态
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);

  // 桌面状态
  const [desktopItems, setDesktopItems] = useState<DesktopItem[]>([]);
  const [desktopSelectedIds, setDesktopSelectedIds] = useState<string[]>([]);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [openStackId, setOpenStackId] = useState<string | null>(null); // 叠放打开状态
    const [isResultMinimized, setIsResultMinimized] = useState(false); // 生成结果最小化状态
  const [isLoading, setIsLoading] = useState(true); // 加载状态
  const [isImporting, setIsImporting] = useState(false); // 导入状态

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importIdeasInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      initializeAiClient(savedApiKey);
    }
    
    // 加载贞贞API配置
    const savedThirdPartyConfig = localStorage.getItem('third_party_api_config');
    if (savedThirdPartyConfig) {
      try {
        const config = JSON.parse(savedThirdPartyConfig) as ThirdPartyApiConfig;
        // 如果没有baseUrl，设置默认值
        if (!config.baseUrl) {
          config.baseUrl = 'https://ai.t8star.cn';
        }
        setThirdPartyApiConfig(config);
        setThirdPartyConfig(config);
      } catch (e) {
        console.error('Failed to parse third party API config:', e);
      }
    } else {
      // 默认配置
      const defaultConfig: ThirdPartyApiConfig = {
        enabled: false,
        baseUrl: 'https://ai.t8star.cn',
        apiKey: '',
        model: 'nano-banana-2',
        chatModel: 'gemini-2.5-pro'
      };
      setThirdPartyApiConfig(defaultConfig);
      setThirdPartyConfig(defaultConfig);
    }
    
    // 本地版本：直接从本地加载数据
    loadDataFromLocal();
    
    const savedAutoSave = localStorage.getItem('auto_save_enabled');
    if (savedAutoSave) {
        setAutoSave(JSON.parse(savedAutoSave));
    }
  }, []);
  
  // 从 Python后端加载数据（纯本地文件，不用浏览器缓存）
  const loadDataFromLocal = async () => {
    setIsLoading(true);
    try {
      const [ideasResult, historyResult, desktopResult] = await Promise.all([
        creativeIdeasApi.getAllCreativeIdeas(),
        historyApi.getAllHistory(),
        desktopApi.getDesktopItems()
      ]);
      
      if (ideasResult.success && ideasResult.data) {
        setLocalCreativeIdeas(ideasResult.data.sort((a, b) => (b.order || 0) - (a.order || 0)));
      } else {
        console.warn('加载创意库失败:', ideasResult.error);
        setLocalCreativeIdeas([]);
      }
      
      let loadedHistory: GenerationHistory[] = [];
      if (historyResult.success && historyResult.data) {
        loadedHistory = historyResult.data.sort((a, b) => b.timestamp - a.timestamp);
        setGenerationHistory(loadedHistory);
      } else {
        console.warn('加载历史记录失败:', historyResult.error);
        setGenerationHistory([]);
      }
      
      // 加载桌面状态，并恢复图片URL
      if (desktopResult.success && desktopResult.data) {
        const restoredItems = desktopResult.data.map(item => {
          if (item.type === 'image') {
            const imageItem = item as DesktopImageItem;
            // 如果 imageUrl 为空且有 historyId，从历史记录恢复
            if ((!imageItem.imageUrl || imageItem.imageUrl === '') && imageItem.historyId) {
              const historyEntry = loadedHistory.find(h => h.id === imageItem.historyId);
              if (historyEntry) {
                return { ...imageItem, imageUrl: historyEntry.imageUrl };
              }
            }
          }
          return item;
        });
        setDesktopItems(restoredItems);
      } else {
        console.warn('加载桌面状态失败:', desktopResult.error);
        setDesktopItems([]);
      }
    } catch (e) {
      console.error('Python后端未运行，请先启动后端服务', e);
      setLocalCreativeIdeas([]);
      setGenerationHistory([]);
      setDesktopItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 切换收藏状态
  const handleToggleFavorite = useCallback(async (id: number) => {
    const targetIdea = localCreativeIdeas.find(idea => idea.id === id);
    if (!targetIdea) return;
    
    const updatedIdeas = localCreativeIdeas.map(idea => 
      idea.id === id ? { ...idea, isFavorite: !idea.isFavorite } : idea
    );
    setLocalCreativeIdeas(updatedIdeas);
    
    // 保存到Python后端
    try {
      await creativeIdeasApi.updateCreativeIdea(id, { isFavorite: !targetIdea.isFavorite });
    } catch (e) {
      console.error('保存收藏状态失败:', e);
    }
  }, [localCreativeIdeas]);

  const handleSetPrompt = (value: string) => {
    setPrompt(value);
  };

  const handleFileSelection = useCallback((selectedFiles: FileList | null) => {
    if (selectedFiles && selectedFiles.length > 0) {
      const newFiles = Array.from(selectedFiles).filter(file => file.type.startsWith('image/'));
      setFiles(prevFiles => {
        const wasEmpty = prevFiles.length === 0;
        const updatedFiles = [...prevFiles, ...newFiles];
        if (wasEmpty && updatedFiles.length > 0) {
          setTimeout(() => setActiveFileIndex(0), 0);
        }
        return updatedFiles;
      });
    }
  }, []);

  const handleFileRemove = (indexToRemove: number) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    if (activeFileIndex === indexToRemove) {
      setActiveFileIndex(files.length > 1 ? 0 : null);
    } else if (activeFileIndex !== null && activeFileIndex > indexToRemove) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(event.target.files);
    if (event.target) {
        event.target.value = '';
    }
  }, [handleFileSelection]);

  const handleApiKeySave = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    initializeAiClient(key);
    setError(null); 
  };
  
  const handleAutoSaveToggle = (enabled: boolean) => {
    setAutoSave(enabled);
    localStorage.setItem('auto_save_enabled', JSON.stringify(enabled));
  };
  
  // 贞贞API配置变更处理
  const handleThirdPartyConfigChange = (config: ThirdPartyApiConfig) => {
    setThirdPartyApiConfig(config);
    setThirdPartyConfig(config);
    localStorage.setItem('third_party_api_config', JSON.stringify(config));
  };
  
  // 历史记录操作
  const handleHistorySelect = async (item: GenerationHistory) => {
    // 恢复原始输入图片（如果有）
    let restoredInputFile: File | null = null;
    if (item.inputImageData && item.inputImageType) {
      try {
        // 将 base64 转换回 File 对象
        const byteCharacters = atob(item.inputImageData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: item.inputImageType });
        restoredInputFile = new File([blob], item.inputImageName || 'restored-input.png', { type: item.inputImageType });
        
        // 清空其他图片，仅保留恢复的输入图片
        setFiles([restoredInputFile]);
        setActiveFileIndex(0);
      } catch (e) {
        console.warn('恢复输入图片失败:', e);
      }
    } else {
      // 没有输入图片，清空文件列表
      setFiles([]);
      setActiveFileIndex(null);
    }
    
    // 恢复创意库设置（用于重新生成）
    setActiveSmartTemplate(null);
    setActiveSmartPlusTemplate(null);
    setActiveBPTemplate(null);
    setActiveCreativeIdea(null);
    setBpInputs({});
    setSmartPlusOverrides(JSON.parse(JSON.stringify(defaultSmartPlusConfig)));
    
    if (item.creativeTemplateType && item.creativeTemplateType !== 'none' && item.creativeTemplateId) {
      const template = creativeIdeas.find(idea => idea.id === item.creativeTemplateId);
      if (template) {
        // 设置当前使用的创意库（用于扣费）
        setActiveCreativeIdea(template);
        
        if (item.creativeTemplateType === 'bp') {
          setActiveBPTemplate(template);
          if (item.bpInputs) {
            setBpInputs(item.bpInputs);
          }
        } else if (item.creativeTemplateType === 'smartPlus') {
          setActiveSmartPlusTemplate(template);
          if (item.smartPlusOverrides) {
            setSmartPlusOverrides(item.smartPlusOverrides);
          }
        } else if (item.creativeTemplateType === 'smart') {
          setActiveSmartTemplate(template);
        }
      }
    }
    
    // 设置生成的内容，并保留原始图片引用用于“重新生成”
    setGeneratedContent({ 
      imageUrl: item.imageUrl, 
      text: null,
      originalFiles: restoredInputFile ? [restoredInputFile] : [] 
    });
    setPrompt(item.prompt);
    setStatus(ApiStatus.Success);
    setView('editor'); // 切换到编辑器视图以显示图片
  };
  
  const handleHistoryDelete = async (id: number) => {
    try {
      await historyApi.deleteHistory(id);
      setGenerationHistory(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      console.error('删除历史记录失败:', e);
    }
  };
  
  const handleHistoryClear = async () => {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    try {
      await historyApi.clearAllHistory();
      setGenerationHistory([]);
    } catch (e) {
      console.error('清空历史记录失败:', e);
    }
  };
  
  const saveToHistory = async (
    imageUrl: string, 
    promptText: string, 
    isThirdParty: boolean, 
    inputFiles?: File[], // 修改为数组支持多图
    creativeInfo?: {
      templateId?: number;
      templateType: 'smart' | 'smartPlus' | 'bp' | 'none';
      bpInputs?: Record<string, string>;
      smartPlusOverrides?: SmartPlusConfig;
    }
  ): Promise<number | undefined> => {
    // 将输入图片转换为 base64 保存
    let inputImageData: string | undefined;
    let inputImageName: string | undefined;
    let inputImageType: string | undefined;
    let inputImages: Array<{ data: string; name: string; type: string }> | undefined;
    
    // 保存所有输入图片（多图支持）
    if (inputFiles && inputFiles.length > 0) {
      try {
        inputImages = await Promise.all(inputFiles.map(async (file) => {
          const data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
          });
          return {
            data,
            name: file.name,
            type: file.type
          };
        }));
        
        // 保持向后兼容：第一张图片也保存到单图字段
        if (inputImages.length > 0) {
          inputImageData = inputImages[0].data;
          inputImageName = inputImages[0].name;
          inputImageType = inputImages[0].type;
        }
      } catch (e) {
        console.warn('保存输入图片失败:', e);
      }
    }
    
    const historyId = Date.now();
    
    // 先保存图片到本地output目录，获取本地URL
    let localImageUrl = imageUrl;
    if (imageUrl.startsWith('data:')) {
      try {
        const saveResult = await saveToOutput(imageUrl);
        if (saveResult.success && saveResult.data) {
          // 使用本地文件URL替代base64
          localImageUrl = saveResult.data.url;
        }
      } catch (e) {
        console.log('保存到output失败，使用base64:', e);
      }
    }
    
    const historyItem: GenerationHistory = {
      id: historyId,
      imageUrl: localImageUrl, // 使用本地URL
      prompt: promptText,
      timestamp: Date.now(),
      model: isThirdParty ? (thirdPartyApiConfig.model || 'nano-banana-2') : 'Gemini 3 Pro',
      isThirdParty,
      inputImageData,
      inputImageName,
      inputImageType,
      inputImages, // 多图支持
      // 创意库信息
      creativeTemplateId: creativeInfo?.templateId,
      creativeTemplateType: creativeInfo?.templateType || 'none',
      bpInputs: creativeInfo?.bpInputs,
      smartPlusOverrides: creativeInfo?.smartPlusOverrides
    };
    try {
      const { id, ...historyWithoutId } = historyItem;
      const result = await historyApi.createHistory(historyWithoutId as any);
      if (result.success && result.data) {
        setGenerationHistory(prev => [result.data!, ...prev].slice(0, 50));
        return result.data.id;
      }
      console.error('保存历史记录失败:', result.error);
    } catch (e) {
      console.error('保存历史记录失败:', e);
    }
    return undefined;
  };
  
  const downloadImage = useCallback(async (url: string, filename?: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const downloadFilename = filename || `ai-generated-${timestamp}.png`;
    
    // 如果是 base64 数据或同源URL，直接下载
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    // 对于外部URL，尝试使用fetch获取blob后下载
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // 如果fetch失败（CORS等问题），在新窗口打开
      console.error('下载失败，尝试在新窗口打开:', e);
      window.open(url, '_blank');
    }
  }, []);

  const handleExportIdeas = () => {
    if (creativeIdeas.length === 0) {
        alert("库是空的 / Library is empty.");
        return;
    }
    const dataStr = JSON.stringify(creativeIdeas, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'creative_library.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
    const handleImportIdeas = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      // 防止重复导入
      if (isImporting) {
        alert('正在导入中，请稍候...');
        return;
      }
      
      setIsImporting(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = e.target?.result;
              if (typeof content !== 'string') throw new Error("File content is not a string.");
              const ideas = JSON.parse(content);

                            if (Array.isArray(ideas) && ideas.every(idea => 'id' in idea && 'title' in idea && 'prompt' in idea && 'imageUrl' in idea)) {
                  try {
                    const ideasWithoutId = ideas.map(({ id, ...rest }) => rest);
                    const result = await creativeIdeasApi.importCreativeIdeas(ideasWithoutId as any) as any;
                    if (result.success) {
                      await loadDataFromLocal();
                      // 显示后端返回的导入结果（包含跳过重复信息）
                      const msg = result.message || `已导入 ${result.imported || ideas.length} 个创意`;
                      alert(msg);
                    } else {
                      throw new Error(result.error || '导入失败');
                    }
                  } catch (apiError) {
                    console.error('导入失败:', apiError);
                    alert('导入失败');
                  }
              } else {
                  throw new Error("文件格式无效");
              }
          } catch (error) {
              console.error("Failed to import creative ideas:", error);
              alert("导入失败");
          } finally {
              setIsImporting(false);
              if (event.target) {
                  event.target.value = '';
              }
          }
      };
      reader.onerror = () => {
        setIsImporting(false);
        alert('文件读取失败');
      };
      reader.readAsText(file);
  };
  
  const handleSaveCreativeIdea = async (idea: Partial<CreativeIdea>) => {
    console.log('[handleSaveCreativeIdea] 接收到数据:', {
      id: idea.id,
      suggestedAspectRatio: idea.suggestedAspectRatio,
      suggestedResolution: idea.suggestedResolution
    });
    
    try {
      if (idea.id) {
        // 更新现有创意
        const result = await creativeIdeasApi.updateCreativeIdea(idea.id, idea);
        if (!result.success) {
          throw new Error(result.error || '更新失败');
        }
      } else {
        // 创建新创意
        const newOrder = creativeIdeas.length > 0 ? Math.max(...creativeIdeas.map(i => i.order || 0)) + 1 : 1;
        const { id, ...ideaWithoutId } = idea as any;
        const result = await creativeIdeasApi.createCreativeIdea({ ...ideaWithoutId, order: newOrder });
        if (!result.success) {
          throw new Error(result.error || '创建失败');
        }
      }
      // 重新加载数据
      await loadDataFromLocal();
      setAddIdeaModalOpen(false);
      setEditingIdea(null);
    } catch (e) {
      console.error('保存创意失败:', e);
      alert(`保存失败: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleDeleteCreativeIdea = async (id: number) => {
    try {
      const result = await creativeIdeasApi.deleteCreativeIdea(id);
      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }
      await loadDataFromLocal();
    } catch (e) {
      console.error('删除创意失败:', e);
      alert(`删除失败: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };
  
  const handleStartEditIdea = (idea: CreativeIdea) => {
    setEditingIdea(idea);
    setAddIdeaModalOpen(true);
  };

  const handleAddNewIdea = () => {
    setEditingIdea(null);
    setAddIdeaModalOpen(true);
  };

  const handleReorderIdeas = async (reorderedIdeas: CreativeIdea[]) => {
    try {
        const ideasToUpdate = reorderedIdeas.map((idea, index) => ({
            ...idea,
            order: reorderedIdeas.length - index,
        }));
        setLocalCreativeIdeas(ideasToUpdate);
        
        const orderedIds = ideasToUpdate.map(i => i.id);
        await creativeIdeasApi.reorderCreativeIdeas(orderedIds);
    } catch (e) {
        console.error("重新排序失败:", e);
    }
  };


  const handleUseCreativeIdea = (idea: CreativeIdea) => {
    setActiveSmartTemplate(null);
    setActiveSmartPlusTemplate(null);
    setActiveBPTemplate(null);
    
    // 保存当前使用的创意库（用于扣费）
    setActiveCreativeIdea(idea);
    
    // 应用创意库建议的宽高比和分辨率
    if (idea.suggestedAspectRatio) {
      setAspectRatio(idea.suggestedAspectRatio);
    }
    if (idea.suggestedResolution) {
      setImageSize(idea.suggestedResolution);
    }
    
    // Reset BP
    setBpInputs({});

    if (idea.isBP) {
        setActiveBPTemplate(idea);
        setPrompt(''); // BP starts empty, waits for generation/fill
        
        // Initialize inputs for 'input' type fields
        if (idea.bpFields) {
            const initialInputs: Record<string, string> = {};
            idea.bpFields.forEach(v => {
                if (v.type === 'input') {
                    initialInputs[v.id] = '';
                }
            });
            setBpInputs(initialInputs);
        } else if (idea.bpVariables) { 
            // Migration fallback
            const initialInputs: Record<string, string> = {};
            idea.bpVariables.forEach(v => initialInputs[v.id] = '');
            setBpInputs(initialInputs);
        }
    } else if (idea.isSmart) {
      setActiveSmartTemplate(idea);
      setPrompt(''); // Clear prompt for keyword
    } else if (idea.isSmartPlus) {
        setActiveSmartPlusTemplate(idea);
        setSmartPlusOverrides(idea.smartPlusConfig || JSON.parse(JSON.stringify(defaultSmartPlusConfig)));
        setPrompt(''); // Clear prompt for keywords
    } else {
      setPrompt(idea.prompt);
    }
    setView('editor');
  };

  const activeFile = activeFileIndex !== null ? files[activeFileIndex] : null;

  const handleGenerateSmartPrompt = useCallback(async () => {
    const activeTemplate = activeSmartTemplate || activeSmartPlusTemplate || activeBPTemplate;
     if (!activeTemplate) {
      alert('请先从创意库选择一个模板');
      return;
    }

    // 检查API配置：要么有Gemini Key，要么启用了贞贞API
    const hasValidApi = apiKey || (thirdPartyApiConfig.enabled && thirdPartyApiConfig.apiKey);

    // 创建新的 AbortController
    const controller = new AbortController();
    setAbortController(controller);
    
    setSmartPromptGenStatus(ApiStatus.Loading);
    setError(null);

    try {
      if (activeBPTemplate) {
          // BP Mode Logic (New Orchestration)
          if (!hasValidApi) {
             alert('BP 模式运行智能体需要配置 API Key（Gemini 或贞贞API）');
             setSmartPromptGenStatus(ApiStatus.Idle);
             return;
          }
          // BP模式支持有图片或无图片，传递 activeFile（可能为 null）
          const finalPrompt = await processBPTemplate(activeFile, activeBPTemplate, bpInputs);
          setPrompt(finalPrompt);

      } else {
          // Standard/Smart Logic (Legacy)
          if (!hasValidApi) {
             alert('智能提示词生成需要配置 API Key（Gemini 或贞贞API）');
             setSmartPromptGenStatus(ApiStatus.Idle);
             return;
          }
          if (!activeFile) {
            alert('请先上传并选择一张图片');
            setSmartPromptGenStatus(ApiStatus.Idle);
            return;
          }
          if (activeSmartTemplate && !prompt.trim()) {
            alert('请输入关键词');
            setSmartPromptGenStatus(ApiStatus.Idle);
            return;
          }
          const newPromptText = await generateCreativePromptFromImage({
              file: activeFile,
              idea: activeTemplate,
              keyword: prompt, 
              smartPlusConfig: activeTemplate.isSmartPlus ? smartPlusOverrides : undefined,
          });
          setPrompt(newPromptText); 
      }
      
      setSmartPromptGenStatus(ApiStatus.Success);
      setAbortController(null); // 清除控制器

    } catch (e: unknown) {
      // 检查是否是用户主动取消
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('BP处理已被用户取消');
        setSmartPromptGenStatus(ApiStatus.Idle);
        setAbortController(null); // 清除控制器
        return;
      }
      
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error(errorMessage);
      alert(`智能提示词生成失败: ${errorMessage}`);
      setSmartPromptGenStatus(ApiStatus.Error);
      setAbortController(null); // 清除控制器
    }
  }, [activeFile, prompt, apiKey, thirdPartyApiConfig, activeSmartTemplate, activeSmartPlusTemplate, activeBPTemplate, smartPlusOverrides, bpInputs, abortController]);
  
    // 安全保存桌面项目到后端 API（移除大型 base64 数据）
    const safeDesktopSave = useCallback(async (items: DesktopItem[]) => {
      try {
        // 保存前移除 base64 imageUrl 以节省空间（有 historyId 可恢复）
        const itemsForStorage = items.map(item => {
          if (item.type === 'image') {
            const imageItem = item as DesktopImageItem;
            // 如果 imageUrl 是 base64 且有 historyId，则不存储 imageUrl
            if (imageItem.imageUrl?.startsWith('data:') && imageItem.historyId) {
              const { imageUrl, ...rest } = imageItem;
              return { ...rest, imageUrl: '' }; // 留空标记，加载时从历史恢复
            }
            // 本地文件 URL 保留
            if (imageItem.imageUrl?.startsWith('/files/')) {
              return imageItem;
            }
          }
          return item;
        });
        // 保存到后端 API（本地文件）
        await desktopApi.saveDesktopItems(itemsForStorage);
      } catch (e) {
        console.error('Failed to save desktop items:', e);
      }
    }, []);

    // 桌面操作处理
    const handleDesktopItemsChange = useCallback((items: DesktopItem[]) => {
      setDesktopItems(items);
      safeDesktopSave(items);
    }, [safeDesktopSave]);
  
    // 查找桌面空闲位置
    const findNextFreePosition = useCallback((): { x: number, y: number } => {
      const gridSize = 100;
      const maxCols = 10; // 每行最多10个
      const occupiedPositions = new Set(
        desktopItems
          .filter(item => {
            // 只考虑不在文件夹内的项目
            const isInFolder = desktopItems.some(
              other => other.type === 'folder' && (other as DesktopFolderItem).itemIds.includes(item.id)
            );
            return !isInFolder;
          })
          .map(item => `${Math.round(item.position.x / gridSize)},${Math.round(item.position.y / gridSize)}`)
      );
      
      // 从左上角开始找空位
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < maxCols; x++) {
          const key = `${x},${y}`;
          if (!occupiedPositions.has(key)) {
            return { x: x * gridSize, y: y * gridSize };
          }
        }
      }
      return { x: 0, y: 0 };
    }, [desktopItems]);
  
    const handleAddToDesktop = useCallback((item: DesktopImageItem) => {
      // 添加图片到桌面 - 使用函数式更新确保使用最新状态
      setDesktopItems(prevItems => {
        // 在最新状态上查找空闲位置
        const gridSize = 100;
        const maxCols = 8; // 固定8列
        
        // 位置从0开始（渲染时会自动加上居中偏移）
        const occupiedPositions = new Set(
          prevItems
            .filter(existingItem => {
              const isInFolder = prevItems.some(
                other => other.type === 'folder' && (other as DesktopFolderItem).itemIds.includes(existingItem.id)
              );
              return !isInFolder;
            })
            .map(existingItem => `${Math.round(existingItem.position.x / gridSize)},${Math.round(existingItem.position.y / gridSize)}`)
        );
        
        // 从第0列、第0行开始找空位
        let freePos = { x: 0, y: 0 };
        for (let y = 0; y < 100; y++) {
          for (let x = 0; x < maxCols; x++) {
            const key = `${x},${y}`;
            if (!occupiedPositions.has(key)) {
              freePos = { x: x * gridSize, y: y * gridSize };
              break;
            }
          }
          // 检查是否已找到空位
          const foundKey = `${Math.round(freePos.x / gridSize)},${Math.round(freePos.y / gridSize)}`;
          if (!occupiedPositions.has(foundKey)) break;
        }
        
        // 更新项目位置
        const itemWithPosition = { ...item, position: freePos };
        const newItems = [...prevItems, itemWithPosition];
        // 延迟保存到后端 API
        setTimeout(() => {
          safeDesktopSave(newItems);
        }, 0);
        return newItems;
      });
    }, [safeDesktopSave]);

  const handleGenerateClick = useCallback(async () => {
    // 检查API配置
    // 本地版本：
    // 1. 启用贞贞API + 有本地key → 使用本地贞贞
    // 2. 有 Gemini key → 使用本地Gemini
    // 3. 都没有 → 提示配置
    const hasValidApi = 
      (thirdPartyApiConfig.enabled && thirdPartyApiConfig.apiKey) ||  // 本地贞贞API
      apiKey;  // 本地Gemini
    
    if (!hasValidApi) {
      setError('请先配置 API Key（贞贞API 或 Gemini）');
      setStatus(ApiStatus.Error);
      return;
    }
    
    // 获取当前模板的权限设置
    const activeTemplate = activeBPTemplate || activeSmartPlusTemplate || activeSmartTemplate;
    const canViewPrompt = activeTemplate?.allowViewPrompt !== false;
    
    let finalPrompt = prompt;
    
    // 如果不允许查看提示词，需要先自动生成提示词
    if (!canViewPrompt && activeTemplate) {
      setStatus(ApiStatus.Loading);
      setError(null);
      
      try {
        console.log('[Generate] 不允许查看提示词，自动生成中...');
        
        if (activeBPTemplate) {
          // BP 模式
          const activeFile = files.length > 0 ? files[0] : null;
          finalPrompt = await processBPTemplate(activeFile, activeBPTemplate, bpInputs);
        } else if (activeSmartPlusTemplate || activeSmartTemplate) {
          // Smart/Smart+ 模式
          const activeFile = files.length > 0 ? files[0] : null;
          if (!activeFile) {
            setError('Smart/Smart+模式需要上传图片');
            setStatus(ApiStatus.Error);
            return;
          }
          finalPrompt = await generateCreativePromptFromImage({
            file: activeFile,
            idea: activeTemplate,
            keyword: prompt,
            smartPlusConfig: activeTemplate.isSmartPlus ? smartPlusOverrides : undefined,
          });
        }
        
        console.log('[Generate] 提示词已生成，开始生图');
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : '提示词生成失败';
        console.error('[Generate] 提示词生成失败');
        setError(`生成失败: ${errorMessage}`);
        setStatus(ApiStatus.Error);
        return;
      }
    } else {
      // 允许查看提示词的正常流程
      if (!prompt) {
        setError('请输入提示词');
        setStatus(ApiStatus.Error);
        return;
      }
      
      // Ensure prompt is generated if template is active but prompt box is empty
      if ((activeSmartTemplate || activeSmartPlusTemplate || activeBPTemplate) && !prompt.trim()) {
           setError(`请先点击企鹅按钮生成/填入提示词`);
           setStatus(ApiStatus.Error);
           return;
      }
    }
    
    setStatus(ApiStatus.Loading);
    setError(null);
    setGeneratedContent(null);

    try {
      // 获取当前创意库的扣费金额（优先用 activeCreativeIdea，它保存了所有类型的创意库）
      const creativeIdeaCost = activeCreativeIdea?.cost;
      
      // 传递所有上传的文件（支持多图编辑），使用 finalPrompt
      const result = await editImageWithGemini(files, finalPrompt, { aspectRatio, imageSize }, creativeIdeaCost);
      // 保存生成时使用的所有原始图片，用于重新生成
      setGeneratedContent({ ...result, originalFiles: [...files] });
      setStatus(ApiStatus.Success);
      
      // 日志输出 - 不打印提示词内容
      console.log('[Generate] 生成成功');
      
      // 保存到历史记录（包含原始输入图片和创意库信息）
      // 如果不允许查看提示词，保存时用占位文本
      const promptToSave = canViewPrompt ? finalPrompt : '[加密提示词]';
      
      // 加密场景下的命名规则：创意库标题 + 关键词
      let promptForDesktop = finalPrompt;
      if (!canViewPrompt && activeTemplate) {
        // 获取创意库标题
        const templateTitle = activeTemplate.title || '创意库';
        // 获取关键词：BP模式用bpInputs的第一个输入，Smart/Smart+模式用prompt
        let keyword = '';
        if (activeBPTemplate && bpInputs) {
          // BP模式：取所有用户输入的第一个非空值
          const inputValues = Object.values(bpInputs as Record<string, string>).filter(v => v && v.trim());
          keyword = inputValues[0] || '';
        } else {
          // Smart/Smart+模式：用用户输入的关键词
          keyword = prompt.trim();
        }
        // 组合命名
        promptForDesktop = keyword ? `${templateTitle}·${keyword}` : templateTitle;
      }
      if (result.imageUrl) {
        // 确定当前使用的创意库类型
        let templateType: 'smart' | 'smartPlus' | 'bp' | 'none' = 'none';
        let templateId: number | undefined;
        if (activeBPTemplate) {
          templateType = 'bp';
          templateId = activeBPTemplate.id;
        } else if (activeSmartPlusTemplate) {
          templateType = 'smartPlus';
          templateId = activeSmartPlusTemplate.id;
        } else if (activeSmartTemplate) {
          templateType = 'smart';
          templateId = activeSmartTemplate.id;
        }
        
        await saveToHistory(result.imageUrl, promptToSave, thirdPartyApiConfig.enabled, files.length > 0 ? files : [], {
          templateId,
          templateType,
          bpInputs: templateType === 'bp' ? { ...bpInputs } : undefined,
          smartPlusOverrides: templateType === 'smartPlus' ? [...smartPlusOverrides] : undefined
        }).then(savedHistoryId => {
          // 自动添加到桌面，并关联历史记录ID
          const freePos = findNextFreePosition();
          const desktopItem: DesktopImageItem = {
            id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            type: 'image',
            name: promptForDesktop.slice(0, 15) + (promptForDesktop.length > 15 ? '...' : ''),
            position: freePos,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            imageUrl: result.imageUrl!,
            prompt: promptToSave,
            model: thirdPartyApiConfig.enabled ? 'nano-banana-2' : 'Gemini',
            isThirdParty: thirdPartyApiConfig.enabled,
            historyId: savedHistoryId, // 关联历史记录，用于重新生成时恢复原始输入图片
          };
          handleAddToDesktop(desktopItem);
        });
      }
      
      if (autoSave && result.imageUrl) {
        downloadImage(result.imageUrl);
      }
      
      // 本地版本：不需要处理用户余额
    } catch (e: unknown) {
      // 检查是否为余额不足错误（402状态码）
      let errorMessage = 'An unknown error occurred.';
      if (e instanceof Error) {
        errorMessage = e.message;
      }
      // 如果是来自后端的余额不足提示，直接显示趣味文案
      if (errorMessage.includes('🐧') || errorMessage.includes('Pebbling') || errorMessage.includes('鹅卵石') || errorMessage.includes('余额')) {
        setError(errorMessage);
      } else {
        setError(`生成失败: ${errorMessage}`);
      }
      console.error('[Generate] 生成失败');
      setStatus(ApiStatus.Error);
    }
  }, [files, prompt, apiKey, thirdPartyApiConfig, activeSmartTemplate, activeSmartPlusTemplate, activeBPTemplate, autoSave, downloadImage, aspectRatio, imageSize, activeCreativeIdea, findNextFreePosition, handleAddToDesktop, bpInputs, smartPlusOverrides]);

  // 卸载创意库：清空所有模板设置
  const handleClearTemplate = useCallback(() => {
    setActiveSmartTemplate(null);
    setActiveSmartPlusTemplate(null);
    setActiveBPTemplate(null);
    setActiveCreativeIdea(null);
    setBpInputs({});
    setSmartPlusOverrides(JSON.parse(JSON.stringify(defaultSmartPlusConfig)));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleGenerateClick();
      }
      // Esc 键卸载创意库
      if (event.key === 'Escape') {
        const hasActiveTemplate = activeSmartTemplate || activeSmartPlusTemplate || activeBPTemplate;
        if (hasActiveTemplate) {
          event.preventDefault();
          handleClearTemplate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGenerateClick, activeSmartTemplate, activeSmartPlusTemplate, activeBPTemplate, handleClearTemplate]);

  // 修改canGenerate条件
  // 如果不允许查看提示词，则只要有模板就可以生成
  const activeTemplateForCheck = activeBPTemplate || activeSmartPlusTemplate || activeSmartTemplate;
  const canViewPromptForCheck = activeTemplateForCheck?.allowViewPrompt !== false;
  const canGenerate = (canViewPromptForCheck ? prompt.trim().length > 0 : !!activeTemplateForCheck) && status !== ApiStatus.Loading;
  
  const isSmartReady = !!activeSmartTemplate && prompt.trim().length > 0;
  const isSmartPlusReady = !!activeSmartPlusTemplate;
  const isBPReady = !!activeBPTemplate; // BP is ready to click penguin anytime to fill variables
  
  const canGenerateSmartPrompt = ((files.length > 0) && (isSmartReady || isSmartPlusReady)) || (isBPReady) && smartPromptGenStatus !== ApiStatus.Loading;

  const handleBpInputChange = (id: string, value: string) => {
      setBpInputs(prev => ({...prev, [id]: value}));
  };
  
  // 再次编辑：将生成的图片转换为File，清空其他图片，卸载创意库
  const handleEditAgain = useCallback(async () => {
    if (!generatedContent?.imageUrl) return;
    
    try {
      let blob: Blob;
      
      if (generatedContent.imageUrl.startsWith('data:')) {
        // base64 转 Blob
        const response = await fetch(generatedContent.imageUrl);
        blob = await response.blob();
      } else {
        // 外部URL，fetch获取
        const response = await fetch(generatedContent.imageUrl);
        blob = await response.blob();
      }
      
      // 创建 File 对象
      const timestamp = Date.now();
      const file = new File([blob], `generated-${timestamp}.png`, { type: 'image/png' });
      
      // 清空所有图片，仅保留结果图并选中
      setFiles([file]);
      setActiveFileIndex(0);
      
      // 清空创意库，还原默认状态
      setActiveSmartTemplate(null);
      setActiveSmartPlusTemplate(null);
      setActiveBPTemplate(null);
      setActiveCreativeIdea(null);
      setBpInputs({});
      setSmartPlusOverrides(JSON.parse(JSON.stringify(defaultSmartPlusConfig)));
      setPrompt(''); // 清空提示词
      
      // 清除当前生成结果，准备再次编辑
      setGeneratedContent(null);
      setStatus(ApiStatus.Idle);
    } catch (e) {
      console.error('转换图片失败:', e);
      setError('无法将图片添加到编辑列表');
    }
  }, [generatedContent]);
  
  // 重新生成：恢复原始输入状态，等待用户手动点击生成
  const handleRegenerate = useCallback(() => {
    // 保存当初使用的所有原始图片
    const originalFiles = generatedContent?.originalFiles || [];
    
    // 恢复原始输入图片到 UI 上
    if (originalFiles.length > 0) {
      setFiles(originalFiles);
      setActiveFileIndex(0);
    } else {
      setFiles([]);
      setActiveFileIndex(null);
    }
    
    // 关闭结果浮层，回到编辑状态
    setStatus(ApiStatus.Idle);
    setGeneratedContent(null);
    setError(null);
    
    // 提示已恢复 - 保留 prompt 不变，用户可以手动点生成
  }, [generatedContent]);

  const handleDesktopImageDoubleClick = useCallback((item: DesktopImageItem) => {
    // 双击图片预览
    setPreviewImageUrl(item.imageUrl);
  }, []);

  // 关闭生成结果浮层
  const handleDismissResult = useCallback(() => {
    setStatus(ApiStatus.Idle);
    setGeneratedContent(null);
    setError(null);
  }, []);

  const handleRenameItem = useCallback((id: string, newName: string) => {
    const updatedItems = desktopItems.map(item => {
      if (item.id === id) {
        return { ...item, name: newName, updatedAt: Date.now() };
      }
      return item;
    });
    handleDesktopItemsChange(updatedItems);
  }, [desktopItems, handleDesktopItemsChange]);

  // 桌面图片操作 - 预览
  const handleDesktopImagePreview = useCallback((item: DesktopImageItem) => {
    setPreviewImageUrl(item.imageUrl);
  }, []);

  // 桌面图片操作 - 再编辑（将图片添加到上传列表，不携带提示词）
  const handleDesktopImageEditAgain = useCallback(async (item: DesktopImageItem) => {
    try {
      // 将图片URL转换为File对象
      const response = await fetch(item.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `${item.name}.png`, { type: 'image/png' });
      
      // 添加到文件列表
      setFiles(prev => [...prev, file]);
      setActiveFileIndex(files.length); // 选中新添加的图片
      
      // 不携带提示词 - 让用户重新输入
      // if (item.prompt) {
      //   setPrompt(item.prompt);
      // }
    } catch (e) {
      console.error('添加图片到编辑列表失败:', e);
    }
  }, [files.length]);

  // 桌面图片操作 - 重新生成（只恢复状态，不自动生成）
  const handleDesktopImageRegenerate = useCallback(async (item: DesktopImageItem) => {
    if (!item.prompt) {
      setError('此图片没有保存原始提示词，无法重新生成');
      setStatus(ApiStatus.Error);
      return;
    }
    
    // 恢复提示词
    setPrompt(item.prompt);
    
    // 尝试恢复原始输入图片和创意库配置（如果有历史记录）
    if (item.historyId) {
      const historyItem = generationHistory.find(h => h.id === item.historyId);
      if (historyItem) {
        // 恢复所有输入图片（多图支持）
        if (historyItem.inputImages && historyItem.inputImages.length > 0) {
          try {
            const restoredFiles = await Promise.all(historyItem.inputImages.map(async (img, index) => {
              const byteCharacters = atob(img.data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: img.type });
              return new File([blob], img.name, { type: img.type });
            }));
            
            setFiles(restoredFiles);
            setActiveFileIndex(0);
          } catch (e) {
            console.warn('恢复多图失败:', e);
            // 回退到单图恢复
            if (historyItem.inputImageData && historyItem.inputImageType) {
              try {
                const byteCharacters = atob(historyItem.inputImageData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: historyItem.inputImageType });
                const restoredFile = new File([blob], historyItem.inputImageName || 'restored-input.png', { type: historyItem.inputImageType });
                
                setFiles([restoredFile]);
                setActiveFileIndex(0);
              } catch (e2) {
                console.warn('恢复单图也失败:', e2);
                setFiles([]);
                setActiveFileIndex(null);
              }
            } else {
              setFiles([]);
              setActiveFileIndex(null);
            }
          }
        } else if (historyItem.inputImageData && historyItem.inputImageType) {
          // 向后兼容：单图恢复
          try {
            const byteCharacters = atob(historyItem.inputImageData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: historyItem.inputImageType });
            const restoredFile = new File([blob], historyItem.inputImageName || 'restored-input.png', { type: historyItem.inputImageType });
            
            setFiles([restoredFile]);
            setActiveFileIndex(0);
          } catch (e) {
            console.warn('恢复输入图片失败:', e);
            setFiles([]);
            setActiveFileIndex(null);
          }
        } else {
          // 没有输入图片
          setFiles([]);
          setActiveFileIndex(null);
        }
        
        // 恢复创意库配置
        setActiveSmartTemplate(null);
        setActiveSmartPlusTemplate(null);
        setActiveBPTemplate(null);
        setActiveCreativeIdea(null);
        setBpInputs({});
        setSmartPlusOverrides(JSON.parse(JSON.stringify(defaultSmartPlusConfig)));
        
        if (historyItem.creativeTemplateType && historyItem.creativeTemplateType !== 'none' && historyItem.creativeTemplateId) {
          const template = creativeIdeas.find(idea => idea.id === historyItem.creativeTemplateId);
          if (template) {
            // 设置当前使用的创意库（用于扣费）
            setActiveCreativeIdea(template);
            
            if (historyItem.creativeTemplateType === 'bp') {
              setActiveBPTemplate(template);
              if (historyItem.bpInputs) {
                setBpInputs(historyItem.bpInputs);
              }
            } else if (historyItem.creativeTemplateType === 'smartPlus') {
              setActiveSmartPlusTemplate(template);
              if (historyItem.smartPlusOverrides) {
                setSmartPlusOverrides(historyItem.smartPlusOverrides);
              }
            } else if (historyItem.creativeTemplateType === 'smart') {
              setActiveSmartTemplate(template);
            }
          }
        }
      } else {
        // 找不到历史记录，清空输入
        setFiles([]);
        setActiveFileIndex(null);
      }
    } else {
      // 没有历史记录，清空输入
      setFiles([]);
      setActiveFileIndex(null);
    }
    
      // 关闭结果浮层，回到编辑状态
    setStatus(ApiStatus.Idle);
    setGeneratedContent(null);
    setError(null);
    
    // 取消桌面选中，让用户注意力回到编辑区
    setDesktopSelectedIds([]);
  }, [generationHistory, creativeIdeas]);

  const { theme, themeName } = useTheme();

  return (
    <div 
      className="h-screen font-sans flex flex-row overflow-hidden selection:bg-blue-500/30 transition-colors duration-300"
      style={{ 
        backgroundColor: theme.colors.bgPrimary,
        color: theme.colors.textPrimary
      }}
    >
      {/* 雪花效果 */}
      <SnowfallEffect />
      
      <input 
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
        multiple
      />
      <input
        ref={importIdeasInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportIdeas}
      />
      
      {/* 左侧面板 */}
      <div className="flex-shrink-0">
        <LeftPanel 
            files={files}
            activeFileIndex={activeFileIndex}
            onFileSelection={handleFileSelection}
            onFileRemove={handleFileRemove}
            onFileSelect={setActiveFileIndex}
            onTriggerUpload={() => fileInputRef.current?.click()}
            onSettingsClick={() => setSettingsModalOpen(true)}
            currentApiMode={
              thirdPartyApiConfig.enabled && thirdPartyApiConfig.apiKey && thirdPartyApiConfig.baseUrl
                ? 'local-thirdparty'
                : 'local-gemini'
            }
            prompt={prompt}
            setPrompt={handleSetPrompt}
            activeSmartTemplate={activeSmartTemplate}
            activeSmartPlusTemplate={activeSmartPlusTemplate}
            activeBPTemplate={activeBPTemplate}
            bpInputs={bpInputs}
            setBpInput={handleBpInputChange}
            smartPlusOverrides={smartPlusOverrides}
            setSmartPlusOverrides={setSmartPlusOverrides}
            handleGenerateSmartPrompt={handleGenerateSmartPrompt}
            canGenerateSmartPrompt={canGenerateSmartPrompt}
            smartPromptGenStatus={smartPromptGenStatus}
            onCancelSmartPrompt={handleCancelSmartPrompt}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            imageSize={imageSize}
            setImageSize={setImageSize}
            isThirdPartyApiEnabled={thirdPartyApiConfig.enabled}
            onClearTemplate={handleClearTemplate}
          />
        </div>
      <div className="relative flex-1 flex min-w-0">
        <Canvas 
          view={view}
          setView={setView}
          files={files}
          onUploadClick={() => fileInputRef.current?.click()}
          creativeIdeas={creativeIdeas}
          localCreativeIdeas={localCreativeIdeas}
          onBack={() => setView('editor')}
          onAdd={handleAddNewIdea}
          onDelete={handleDeleteCreativeIdea}
          onEdit={handleStartEditIdea}
          onUse={handleUseCreativeIdea}
          status={status}
          error={error}
          content={generatedContent}
          onPreviewClick={setPreviewImageUrl}
          onExportIdeas={handleExportIdeas}
          onImportIdeas={() => importIdeasInputRef.current?.click()}
          onReorderIdeas={handleReorderIdeas}
          onEditAgain={handleEditAgain}
          onRegenerate={handleRegenerate}
          onDismissResult={handleDismissResult}
          prompt={prompt}
          imageSize={imageSize}
          history={generationHistory}
          onHistorySelect={handleHistorySelect}
          onHistoryDelete={handleHistoryDelete}
          onHistoryClear={handleHistoryClear}
          desktopItems={desktopItems}
          onDesktopItemsChange={handleDesktopItemsChange}
          onDesktopImageDoubleClick={handleDesktopImageDoubleClick}
          desktopSelectedIds={desktopSelectedIds}
          onDesktopSelectionChange={setDesktopSelectedIds}
          openFolderId={openFolderId}
          onFolderOpen={setOpenFolderId}
          onFolderClose={() => setOpenFolderId(null)}
          openStackId={openStackId}
          onStackOpen={setOpenStackId}
          onStackClose={() => setOpenStackId(null)}
          onRenameItem={handleRenameItem}
          onDesktopImagePreview={handleDesktopImagePreview}
          onDesktopImageEditAgain={handleDesktopImageEditAgain}
          onDesktopImageRegenerate={handleDesktopImageRegenerate}
          onFileDrop={handleFileSelection}
                    isResultMinimized={isResultMinimized}
          setIsResultMinimized={setIsResultMinimized}
          onToggleFavorite={handleToggleFavorite}
          isImporting={isImporting}
        />
        {view === 'editor' && (
             <div className="absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-300 bottom-6">
                <GenerateButton 
                    onClick={handleGenerateClick}
                    disabled={!canGenerate}
                    status={status}
                    hasMinimizedResult={isResultMinimized && (status === ApiStatus.Loading || status === ApiStatus.Success || status === ApiStatus.Error)}
                    onExpandResult={() => setIsResultMinimized(false)}
                />
             </div>
        )}
      </div>
      {/* 右侧面板 */}
      <div className="flex-shrink-0">
        <RightPanel 
          creativeIdeas={creativeIdeas}
          handleUseCreativeIdea={handleUseCreativeIdea}
          setAddIdeaModalOpen={() => setAddIdeaModalOpen(true)}
          setView={setView}
          onDeleteIdea={handleDeleteCreativeIdea}
          onEditIdea={handleStartEditIdea}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>
      
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.2); }
      `}</style>
      
      {previewImageUrl && (
        <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
      )}
      <AddCreativeIdeaModal 
        isOpen={isAddIdeaModalOpen}
        onClose={() => { setAddIdeaModalOpen(false); setEditingIdea(null); }}
        onSave={handleSaveCreativeIdea}
        ideaToEdit={editingIdea}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        thirdPartyConfig={thirdPartyApiConfig}
        onThirdPartyConfigChange={handleThirdPartyConfigChange}
        geminiApiKey={apiKey}
        onGeminiApiKeySave={handleApiKeySave}
        autoSaveEnabled={autoSave}
        onAutoSaveToggle={handleAutoSaveToggle}
      />
      
      {/* 加载小窗 */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#171717] rounded-2xl border border-white/10 shadow-2xl shadow-black/50 px-8 py-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 加载动画 */}
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <PIcon className="w-7 h-7 text-white/80" />
              </div>
              <div className="absolute inset-0 rounded-xl border border-white/10 animate-spin" style={{ animationDuration: '3s' }}>
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
            </div>
            {/* 文字 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">正在加载</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1 h-1 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 包裹应用的主题Provider
const AppWithTheme: React.FC = () => {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
};

export default AppWithTheme;
