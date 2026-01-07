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
    console.log('开始注册，邮箱:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectTo || `${window.location.origin}/auth/callback`,
      },
    });

    console.log('注册 API 响应:', {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      hasError: !!error,
      error: error ? { message: error.message, status: error.status } : null
    });

    return {
      user: data?.user || null,
      session: data?.session || null,
      error: error || null,
    };
  } catch (err) {
    console.error('注册异常:', err);
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
}


/**
 * 登录
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    console.log('开始登录，邮箱:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('登录 API 响应:', {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      hasError: !!error,
      error: error ? { message: error.message, status: error.status } : null
    });

    if (error) {
      console.error('登录错误:', error);
      console.error('错误详情:', {
        message: error.message,
        status: error.status,
        name: error.name,
        error: JSON.stringify(error, null, 2)
      });
      
      // 处理各种登录错误，转换为友好的提示
      let errorMessage = error.message || '';
      const lowerErrorMessage = errorMessage.toLowerCase();
      
      // 检查错误代码（Supabase 的错误对象可能包含 code 字段）
      const errorCode = (error as any)?.code || '';
      console.log('错误代码:', errorCode);
      
      // 转换常见的错误消息
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials') ||
          errorCode === 'invalid_credentials' ||
          lowerErrorMessage.includes('email not found') ||
          lowerErrorMessage.includes('user not found')) {
        // 提供更详细的提示，包括可能的原因
        errorMessage = '邮箱或密码错误。如果忘记密码，请使用"忘记密码"功能重置。如果邮箱未验证，请先检查邮箱并点击验证链接。';
      } else if (lowerErrorMessage.includes('email not confirmed') ||
                 lowerErrorMessage.includes('email address is not confirmed') ||
                 errorCode === 'email_not_confirmed') {
        errorMessage = '邮箱尚未验证，请先检查邮箱并点击验证链接。';
      } else if (lowerErrorMessage.includes('too many requests') ||
                 lowerErrorMessage.includes('rate limit')) {
        errorMessage = '登录尝试次数过多，请稍后再试。';
      } else if (lowerErrorMessage.includes('user is banned') ||
                 lowerErrorMessage.includes('user disabled')) {
        errorMessage = '账户已被禁用，请联系管理员。';
      }
      
      return {
        user: data?.user || null,
        session: data?.session || null,
        error: {
          message: errorMessage,
          status: error.status || 400,
        } as AuthError,
      };
    }

    return {
      user: data?.user || null,
      session: data?.session || null,
      error: null,
    };
  } catch (err) {
    console.error('登录异常:', err);
    
    // 处理异常中的错误信息
    let errorMessage = '登录失败，请稍后重试。';
    
    if (err instanceof Error) {
      errorMessage = err.message;
      const lowerErrorMessage = errorMessage.toLowerCase();
      
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials')) {
        errorMessage = '邮箱或密码错误，请检查后重试。';
      }
    } else if (typeof err === 'string') {
      errorMessage = err;
      const lowerErrorMessage = errorMessage.toLowerCase();
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials')) {
        errorMessage = '邮箱或密码错误，请检查后重试。';
      }
    } else if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = String((err as any).message || errorMessage);
      const lowerErrorMessage = errorMessage.toLowerCase();
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials')) {
        errorMessage = '邮箱或密码错误，请检查后重试。';
      }
    }
    
    return {
      user: null,
      session: null,
      error: {
        message: errorMessage,
        status: (err as any)?.status || 500,
      } as AuthError,
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
 * 确保用户的 profile 存在（通过后端 API）
 */
export async function ensureProfile(userId: string, session?: Session | null): Promise<{ success: boolean; created: boolean; message?: string }> {
  try {
    const getApiUrl = () => {
      const envApiUrl = import.meta.env.VITE_API_URL;
      if (envApiUrl && envApiUrl !== 'http://backend:8000' && envApiUrl !== '') {
        return envApiUrl;
      }
      return '';
    };
    const apiUrl = getApiUrl();
    const apiEndpoint = `${apiUrl}/v1/ensure_profile`;
    
    console.log('确保 profile 存在 - API URL:', apiEndpoint);
    console.log('确保 profile 存在 - 用户 ID:', userId);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // 如果有 session，添加 Authorization header
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId }),
    });
    
    console.log('确保 profile 存在 - 响应状态:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('确保 profile 存在 - 响应数据:', data);
      return {
        success: data.success === true,
        created: data.created === true,
        message: data.message
      };
    } else {
      const errorText = await response.text();
      console.error('确保 profile 存在失败:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return {
        success: false,
        created: false,
        message: `确保 profile 失败: ${response.status} ${response.statusText}`
      };
    }
  } catch (err) {
    console.error('确保 profile 存在异常:', err);
    return {
      success: false,
      created: false,
      message: err instanceof Error ? err.message : '网络错误'
    };
  }
}

/**
 * 检查用户是否存在（通过后端 API）
 */
export async function checkUserExists(email: string): Promise<boolean> {
  try {
    const getApiUrl = () => {
      const envApiUrl = import.meta.env.VITE_API_URL;
      if (envApiUrl && envApiUrl !== 'http://backend:8000' && envApiUrl !== '') {
        return envApiUrl;
      }
      return '';
    };
    const apiUrl = getApiUrl();
    const apiEndpoint = `${apiUrl}/v1/check_user`;
    
    console.log('检查用户是否存在 - API URL:', apiEndpoint);
    console.log('检查用户是否存在 - 邮箱:', email);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    console.log('检查用户是否存在 - 响应状态:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('检查用户是否存在 - 响应数据:', data);
      const exists = data.exists === true;
      console.log('检查用户是否存在 - 结果:', exists);
      return exists;
    } else {
      const errorText = await response.text();
      console.error('检查用户是否存在失败:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      // 出错时返回 false，让注册流程继续（注册时会自然失败）
      return false;
    }
  } catch (err) {
    console.error('检查用户是否存在异常:', err);
    // 出错时返回 false，让注册流程继续（注册时会自然失败）
    return false;
  }
}

/**
 * 发送密码重置邮件
 */
export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  try {
    console.log('=== 忘记密码功能：发送密码重置邮件 ===');
    console.log('邮箱:', email);
    
    // 直接调用 Supabase 的 resetPasswordForEmail
    // Supabase 设计上即使邮箱不存在也会返回成功（为了安全，防止邮箱枚举攻击）
    // 所以不需要预先检查用户是否存在
    
    // 获取前端 URL（支持环境变量配置，用于生产环境）
    // 如果配置了 VITE_FRONTEND_URL，使用配置的 URL；否则使用当前页面的 origin
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const redirectUrl = `${frontendUrl}/auth/reset-password`;
    
    console.log('重置密码重定向 URL:', redirectUrl);
    console.log('当前页面 origin:', window.location.origin);
    console.log('环境变量 VITE_FRONTEND_URL:', import.meta.env.VITE_FRONTEND_URL);
    
    const { error, data } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    console.log('resetPasswordForEmail 响应:', { 
      hasError: !!error, 
      hasData: !!data,
      error: error ? {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as any)?.code
      } : null
    });

    if (error) {
      console.error('发送密码重置邮件失败:', error);
      console.error('错误详情:', {
        message: error.message,
        status: error.status,
        name: error.name,
        error: JSON.stringify(error, null, 2)
      });
      
      // 处理各种可能的错误消息
      let errorMessage = error.message || String(error) || '';
      
      // 尝试从错误对象中提取消息（处理不同的错误格式）
      if (!errorMessage && typeof error === 'object') {
        if ('msg' in error) errorMessage = String((error as any).msg);
        else if ('error' in error) errorMessage = String((error as any).error);
        else if ('description' in error) errorMessage = String((error as any).description);
      }
      
      const lowerErrorMessage = errorMessage.toLowerCase();
      console.log('处理后的错误消息:', errorMessage, '小写:', lowerErrorMessage);
      
      // 如果错误信息包含 "Invalid login credentials" 或类似内容，改为更友好的提示
      // 注意：忘记密码场景下不应该提到"密码"，只应该提到"邮箱"
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials') ||
          lowerErrorMessage.includes('user not found') ||
          lowerErrorMessage.includes('email not found')) {
        console.log('检测到需要转换的错误消息，转换为友好提示');
        return {
          error: {
            message: '该邮箱未注册或邮箱地址不正确，请检查邮箱地址。',
            status: error.status || 400,
          } as AuthError,
        };
      } else if (lowerErrorMessage.includes('email address is not confirmed') ||
                 lowerErrorMessage.includes('email not confirmed')) {
        console.log('检测到邮箱未验证错误');
        return {
          error: {
            message: '该邮箱尚未验证。请先检查邮箱并点击验证链接完成验证，然后再使用忘记密码功能。',
            status: error.status || 400,
          } as AuthError,
        };
      }
      
      // 其他错误也返回友好的提示（但保留原始错误信息以便调试）
      // 确保错误信息不包含"密码"字样
      let finalErrorMessage = errorMessage || '发送密码重置邮件失败，请稍后重试。';
      // 如果错误信息中包含"密码"相关字样，替换为更合适的提示
      if (finalErrorMessage.toLowerCase().includes('password') || 
          finalErrorMessage.includes('密码')) {
        finalErrorMessage = '无法发送密码重置邮件。请检查邮箱地址是否正确，或联系管理员。';
      }
      
      return {
        error: {
          message: finalErrorMessage,
          status: error.status || 400,
        } as AuthError,
      };
    } else {
      console.log('密码重置邮件发送成功');
    }

    return { error: null };
  } catch (err) {
    console.error('发送密码重置邮件异常:', err);
    
    // 处理异常中的错误信息
    let errorMessage = '发送密码重置邮件失败，请稍后重试。';
    
    if (err instanceof Error) {
      errorMessage = err.message;
      console.error('异常错误消息:', errorMessage);
      
      // 检查是否是 "Invalid login credentials" 错误
      // 注意：忘记密码场景下不应该提到"密码"，只应该提到"邮箱"
      const lowerErrorMessage = errorMessage.toLowerCase();
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials') ||
          lowerErrorMessage.includes('user not found') ||
          lowerErrorMessage.includes('email not found')) {
        errorMessage = '该邮箱未注册或邮箱地址不正确，请检查邮箱地址。';
      } else if (lowerErrorMessage.includes('email not confirmed') ||
                 lowerErrorMessage.includes('email address is not confirmed')) {
        errorMessage = '该邮箱尚未验证。请先检查邮箱并点击验证链接完成验证，然后再使用忘记密码功能。';
      }
      
      // 确保错误信息不包含"密码"字样
      if (errorMessage.toLowerCase().includes('password') || 
          errorMessage.includes('密码')) {
        errorMessage = '无法发送密码重置邮件。请检查邮箱地址是否正确，或联系管理员。';
      }
    } else if (typeof err === 'string') {
      errorMessage = err;
      const lowerErrorMessage = errorMessage.toLowerCase();
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials')) {
        errorMessage = '该邮箱未注册或邮箱地址不正确，请检查邮箱地址。';
      }
    } else if (err && typeof err === 'object' && 'message' in err) {
      // 处理对象形式的错误
      errorMessage = String((err as any).message || errorMessage);
      const lowerErrorMessage = errorMessage.toLowerCase();
      if (lowerErrorMessage.includes('invalid login credentials') || 
          lowerErrorMessage.includes('invalid credentials')) {
        errorMessage = '该邮箱未注册或邮箱地址不正确，请检查邮箱地址。';
      }
    }
    
    // 确保错误信息不包含"密码"字样
    if (errorMessage.toLowerCase().includes('password') || 
        errorMessage.includes('密码')) {
      errorMessage = '无法发送密码重置邮件。请检查邮箱地址是否正确，或联系管理员。';
    }
    
    return {
      error: {
        message: errorMessage,
        status: (err as any)?.status || 500,
      } as AuthError,
    };
  }
}

/**
 * 更新密码（用于重置密码）
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

