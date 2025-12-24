import { useState, useRef, useEffect, useCallback } from 'react';
import React from 'react';
import Sidebar from './components/Sidebar';
import RegistrationModal from './components/RegistrationModal';
import ConfirmDialog from './components/ConfirmDialog';
import { FilterState, Message, Conversation } from './types';
import { MAX_FREE_TRIALS, MAX_FREE_USER_QUOTA } from './constants';
import { getSession, getCurrentUser, onAuthStateChange, getUserPlan } from './services/auth';
import type { User, Session } from '@supabase/supabase-js';

interface Paper {
  title: string;
  url: string;
  venue_code: string;
  venue_type: string;
  year: number | null;
  abstract: string | null;
  authors: string[];
  doi: string | null;
}

const App: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [filter, setFilter] = useState<FilterState>({
    domain: [],
    venues: ['NeurIPS (Neural Information Processing Systems)'],
    startYear: 2025,
    endYear: 2025
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [progress, setProgress] = useState<{
    step: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    message?: string;
  }>({ step: '', status: 'idle' });
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const isDeletingRef = useRef<string | null>(null); // 标记正在删除的对话ID
  const searchingConversationIdRef = useRef<string | null>(null); // 标记正在搜索的对话ID
  
  // Supabase Auth 状态
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [anonId, setAnonId] = useState<string>(() => {
    // 生成或获取游客 ID
    const saved = localStorage.getItem('anon_id');
    if (saved) {
      return saved;
    }
    const newId = crypto.randomUUID();
    localStorage.setItem('anon_id', newId);
    return newId;
  });
  const [showRegModal, setShowRegModal] = useState(false);
  // 配额状态
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null); // null 表示未知，数字表示剩余次数
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | null>(null); // 用户计划
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // 对话管理
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt)
        }));
      } catch {
        return [];
      }
    }
    // 创建初始对话
    const initialConv: Conversation = {
      id: 'default',
      title: 'New Conversation',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return [initialConv];
  });
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    const saved = localStorage.getItem('current_conversation_id');
    return saved || 'default';
  });
  
  // 每个对话的状态（messages, papers, progress等）
  const [conversationData, setConversationData] = useState<Record<string, {
    messages: Message[];
    papers: Paper[];
    progress?: {
      step: string;
      status: 'idle' | 'running' | 'completed' | 'error';
      message?: string;
    };
  }>>(() => {
    const saved = localStorage.getItem('conversation_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 转换 messages 的 timestamp
        Object.keys(parsed).forEach(key => {
          if (parsed[key].messages) {
            parsed[key].messages = parsed[key].messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
          }
        });
        return parsed;
      } catch {
        return {};
      }
    }
    return {
      default: {
        messages: [{
          id: 'welcome',
          role: 'assistant',
          content: "Welcome to ScholarPulse Archive. I provide precise retrieval of high-impact research from elite academic venues. Specify your research parameters to begin.",
          timestamp: new Date()
        }],
        papers: []
      }
    };
  });

  // 当前对话的数据
  const currentConversationData = conversationData[currentConversationId] || {
    messages: [{
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to ScholarPulse Archive. I provide precise retrieval of high-impact research from elite academic venues. Specify your research parameters to begin.",
      timestamp: new Date()
    }],
    papers: []
  };

  // 同步当前对话数据到状态
  useEffect(() => {
    // 如果正在删除对话，跳过更新（避免干扰删除操作）
    if (isDeletingRef.current !== null) {
      return;
    }
    
    if (conversationData[currentConversationId]) {
      setMessages(conversationData[currentConversationId].messages);
      setPapers(conversationData[currentConversationId].papers);
      // 恢复当前对话的进度状态
      if (conversationData[currentConversationId].progress) {
        setProgress(conversationData[currentConversationId].progress!);
      } else {
        setProgress({ step: '', status: 'idle' });
      }
    } else {
      // 如果对话数据不存在，初始化它
      const initialMessages: Message[] = [{
        id: 'welcome',
        role: 'assistant',
        content: "Welcome to ScholarPulse Archive. I provide precise retrieval of high-impact research from elite academic venues. Specify your research parameters to begin.",
        timestamp: new Date()
      }];
      setMessages(initialMessages);
      setPapers([]);
      setProgress({ step: '', status: 'idle' });
      setConversationData(prev => ({
        ...prev,
        [currentConversationId]: {
          messages: initialMessages,
          papers: [],
          progress: { step: '', status: 'idle' }
        }
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  // 保存对话数据到 localStorage
  useEffect(() => {
    if (currentConversationId && conversationData[currentConversationId]) {
      const updated = {
        ...conversationData,
        [currentConversationId]: {
          messages,
          papers
        }
      };
      setConversationData(updated);
      localStorage.setItem('conversation_data', JSON.stringify(updated));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, papers, currentConversationId]);

  // 保存对话列表到 localStorage
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  // 保存当前对话ID
  useEffect(() => {
    localStorage.setItem('current_conversation_id', currentConversationId);
  }, [currentConversationId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // 初始化 Supabase Auth 状态
  useEffect(() => {
    // 获取当前 session 和用户
    getSession().then(async (sess) => {
      if (sess) {
        setSession(sess);
        setUser(sess.user);
        // 获取用户计划
        if (sess.user) {
          const plan = await getUserPlan(sess.user.id);
          setUserPlan(plan);
          // 不设置配额，等待首次搜索时从后端获取
        }
      } else {
        // 未登录，不设置配额（等待首次搜索时从后端获取）
        setUserPlan(null);
        // 不设置 quotaRemaining，保持为 null，直到从后端获取实际配额
      }
    });
    
    getCurrentUser().then(async (u) => {
      if (u) {
        setUser(u);
        // 获取用户计划
        const plan = await getUserPlan(u.id);
        setUserPlan(plan);
        // 如果是 free 用户，不设置配额（等待首次搜索时从后端获取）
        // Pro 用户不显示配额
      } else {
        // 未登录，不设置配额（等待首次搜索时从后端获取）
        setUserPlan(null);
        // 不设置 quotaRemaining，保持为 null，直到从后端获取实际配额
      }
    });
    
    // 监听认证状态变化
    const { data: { subscription } } = onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_IN') {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          const plan = await getUserPlan(sess.user.id);
          setUserPlan(plan);
          // 不设置配额，等待首次搜索时从后端获取
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserPlan(null);
        // 登出后，清除配额显示（等待首次搜索时从后端获取）
        setQuotaRemaining(null);
      } else if (event === 'TOKEN_REFRESHED' && sess) {
        setSession(sess);
        setUser(sess.user);
        if (sess.user) {
          const plan = await getUserPlan(sess.user.id);
          setUserPlan(plan);
          // 不设置配额，等待首次搜索时从后端获取
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 获取配额信息
  const fetchQuota = useCallback(async () => {
    try {
      const getApiUrl = () => {
        const envApiUrl = import.meta.env.VITE_API_URL;
        if (envApiUrl && envApiUrl !== 'http://backend:8000' && envApiUrl !== '') {
          return envApiUrl;
        }
        return '';
      };
      const apiUrl = getApiUrl();
      const apiEndpoint = `${apiUrl}/v1/quota`;
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // 添加身份标识
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        headers['X-Anon-Id'] = anonId;
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.remaining !== undefined) {
          setQuotaRemaining(data.remaining);
        }
        if (data.plan) {
          setUserPlan(data.plan === 'pro' ? 'pro' : 'free');
        }
      }
    } catch (error) {
      console.error('获取配额信息失败:', error);
    }
  }, [session, anonId]);

  // 页面加载时获取配额信息
  useEffect(() => {
    // 等待用户状态初始化后再获取配额
    const timer = setTimeout(() => {
      try {
        fetchQuota();
      } catch (error) {
        console.error('获取配额失败:', error);
        // 即使失败也不影响页面渲染
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [fetchQuota]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleRegister = () => {
    // 注册成功后，用户状态会自动更新（通过 onAuthStateChange）
    setShowRegModal(false);
  };

  // 创建新对话
  const handleNewConversation = () => {
    const newId = `conv_${Date.now()}`;
    const newConversation: Conversation = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    
    // 初始化新对话的数据
    const initialMessages: Message[] = [{
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to ScholarPulse Archive. I provide precise retrieval of high-impact research from elite academic venues. Specify your research parameters to begin.",
      timestamp: new Date()
    }];
    
    setConversationData(prev => ({
      ...prev,
      [newId]: {
        messages: initialMessages,
        papers: []
      }
    }));
  };

  // 切换对话
  const handleSwitchConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    // 更新对话的更新时间
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, updatedAt: new Date() }
        : conv
    ));
  };

  // 清除所有对话（保留默认对话）
  const handleClearConversations = () => {
    setConfirmDialog({
      isOpen: true,
      title: '清除所有对话',
      message: '确定要清除所有对话历史吗？此操作不可恢复。',
      onConfirm: () => {
        const defaultConv: Conversation = {
          id: 'default',
          title: 'New Conversation',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setConversations([defaultConv]);
        setCurrentConversationId('default');
        
        // 清除对话数据（保留默认对话的欢迎消息）
        const defaultData = {
          default: {
            messages: [{
              id: 'welcome',
              role: 'assistant',
              content: "Welcome to ScholarPulse Archive. I provide precise retrieval of high-impact research from elite academic venues. Specify your research parameters to begin.",
              timestamp: new Date()
            }],
            papers: []
          }
        };
        setConversationData(defaultData);
        localStorage.setItem('conversation_data', JSON.stringify(defaultData));
        setConfirmDialog(null);
      }
    });
  };

  // 删除单个对话（直接删除，不需要弹窗）
  const handleDeleteConversation = (conversationId: string) => {
    // 检查是否只剩最后一个对话框，如果是则不允许删除
    if (conversations.length <= 1) {
      return;
    }
    
    // 标记正在删除，避免 useEffect 干扰
    isDeletingRef.current = conversationId;
    
    // 判断是否删除的是当前对话框
    const isCurrentConversation = currentConversationId === conversationId;
    
    // 先删除对话数据
    setConversationData(prev => {
      const updated = { ...prev };
      delete updated[conversationId];
      localStorage.setItem('conversation_data', JSON.stringify(updated));
      return updated;
    });
    
    // 使用函数式更新确保所有状态更新是原子的
    setConversations(prev => {
      const filtered = prev.filter(conv => conv.id !== conversationId);
      
      // 如果删除的是当前对话框，跳转到删除后的第一个对话框（从上往下）
      if (isCurrentConversation && filtered.length > 0) {
        const firstConversationId = filtered[0].id;
        // 使用 setTimeout 确保在状态更新后切换
        setTimeout(() => {
          setCurrentConversationId(firstConversationId);
        }, 0);
      }
      
      return filtered;
    });
    
    // 清除删除标记（在下一个事件循环中，确保所有状态更新完成）
    setTimeout(() => {
      isDeletingRef.current = null;
    }, 0);
  };

  // 更新对话标题（基于第一条用户消息）
  const updateConversationTitle = (conversationId: string, title: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, title: title.length > 30 ? title.substring(0, 30) + '...' : title, updatedAt: new Date() }
        : conv
    ));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || filter.venues.length === 0) return;

    // 保存发起搜索时的对话 ID，确保结果保存到正确的对话
    const searchConversationId = currentConversationId;
    searchingConversationIdRef.current = searchConversationId; // 标记正在搜索的对话

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    // 保存用户消息到发起搜索的对话
    setConversationData(prev => {
      const updated = { ...prev };
      if (!updated[searchConversationId]) {
        updated[searchConversationId] = { messages: [], papers: [] };
      }
      updated[searchConversationId].messages = [
        ...(updated[searchConversationId].messages || []),
        userMessage
      ];
      localStorage.setItem('conversation_data', JSON.stringify(updated));
      return updated;
    });
    
    // 如果当前对话是发起搜索的对话，更新 UI
    if (currentConversationId === searchConversationId) {
      setMessages(prev => [...prev, userMessage]);
    }
    
    // 如果是第一条用户消息，更新对话标题
    const currentMessages = conversationData[searchConversationId]?.messages || messages;
    if (currentMessages.length === 1 && currentMessages[0].id === 'welcome') {
      updateConversationTitle(searchConversationId, input.trim());
    }
    
    setInput('');
    setIsLoading(true);
    // 清空之前的论文列表和进度状态（仅当当前对话是发起搜索的对话时）
    if (currentConversationId === searchConversationId) {
      setPapers([]);
      setProgress({ step: '', status: 'idle' });
    }
    // 更新对话数据中的进度状态
    setConversationData(prev => {
      const updated = { ...prev };
      if (!updated[searchConversationId]) {
        updated[searchConversationId] = { messages: [], papers: [] };
      }
      updated[searchConversationId].progress = { step: '', status: 'idle' };
      localStorage.setItem('conversation_data', JSON.stringify(updated));
      return updated;
    });
    
    // API地址：始终使用相对路径，让nginx代理到后端
    // 这样无论前端在哪里运行（Docker或本地），都能通过nginx正确代理
    // 如果需要直接访问后端（本地开发），可以通过环境变量VITE_API_URL配置
    const getApiUrl = () => {
      // 始终使用相对路径，让nginx代理到后端
      // 这样无论前端在哪里运行（Docker或本地），都能通过nginx正确代理
      // 如果需要直接访问后端（本地开发），可以通过环境变量VITE_API_URL配置
      const envApiUrl = import.meta.env.VITE_API_URL;
      // 只有在明确配置了非空且不是backend服务名时才使用环境变量
      if (envApiUrl && envApiUrl !== 'http://backend:8000' && envApiUrl !== '') {
        return envApiUrl;
      }
      // 默认使用相对路径，nginx会代理到后端
      return '';
    };
    const apiUrl = getApiUrl();
    const apiEndpoint = `${apiUrl}/v1/paper_search`;
    console.log('API Endpoint:', apiEndpoint, 'API URL:', apiUrl); // 调试日志
    
    // 创建新的AbortController
    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;
    
    try {
      // 准备请求 headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // 添加身份标识：登录用户用 Authorization，游客用 X-Anon-Id
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        headers['X-Anon-Id'] = anonId;
      }
      
      // 使用SSE接收实时进度
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        signal: abortController.signal, // 添加AbortSignal支持
        body: JSON.stringify({
          query: input,
          venues: filter.venues.map(v => v.split(' (')[0]), // 提取venue代码
          start_year: filter.startYear,
          end_year: filter.endYear,
          rows_each: 10,
          search_journal: true,
          search_conference: true
        })
      });

      // 检查配额错误（402 Payment Required 或 403 Forbidden）
      if (response.status === 402 || response.status === 403) {
        let errorData: any = {};
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          } else {
            // 如果不是 JSON，尝试读取文本
            const text = await response.text();
            try {
              errorData = JSON.parse(text);
            } catch {
              // 如果解析失败，使用默认消息
              errorData = {
                code: 'QUOTA_EXCEEDED',
                message: '配额已用完。游客可用3次，登录后50次，订阅无限。'
              };
            }
          }
        } catch (e) {
          // 如果读取失败，使用默认消息
          errorData = {
            code: 'QUOTA_EXCEEDED',
            message: '配额已用完。游客可用3次，登录后50次，订阅无限。'
          };
        }
        
        if (errorData.code === 'QUOTA_EXCEEDED' || response.status === 402 || response.status === 403) {
          // 配额已用完
          setQuotaRemaining(0);
          setShowRegModal(true);
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: errorData.message || errorData.detail?.message || '配额已用完。游客可用3次，登录后50次，订阅无限。',
            timestamp: new Date()
          };
          // 保存错误消息到发起搜索的对话
          setConversationData(prev => {
            const updated = { ...prev };
            if (!updated[searchConversationId]) {
              updated[searchConversationId] = { messages: [], papers: [] };
            }
            updated[searchConversationId].messages = [
              ...(updated[searchConversationId].messages || []),
              errorMessage
            ];
            updated[searchConversationId].papers = [];
            localStorage.setItem('conversation_data', JSON.stringify(updated));
            return updated;
          });
          // 如果当前对话是发起搜索的对话，更新 UI
          if (currentConversationId === searchConversationId) {
            setMessages(prev => [...prev, errorMessage]);
            setPapers([]);
          }
          setIsLoading(false);
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Search request failed');
      }
      
      // 从响应 header 中获取剩余配额（如果后端返回，且用户不是 pro）
      if (userPlan !== 'pro') {
        const remainingHeader = response.headers.get('X-Quota-Remaining');
        if (remainingHeader) {
          const remaining = parseInt(remainingHeader, 10);
          if (!isNaN(remaining)) {
            setQuotaRemaining(remaining);
          }
        }
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 读取SSE流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resultData: any = null;
      let hasReceivedResult = false; // 标记是否收到过result事件
      let totalBytesReceived = 0; // 调试：记录接收的总字节数
      let eventCount = { progress: 0, result: 0, error: 0 }; // 调试：记录各类型事件数量

      const processSSELine = (event: string | null, data: string | null) => {
        if (!event || !data) {
          console.warn('processSSELine: 缺少event或data', { event, hasData: !!data });
          return;
        }
        
        try {
          const parsedData = JSON.parse(data);
          console.log('成功解析SSE事件:', event, 'Data keys:', Object.keys(parsedData));
          
          if (event === 'progress') {
            eventCount.progress++;
            // 更新进度到发起搜索的对话数据中
            const progressData = {
              step: parsedData.step,
              status: parsedData.status,
              message: parsedData.message
            };
            setConversationData(prev => {
              const updated = { ...prev };
              if (!updated[searchConversationId]) {
                updated[searchConversationId] = { messages: [], papers: [] };
              }
              updated[searchConversationId].progress = progressData;
              localStorage.setItem('conversation_data', JSON.stringify(updated));
              return updated;
            });
            // 如果当前对话是发起搜索的对话，更新 UI
            if (currentConversationId === searchConversationId) {
              setProgress(progressData);
            }
            // 更新配额信息（如果 SSE 事件中包含，且用户不是 pro）
            if (parsedData.quota_remaining !== undefined && userPlan !== 'pro') {
              const quota = parseInt(parsedData.quota_remaining, 10);
              if (!isNaN(quota)) {
                setQuotaRemaining(quota);
              }
            }
          } else if (event === 'result') {
            eventCount.result++;
            // 保存结果数据
            console.log('收到result事件:', {
              totalBefore: parsedData.total_papers_before_filter,
              totalAfter: parsedData.total_papers_after_filter,
              papersCount: parsedData.papers?.length || 0
            });
            resultData = parsedData;
            hasReceivedResult = true; // 标记已收到result事件
            // 更新配额信息（如果 SSE 事件中包含，且用户不是 pro）
            if (parsedData.quota_remaining !== undefined && userPlan !== 'pro') {
              const quota = parseInt(parsedData.quota_remaining, 10);
              if (!isNaN(quota)) {
                setQuotaRemaining(quota);
              }
            }
          } else if (event === 'error') {
            eventCount.error++;
            // 收到错误事件，生成错误消息
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: parsedData.message || parsedData.error || '搜索过程中出现错误。',
              timestamp: new Date()
            };
            // 保存错误消息到发起搜索的对话
            setConversationData(prev => {
              const updated = { ...prev };
              if (!updated[searchConversationId]) {
                updated[searchConversationId] = { messages: [], papers: [] };
              }
              updated[searchConversationId].messages = [
                ...(updated[searchConversationId].messages || []),
                errorMessage
              ];
              updated[searchConversationId].papers = [];
              localStorage.setItem('conversation_data', JSON.stringify(updated));
              return updated;
            });
            // 更新进度到发起搜索的对话数据中
            const errorProgress = { step: 'error', status: 'error' as const, message: '搜索失败' };
            setConversationData(prev => {
              const updated = { ...prev };
              if (!updated[searchConversationId]) {
                updated[searchConversationId] = { messages: [], papers: [] };
              }
              updated[searchConversationId].progress = errorProgress;
              localStorage.setItem('conversation_data', JSON.stringify(updated));
              return updated;
            });
            // 如果当前对话是发起搜索的对话，更新 UI
            if (currentConversationId === searchConversationId) {
              setMessages(prev => [...prev, errorMessage]);
              setPapers([]);
              setProgress(errorProgress);
            }
            throw new Error(parsedData.message || parsedData.error);
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes('搜索')) {
            throw e; // 重新抛出错误事件
          }
          console.error('解析SSE数据失败:', e, 'Event:', event, 'Data length:', data?.length, 'Data preview:', data?.substring(0, 200));
          // 如果是result事件但解析失败，也要标记已收到（避免误判为未收到）
          if (event === 'result') {
            console.warn('result事件JSON解析失败，但已标记为已收到');
            hasReceivedResult = true;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 处理最后剩余的数据
          console.log('SSE流结束，剩余buffer长度:', buffer.length, 'Buffer预览:', buffer.substring(0, 200));
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            let currentEvent: string | null = null;
            let currentData: string | null = null;
            
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                // 如果之前有未处理的事件，先处理它
                if (currentEvent && currentData !== null) {
                  const trimmedData = currentData.trim();
                  if (trimmedData) {
                    console.log('流结束时处理事件:', currentEvent, 'Data length:', trimmedData.length);
                    processSSELine(currentEvent, trimmedData);
                  }
                }
                currentEvent = line.slice(7).trim();
                currentData = null;
              } else if (line.startsWith('data: ')) {
                // 支持多行data字段（SSE规范：多行data需要拼接）
                if (currentData === null) {
                  currentData = line.slice(6);
                } else {
                  currentData += '\n' + line.slice(6);
                }
              } else if (line.trim() === '' && currentEvent && currentData !== null) {
                // 处理完整的事件（空行表示事件结束）
                const trimmedData = currentData.trim();
                if (trimmedData) {
                  console.log('流结束时处理完整事件:', currentEvent, 'Data length:', trimmedData.length);
                  processSSELine(currentEvent, trimmedData);
                }
                currentEvent = null;
                currentData = null;
              }
            }
            
            // 处理最后一个可能不完整的事件（即使没有空行结尾）
            if (currentEvent && currentData !== null) {
              const trimmedData = currentData.trim();
              if (trimmedData) {
                console.log('处理流结束时的最后一个事件:', currentEvent, 'Data length:', trimmedData.length, 'Data preview:', trimmedData.substring(0, 100));
                processSSELine(currentEvent, trimmedData);
              }
            } else if (currentEvent) {
              console.warn('流结束时发现未完成的事件:', currentEvent, '但没有data');
            }
          } else {
            console.log('流结束时buffer为空');
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        totalBytesReceived += chunk.length;
        buffer += chunk;
        // 检查buffer中是否包含result事件
        if (buffer.includes('event: result')) {
          const resultIndex = buffer.indexOf('event: result');
          console.log('检测到result事件在buffer中，位置:', resultIndex, 'buffer长度:', buffer.length);
          console.log('result事件周围内容:', buffer.substring(Math.max(0, resultIndex - 50), Math.min(buffer.length, resultIndex + 200)));
        }
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent: string | null = null;
        let currentData: string | null = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // 如果之前有未处理的事件，先处理它
            if (currentEvent && currentData !== null) {
              const trimmedData = currentData.trim();
              if (trimmedData) {
                console.log('处理事件:', currentEvent, 'Data length:', trimmedData.length);
                processSSELine(currentEvent, trimmedData);
              }
            }
            const eventType = line.slice(7).trim();
            if (eventType === 'result') {
              console.log('发现result事件行:', line);
            }
            currentEvent = eventType;
            currentData = null;
          } else if (line.startsWith('data: ')) {
            // 支持多行data字段（SSE规范：多行data需要拼接）
            if (currentData === null) {
              currentData = line.slice(6);
            } else {
              currentData += '\n' + line.slice(6);
            }
            // 如果是result事件的data，记录一下
            if (currentEvent === 'result' && currentData.length > 1000) {
              console.log('result事件data累积中，当前长度:', currentData.length);
            }
          } else if (line.trim() === '' && currentEvent && currentData !== null) {
            // 处理完整的事件（空行表示事件结束）
            const trimmedData = currentData.trim();
            if (trimmedData) {
              if (currentEvent === 'result') {
                console.log('处理完整result事件，Data length:', trimmedData.length, 'Data preview:', trimmedData.substring(0, 200));
              } else {
                console.log('处理完整事件:', currentEvent, 'Data length:', trimmedData.length);
              }
              processSSELine(currentEvent, trimmedData);
            }
            currentEvent = null;
            currentData = null;
          }
        }
        
        // 如果buffer中还有未处理的事件（没有空行结尾），也尝试处理
        if (currentEvent && currentData !== null && buffer === '') {
          const trimmedData = currentData.trim();
          if (trimmedData) {
            console.log('处理buffer末尾事件:', currentEvent, 'Data length:', trimmedData.length);
            processSSELine(currentEvent, trimmedData);
          }
        }
      }

      // 确保收到结果数据
      console.log('SSE流处理完成，检查结果:', { 
        hasReceivedResult, 
        resultDataExists: !!resultData,
        resultDataType: typeof resultData,
        totalBytesReceived,
        eventCount
      });
      
      if (!resultData && !hasReceivedResult) {
        // 如果没有收到结果，生成一个错误消息
        // 注意：只有在确实没有收到过result事件时才显示错误
        console.error('未收到result事件，resultData为null，可能SSE流提前结束');
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '搜索过程中出现错误，未收到搜索结果。',
          timestamp: new Date()
        };
        // 保存错误消息到发起搜索的对话
        setConversationData(prev => {
          const updated = { ...prev };
          if (!updated[searchConversationId]) {
            updated[searchConversationId] = { messages: [], papers: [] };
          }
          updated[searchConversationId].messages = [
            ...(updated[searchConversationId].messages || []),
            errorMessage
          ];
          updated[searchConversationId].papers = [];
          localStorage.setItem('conversation_data', JSON.stringify(updated));
          return updated;
        });
        // 如果当前对话是发起搜索的对话，更新 UI
        if (currentConversationId === searchConversationId) {
          setMessages(prev => [...prev, errorMessage]);
          setPapers([]);
        }
        return; // 直接返回，不抛出错误，避免进入catch块
      }
      
      // 如果收到了result事件但resultData被重置了（不应该发生，但为了安全）
      if (!resultData && hasReceivedResult) {
        console.warn('收到过result事件但resultData为null，可能是JSON解析失败，尝试使用空结果');
        // 即使解析失败，也尝试使用空结果继续处理
        resultData = {
          total_papers_before_filter: 0,
          total_papers_after_filter: 0,
          papers: [],
          success: false,
          message: '搜索结果解析失败'
        };
      }

      // 调试日志
      console.log('收到搜索结果:', {
        totalBeforeFilter: resultData.total_papers_before_filter,
        totalAfterFilter: resultData.papers?.length,
        papers: resultData.papers,
        success: resultData.success,
        message: resultData.message
      });

      // 使用过滤后的论文
      const papersList = resultData.papers || [];
      console.log('设置论文列表:', papersList.length, '篇');

      // 根据不同的情况生成不同的消息
      let assistantContent = '';
      const totalBeforeFilter = resultData.total_papers_before_filter || 0;
      const totalAfterFilter = papersList.length;

      if (totalBeforeFilter === 0) {
        // 如果没有检索到论文
        assistantContent = '没有找到相关论文。';
      } else if (totalAfterFilter === 0) {
        // 如果检索到但过滤后没有
        assistantContent = '检索结果过滤后没有找到相关的论文。';
      } else {
        // 如果找到了论文
        assistantContent = '以下是我帮你找到的论文：';
      }

      // 确保总是添加助手消息
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };

      // 保存结果到发起搜索的对话（而不是当前对话）
      setConversationData(prev => {
        const updated = { ...prev };
        if (!updated[searchConversationId]) {
          updated[searchConversationId] = { messages: [], papers: [] };
        }
        // 获取当前对话的消息列表（可能已经包含用户消息）
        const currentMessages = updated[searchConversationId].messages || [];
        // 检查是否已经有助手消息（避免重复添加）
        const hasAssistantMessage = currentMessages.some(
          msg => msg.role === 'assistant' && msg.id === assistantMessage.id
        );
        if (!hasAssistantMessage) {
          updated[searchConversationId].messages = [...currentMessages, assistantMessage];
        }
        updated[searchConversationId].papers = papersList;
        localStorage.setItem('conversation_data', JSON.stringify(updated));
        return updated;
      });
      
      // 如果当前对话是发起搜索的对话，更新 UI
      if (currentConversationId === searchConversationId) {
        setMessages(prev => {
          // 检查是否已经包含这条消息（避免重复）
          const hasMessage = prev.some(msg => msg.id === assistantMessage.id);
          if (hasMessage) {
            return prev;
          }
          return [...prev, assistantMessage];
        });
        setPapers(papersList);
      }
      
      // 更新进度为完成（保存到发起搜索的对话数据中）
      const completedProgress = { step: 'completed', status: 'completed' as const, message: '搜索完成' };
      setConversationData(prev => {
        const updated = { ...prev };
        if (!updated[searchConversationId]) {
          updated[searchConversationId] = { messages: [], papers: [] };
        }
        updated[searchConversationId].progress = completedProgress;
        localStorage.setItem('conversation_data', JSON.stringify(updated));
        return updated;
      });
      // 如果当前对话是发起搜索的对话，更新 UI
      if (currentConversationId === searchConversationId) {
        setProgress(completedProgress);
      }
    } catch (error) {
      // 如果是请求被取消（AbortError），不显示错误消息
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('请求被取消');
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('API调用错误:', errorMessage, 'Endpoint:', apiEndpoint || 'unknown');
      
      // 判断是否是超时错误
      let userMessage = "Error: Retrieval grid unresponsive. Please verify your connection to the academic network.";
      if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
        userMessage = "Error: Request timeout. The search is taking longer than expected. Please try again with a simpler query or fewer venues.";
      } else if (errorMessage.includes('未收到搜索结果')) {
        // 如果是因为未收到搜索结果，已经在上面处理了，这里不需要再处理
        return;
      }
      
      // 使用函数开头保存的 searchConversationId（发起搜索时的对话 ID）
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: userMessage,
        timestamp: new Date()
      };
      
      // 更新进度到发起搜索的对话数据中
      const errorProgress = { step: 'error', status: 'error' as const, message: '搜索失败' };
      
      // 保存错误消息和进度到发起搜索的对话
      setConversationData(prev => {
        const updated = { ...prev };
        if (!updated[searchConversationId]) {
          updated[searchConversationId] = { messages: [], papers: [] };
        }
        updated[searchConversationId].messages = [
          ...(updated[searchConversationId].messages || []),
          errorMsg
        ];
        updated[searchConversationId].papers = [];
        updated[searchConversationId].progress = errorProgress;
        localStorage.setItem('conversation_data', JSON.stringify(updated));
        return updated;
      });
      
      // 如果当前对话是发起搜索的对话，更新 UI
      if (currentConversationId === searchConversationId) {
        setMessages(prev => [...prev, errorMsg]);
        setPapers([]);
        setProgress(errorProgress);
      }
    } finally {
      setIsLoading(false);
      // 清除AbortController引用
      if (requestAbortControllerRef.current === abortController) {
        requestAbortControllerRef.current = null;
      }
      // 清除正在搜索的对话标记
      if (searchingConversationIdRef.current === searchConversationId) {
        searchingConversationIdRef.current = null;
      }
      // 2秒后重置进度（仅当当前对话是发起搜索的对话时）
      setTimeout(() => {
        if (currentConversationId === searchConversationId) {
          setProgress({ step: '', status: 'idle' });
        }
        // 更新对话数据中的进度状态
        setConversationData(prev => {
          const updated = { ...prev };
          if (updated[searchConversationId]) {
            updated[searchConversationId].progress = { step: '', status: 'idle' };
            localStorage.setItem('conversation_data', JSON.stringify(updated));
          }
          return updated;
        });
      }, 2000);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-academic-blue-1000 text-academic-blue-700 dark:text-[#e8eaed] overflow-hidden transition-colors duration-300">
      <Sidebar 
        filter={filter} 
        onFilterChange={setFilter}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewConversation={handleNewConversation}
        onSwitchConversation={handleSwitchConversation}
        onClearConversations={handleClearConversations}
        onDeleteConversation={handleDeleteConversation}
      />
      
      <main className="flex-1 flex flex-col h-full relative overflow-hidden border-l border-academic-blue-200 dark:border-[#3c4043]">
        {/* Academic Header - Balanced Height */}
        <header className="h-24 border-b border-academic-blue-200 dark:border-[#3c4043] bg-white/80 dark:bg-academic-blue-1000/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 flex-1 overflow-hidden mr-4 h-full">
            <h1 className="text-sm font-bold tracking-tight text-academic-blue-800 dark:text-white lg:hidden">ScholarPulse</h1>
            <div className="hidden lg:flex items-center gap-4 flex-1 overflow-hidden h-full pt-3 pb-1">
              <div className="flex flex-col flex-1 overflow-hidden h-full justify-end">
                <span className="text-[9px] font-bold text-academic-blue-500 dark:text-[#9aa0a6] uppercase tracking-[0.2em] mb-1.5 shrink-0">Archive Filter</span>
                
                <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
                  {/* Row 1: Time range box - Fixed position */}
                  <div className="flex shrink-0">
                    <span className="px-2 py-0.5 rounded bg-academic-blue-100 dark:bg-academic-blue-900/40 text-academic-blue-800 dark:text-[#8ab4f8] text-[9px] font-extrabold border border-academic-blue-300 dark:border-[#3c4043] uppercase whitespace-nowrap">
                      {filter.startYear} - {filter.endYear}
                    </span>
                  </div>
                  
                  {/* Row 2+: Selected venues - Scrollable if overflow */}
                  <div className="flex flex-wrap gap-1 items-start overflow-y-auto no-scrollbar pb-0 content-start">
                    {filter.venues.length > 0 ? (
                      filter.venues.map(v => (
                        <span key={v} className="px-1.5 py-0.5 rounded bg-academic-blue-50 dark:bg-academic-blue-950/60 text-academic-blue-600 dark:text-[#bdc1c6] text-[9px] font-extrabold border border-academic-blue-200 dark:border-[#3c4043] uppercase whitespace-nowrap">
                          {v.split(' (')[0]}
                        </span>
                      ))
                    ) : (
                      <span className="flex items-center gap-1.5 text-[9px] font-bold text-red-500 dark:text-red-400 animate-pulse py-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Select at least one conference or journal to begin retrieval
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0 h-full">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-academic-blue-50 dark:hover:bg-[#3c4043] transition-colors text-academic-blue-500 dark:text-[#9aa0a6]"
              title="Toggle Appearance"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            {/* 配额显示：匿名用户和 free 用户显示，pro 用户不显示 */}
            {(!user || userPlan === 'free') && (
              <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-academic-blue-300 dark:border-[#3c4043]">
                <span className="text-[9px] font-bold text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-tighter">
                  {!user ? 'Guest' : 'Free'}
                </span>
                {(() => {
                  // 根据用户类型确定最大配额
                  const maxQuota = !user ? MAX_FREE_TRIALS : MAX_FREE_USER_QUOTA;
                  // 如果配额未知，显示最大配额（表示还未使用）
                  const displayQuota = quotaRemaining !== null ? quotaRemaining : maxQuota;
                  
                  return (
                    <>
                <div className="flex gap-1">
                        {[...Array(maxQuota)].map((_, i) => {
                          // 根据剩余配额显示：已使用的（灰色）和剩余的（蓝色）
                          // 已使用次数 = maxQuota - quotaRemaining
                          // 如果 quotaRemaining 为 null，表示还未获取配额信息，全部显示为蓝色（未使用）
                          const isUsed = quotaRemaining !== null 
                            ? i < (maxQuota - quotaRemaining)
                            : false;
                          return (
                            <div 
                              key={i} 
                              className={`h-1.5 w-4 rounded-full shadow-sm transition-colors ${
                                isUsed 
                                  ? 'bg-academic-blue-200 dark:bg-[#3c4043]' 
                                  : 'bg-academic-blue-800 dark:bg-[#8ab4f8]'
                              }`} 
                            />
                          );
                        })}
                </div>
                      <span className="text-[9px] font-bold text-academic-blue-500 dark:text-[#9aa0a6]">
                        {displayQuota}/{maxQuota}
                      </span>
                    </>
                  );
                })()}
                {/* 开发测试：重置配额按钮 */}
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={() => {
                      if (confirm('确定要重置游客配额吗？这将清除当前游客 ID。')) {
                        localStorage.removeItem('anon_id');
                        setQuotaRemaining(null);
                        window.location.reload();
                      }
                    }}
                    className="ml-2 text-[8px] text-academic-blue-400 dark:text-[#9aa0a6] hover:text-academic-blue-600 dark:hover:text-[#bdc1c6] underline"
                    title="重置配额（仅开发模式）"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            <button 
              onClick={user ? undefined : () => setShowRegModal(true)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                user 
                ? 'bg-academic-blue-50 dark:bg-[#3c4043] text-academic-blue-700 dark:text-[#e8eaed]'
                : 'bg-academic-blue-800 text-white dark:bg-[#8ab4f8] dark:text-academic-blue-1000 hover:brightness-110 active:scale-95'
              }`}
            >
              {user ? (user.email || 'Verified Profile') : 'Authenticate'}
            </button>
          </div>
        </header>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 space-y-10">
          <div className="w-full space-y-10">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                <div className={`max-w-3xl flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse ml-auto' : 'mr-auto'}`}>
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${msg.role === 'user' ? 'bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-600 dark:text-[#bdc1c6]' : 'bg-academic-blue-800 dark:bg-[#8ab4f8] text-white dark:text-[#202124]'}`}>
                    {msg.role === 'user' ? 'ME' : 'SP'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-[15px] leading-relaxed font-sans text-academic-blue-700 dark:text-[#e8eaed]">
                      {msg.content}
                    </div>
                    <div className={`text-[9px] font-bold text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-tighter opacity-60 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* 论文列表 - 显示在最后一条助手消息之后 */}
            {papers.length > 0 && (
              <div className="space-y-4 flex justify-start w-full">
                <div className="max-w-3xl mr-auto">
                  <h3 className="text-sm font-bold text-academic-blue-800 dark:text-white uppercase tracking-wider mb-4">Search Results ({papers.length} papers)</h3>
                  <div className="space-y-4">
                    {papers.map((paper, index) => (
                    <div key={index} className="p-5 bg-academic-blue-50 dark:bg-academic-blue-950 border border-academic-blue-200 dark:border-[#3c4043] rounded-xl hover:border-academic-blue-800 dark:hover:border-[#8ab4f8] transition-all">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <a 
                            href={paper.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-base font-semibold text-academic-blue-800 dark:text-[#8ab4f8] hover:text-academic-blue-900 dark:hover:text-[#aecbfa] flex-1 leading-snug"
                          >
                            {paper.title}
                          </a>
                        </div>
                        {paper.abstract && (
                          <div className="text-sm text-academic-blue-600 dark:text-[#bdc1c6] leading-relaxed line-clamp-4">
                            {paper.abstract}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-academic-blue-500 dark:text-[#9aa0a6]">
                          <span className="font-medium">{paper.venue_code}</span>
                          {paper.year && <span>{paper.year}</span>}
                          {paper.venue_type && (
                            <span className="px-2 py-0.5 rounded bg-academic-blue-100 dark:bg-academic-blue-900/40 border border-academic-blue-200 dark:border-[#3c4043]">
                              {paper.venue_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}

            {isLoading && searchingConversationIdRef.current === currentConversationId && (
              <div className="space-y-4">
                <div className="flex justify-start gap-5">
                  <div className="w-8 h-8 rounded-lg bg-academic-blue-50 dark:bg-academic-blue-950 animate-pulse border border-academic-blue-200 dark:border-[#3c4043]" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                        <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                      </div>
                      <span className="text-[11px] font-bold text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-widest">
                        {progress.message || 'Querying Elite Archive...'}
                      </span>
                    </div>
                    
                    {/* 进度条 */}
                    <div className="space-y-2 max-w-md">
                      {/* 根据当前步骤判断已完成步骤 */}
                      {(() => {
                        const currentStep = progress.step;
                        const isStep1Done = ['search', 'abstract', 'filter', 'completed'].includes(currentStep);
                        const isStep2Done = ['abstract', 'filter', 'completed'].includes(currentStep);
                        const isStep3Done = ['filter', 'completed'].includes(currentStep);
                        const isStep4Done = currentStep === 'completed';
                        
                        return (
                          <>
                            {/* 1. 查询改写 */}
                            <div className={`flex items-center gap-2 text-xs ${
                              currentStep === 'query_rewrite' || isStep1Done
                                ? 'text-academic-blue-800 dark:text-[#8ab4f8]' 
                                : 'text-academic-blue-400 dark:text-[#9aa0a6]'
                            }`}>
                              <div className={`w-2 h-2 rounded-full ${
                                currentStep === 'completed' 
                                  ? 'bg-green-500' 
                                  : currentStep === 'query_rewrite'
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse'
                                  : isStep1Done
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8]'
                                  : 'bg-academic-blue-300 dark:bg-[#3c4043]'
                              }`} />
                              <span className="font-medium">1. 查询改写</span>
                            </div>
                            {/* 2. 论文检索 */}
                            <div className={`flex items-center gap-2 text-xs ${
                              currentStep === 'search' || isStep2Done
                                ? 'text-academic-blue-800 dark:text-[#8ab4f8]' 
                                : 'text-academic-blue-400 dark:text-[#9aa0a6]'
                            }`}>
                              <div className={`w-2 h-2 rounded-full ${
                                currentStep === 'completed' 
                                  ? 'bg-green-500' 
                                  : currentStep === 'search'
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse'
                                  : isStep2Done
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8]'
                                  : 'bg-academic-blue-300 dark:bg-[#3c4043]'
                              }`} />
                              <span className="font-medium">2. 论文检索</span>
                            </div>
                            {/* 3. 补充摘要 */}
                            <div className={`flex items-center gap-2 text-xs ${
                              currentStep === 'abstract' || isStep3Done
                                ? 'text-academic-blue-800 dark:text-[#8ab4f8]' 
                                : 'text-academic-blue-400 dark:text-[#9aa0a6]'
                            }`}>
                              <div className={`w-2 h-2 rounded-full ${
                                currentStep === 'completed' 
                                  ? 'bg-green-500' 
                                  : currentStep === 'abstract'
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse'
                                  : isStep3Done
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8]'
                                  : 'bg-academic-blue-300 dark:bg-[#3c4043]'
                              }`} />
                              <span className="font-medium">3. 补充摘要</span>
                            </div>
                            {/* 4. 论文过滤 */}
                            <div className={`flex items-center gap-2 text-xs ${
                              currentStep === 'filter' || isStep4Done
                                ? 'text-academic-blue-800 dark:text-[#8ab4f8]' 
                                : 'text-academic-blue-400 dark:text-[#9aa0a6]'
                            }`}>
                              <div className={`w-2 h-2 rounded-full ${
                                currentStep === 'completed' 
                                  ? 'bg-green-500' 
                                  : currentStep === 'filter'
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse'
                                  : isStep4Done
                                  ? 'bg-academic-blue-800 dark:bg-[#8ab4f8]'
                                  : 'bg-academic-blue-300 dark:bg-[#3c4043]'
                              }`} />
                              <span className="font-medium">4. 论文过滤</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-24" />
          </div>
        </div>

        {/* Input System */}
        <div className="px-6 md:px-12 pb-8 pt-2 bg-gradient-to-t from-white dark:from-academic-blue-1000 via-white dark:via-academic-blue-1000 to-transparent sticky bottom-0 z-20 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative group rounded-2xl border border-academic-blue-300 dark:border-[#3c4043] focus-within:border-academic-blue-800 dark:focus-within:border-[#8ab4f8] transition-colors bg-white dark:bg-academic-blue-950 shadow-lg">
              <div className="relative flex items-center p-1.5">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Query archival research topic..."
                  className="flex-1 bg-transparent border-none py-3.5 px-5 text-academic-blue-700 dark:text-[#e8eaed] focus:ring-0 outline-none transition-all resize-none min-h-[48px] max-h-[160px] text-[15px] placeholder:text-academic-blue-400 dark:placeholder:text-[#9aa0a6] font-sans font-medium"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || filter.venues.length === 0}
                  className={`p-3.5 rounded-xl transition-all self-center shrink-0 ${
                    input.trim() && !isLoading && filter.venues.length > 0
                      ? 'text-academic-blue-800 dark:text-[#8ab4f8] hover:bg-academic-blue-50 dark:hover:bg-[#303134] active:scale-95' 
                      : 'text-academic-blue-200 dark:text-[#3c4043] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center px-2 mt-3">
              <p className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] font-bold uppercase tracking-widest">ScholarPulse Grid Engine • Deep Discovery Mode</p>
              <span className="text-[9px] text-academic-blue-800 dark:text-[#8ab4f8] font-bold uppercase tracking-tighter">Institutional Integrity Verified</span>
            </div>
          </div>
        </div>

        {showRegModal && (
          <RegistrationModal 
            onRegister={handleRegister} 
            onClose={() => setShowRegModal(false)}
          />
        )}

        {confirmDialog && (
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      </main>
    </div>
  );
};

export default App;