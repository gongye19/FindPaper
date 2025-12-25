/**
 * Supabase 客户端初始化
 */
import { createClient } from '@supabase/supabase-js';

// 从环境变量读取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// 添加调试日志
console.log('Supabase 配置检查:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '未设置',
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 配置缺失！', {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_PROJECT_URL: import.meta.env.VITE_PROJECT_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '已设置' : '未设置',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '已设置' : '未设置'
  });
  console.warn('Auth 功能将不可用，请检查前端 .env 文件配置');
}

// 创建 Supabase 客户端
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

