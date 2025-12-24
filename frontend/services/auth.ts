/**
 * Supabase Auth 服务封装
 */
import { supabase } from './supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/**
 * 发送邮箱验证码（用于注册或登录）
 */
export async function sendOTP(email: string): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // 如果是新用户，自动创建账户
      },
    });

    return { error };
  } catch (err) {
    return {
      error: err as AuthError,
    };
  }
}

/**
 * 验证 OTP 验证码
 */
export async function verifyOTP(email: string, token: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    return {
      user: data.user,
      session: data.session,
      error,
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
}

/**
 * 注册新用户（带密码和邮箱验证）
 */
export async function signUp(
  email: string, 
  password: string, 
  emailRedirectTo?: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectTo || `${window.location.origin}/auth/callback`,
      },
    });

    return {
      user: data.user,
      session: data.session,
      error,
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
}

/**
 * 更新用户密码（用于 OTP 登录后设置密码）
 */
export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    return { error };
  } catch (err) {
    return {
      error: err as AuthError,
    };
  }
}

/**
 * 登录
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      user: data.user,
      session: data.session,
      error,
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
}

/**
 * 登出
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err) {
    return {
      error: err as AuthError,
    };
  }
}

/**
 * 获取当前 session
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (err) {
    console.error('获取 session 失败:', err);
    return null;
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (err) {
    console.error('获取用户失败:', err);
    return null;
  }
}

/**
 * 监听认证状态变化
 */
export function onAuthStateChange(
  callback: (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED', session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      callback(event, session);
    }
  });
}

/**
 * 获取用户计划（plan）
 */
export async function getUserPlan(userId: string): Promise<'free' | 'pro' | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('获取用户计划失败:', error);
      return null;
    }

    return data?.plan === 'pro' ? 'pro' : 'free';
  } catch (err) {
    console.error('获取用户计划出错:', err);
    return null;
  }
}

