import React, { useState } from 'react';
import { signUp, signIn, checkUserExists, resetPassword } from '../services/auth';

interface RegistrationModalProps {
  onRegister: () => void;
  onClose?: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onRegister, onClose }) => {
  const [isLogin, setIsLogin] = useState(true); // true = 登录, false = 注册
  const [showForgotPassword, setShowForgotPassword] = useState(false); // 显示忘记密码
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // 优先检查忘记密码模式（因为 showForgotPassword 的优先级应该高于 isLogin）
      if (showForgotPassword) {
        // 忘记密码：发送重置邮件
        console.log('=== 忘记密码流程开始 ===');
        if (!email) {
          setError('请输入邮箱地址');
          setLoading(false);
          return;
        }
        
        console.log('调用 resetPassword 函数，邮箱:', email);
        const { error: resetError } = await resetPassword(email);
        console.log('resetPassword 返回结果:', { hasError: !!resetError, error: resetError });
        
        if (resetError) {
          console.error('忘记密码失败，设置错误信息:', resetError.message);
          // 确保使用 resetPassword 返回的错误信息，而不是之前的登录错误信息
          setError(resetError.message || '发送重置邮件失败，请检查邮箱地址');
        } else {
          console.log('忘记密码成功');
          setSuccess(`密码重置邮件已发送到 ${email}，请检查收件箱（包括垃圾邮件文件夹）并点击链接重置密码。`);
        }
      } else if (isLogin) {
        // 登录（只有在非忘记密码模式下才执行）
        console.log('=== 登录流程开始 ===');
        const { user, session, error: authError } = await signIn(email, password);
        if (authError) {
          console.error('登录失败:', authError);
          setError(authError.message || '登录失败，请检查邮箱和密码');
        } else if (user && session) {
          setSuccess('登录成功！');
          setTimeout(() => {
            onRegister();
          }, 500);
        } else {
          // 如果没有错误但也没有用户/会话，可能是配置问题
          console.warn('登录响应异常: 没有错误但也没有用户/会话', { user, session });
          setError('登录失败：无法获取用户信息。请检查 Supabase 配置或联系管理员。');
        }
      } else {
        // 注册：验证密码
        if (password.length < 6) {
          setError('密码长度至少为6位');
          setLoading(false);
          return;
        }
        // 检查两次输入的密码是否一致
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致，请重新输入');
          setLoading(false);
          return;
        }

        // 先检查用户是否已存在
        console.log('检查用户是否存在:', email);
        const userExists = await checkUserExists(email);
        if (userExists) {
          console.log('用户已存在，阻止注册');
          setError('该邮箱已被注册，请直接登录。如果忘记密码，可以使用"忘记密码"功能重置。');
          setLoading(false);
          // 自动切换到登录模式
          setTimeout(() => {
            setIsLogin(true);
            setError(null);
          }, 2000);
          return;
        }

        // 用户不存在，可以注册
        console.log('用户不存在，开始注册');
        // 调用 signUp，Supabase 会发送验证邮件
        const { user, session, error: authError } = await signUp(email, password);
        
        // 添加调试日志
        console.log('注册响应:', { user, session, error: authError });
        
        // 优先检查错误
        if (authError) {
          console.error('注册错误:', authError);
          setError(authError.message || `注册失败: ${authError.status || '未知错误'}`);
        } else if (!user) {
          // 如果没有错误但也没有用户，可能是配置问题
          console.error('注册失败: 没有返回用户信息');
          setError('注册失败：无法连接到认证服务。请检查 Supabase 配置。');
        } else {
          // 注册后再次检查用户是否已存在（作为备用检查）
          // Supabase 的 signUp 在用户已存在时不会返回错误，而是返回已存在的用户
          // 我们可以通过检查用户创建时间来判断是否是刚创建的用户
          const userCreatedAt = user.created_at ? new Date(user.created_at).getTime() : 0;
          const now = Date.now();
          const timeDiff = now - userCreatedAt;
          
          // 如果用户创建时间超过 5 秒，可能是已存在的用户（新用户创建时间应该很近）
          // 但也要考虑网络延迟，所以设置一个合理的阈值（30秒）
          if (timeDiff > 30000 && user.email_confirmed_at) {
            // 用户已存在且邮箱已验证
            console.log('检测到用户已存在（通过创建时间判断）');
            setError('该邮箱已被注册，请直接登录。如果忘记密码，可以使用"忘记密码"功能重置。');
            setTimeout(() => {
              setIsLogin(true);
              setError(null);
            }, 2000);
            setLoading(false);
            return;
          }
          
          // 注册成功，Supabase 已发送验证邮件
          // session 通常为 null（因为需要验证邮箱）
          if (session) {
            // 如果直接返回 session，说明邮箱验证已禁用，直接登录成功
            console.log('注册成功，直接登录');
            setSuccess('注册成功！');
            setTimeout(() => {
              onRegister();
            }, 500);
          } else {
            // 需要邮箱验证
            console.log('注册成功，需要邮箱验证');
            setSuccess(`注册成功！我们已发送验证邮件到 ${email}，请点击邮件中的链接完成注册。`);
            // 不自动关闭，让用户看到提示
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-academic-blue-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-academic-blue-950 border border-academic-blue-300 dark:border-[#3c4043] rounded-[1.5rem] academic-shadow max-w-md w-full p-10 animate-in zoom-in-95 duration-400 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8]" />
        
        {/* 关闭按钮 */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-academic-blue-400 dark:text-[#9aa0a6] hover:text-academic-blue-600 dark:hover:text-[#bdc1c6] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <div className="w-16 h-16 bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-800 dark:text-[#8ab4f8] rounded-2xl flex items-center justify-center mx-auto mb-8 academic-shadow">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-2 tracking-tight">
          {showForgotPassword 
            ? 'Reset Password' 
            : isLogin 
            ? 'Institutional Sign-In' 
            : 'Create Account'}
        </h2>
        <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-8 leading-relaxed text-sm font-medium">
          {showForgotPassword
            ? 'Enter your email address and we will send you a link to reset your password.'
            : isLogin 
            ? 'Sign in to access 50 free searches. Subscribe for unlimited access.'
            : 'Register to get 50 free searches. Subscribe later for unlimited access.'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱输入 */}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-4 py-3 bg-academic-blue-50 dark:bg-[#3c4043] border border-academic-blue-200 dark:border-[#3c4043] rounded-xl text-academic-blue-900 dark:text-[#e8eaed] placeholder-academic-blue-400 dark:placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-academic-blue-800 dark:focus:ring-[#8ab4f8] transition-all"
            />
          </div>
          
          {/* 密码输入（登录和注册时显示，忘记密码时不显示） */}
          {!showForgotPassword && (
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-academic-blue-50 dark:bg-[#3c4043] border border-academic-blue-200 dark:border-[#3c4043] rounded-xl text-academic-blue-900 dark:text-[#e8eaed] placeholder-academic-blue-400 dark:placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-academic-blue-800 dark:focus:ring-[#8ab4f8] transition-all"
              />
            </div>
          )}
          
          {/* 确认密码（仅注册时显示） */}
          {!isLogin && !showForgotPassword && (
            <div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-academic-blue-50 dark:bg-[#3c4043] border border-academic-blue-200 dark:border-[#3c4043] rounded-xl text-academic-blue-900 dark:text-[#e8eaed] placeholder-academic-blue-400 dark:placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-academic-blue-800 dark:focus:ring-[#8ab4f8] transition-all"
              />
            </div>
          )}
          
          {/* 错误提示 */}
          {error && (
            <div className="text-red-500 dark:text-red-400 text-sm font-medium bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
          
          {/* 成功提示 */}
          {success && (
            <div className="text-green-600 dark:text-green-400 text-sm font-medium bg-green-50 dark:bg-green-950/30 px-4 py-2 rounded-lg">
              {success}
            </div>
          )}
          
          {/* 提交按钮 */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? 'Processing...' 
              : showForgotPassword 
              ? 'Send Reset Link' 
              : isLogin 
              ? 'Sign In' 
              : 'Create Account'}
          </button>
        </form>
        
        {/* 忘记密码链接（仅登录时显示） */}
        {isLogin && !showForgotPassword && (
          <div className="mt-4">
            <button
              onClick={() => {
                console.log('切换到忘记密码模式，清除之前的错误信息');
                setError(null);  // 先清除错误
                setSuccess(null);  // 先清除成功信息
                setPassword('');  // 清除密码
                setShowForgotPassword(true);  // 最后切换模式
              }}
              className="text-academic-blue-600 dark:text-[#8ab4f8] text-sm font-medium hover:text-academic-blue-800 dark:hover:text-[#aecbfa] transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )}
        
        {/* 切换登录/注册/返回登录 */}
        <div className="mt-6">
          {showForgotPassword ? (
            <button
              onClick={() => {
                console.log('返回登录模式，清除错误信息');
                setError(null);  // 先清除错误
                setSuccess(null);  // 先清除成功信息
                setShowForgotPassword(false);  // 最后切换模式
              }}
              className="text-academic-blue-600 dark:text-[#8ab4f8] text-sm font-medium hover:text-academic-blue-800 dark:hover:text-[#aecbfa] transition-colors"
            >
              Back to Sign In
            </button>
          ) : (
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccess(null);
                setPassword('');
                setConfirmPassword('');
                setShowForgotPassword(false);
              }}
              className="text-academic-blue-600 dark:text-[#8ab4f8] text-sm font-medium hover:text-academic-blue-800 dark:hover:text-[#aecbfa] transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          )}
        </div>
        
        <div className="mt-8 pt-6 border-t border-academic-blue-100 dark:border-[#3c4043]">
          <p className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-[0.4em] font-extrabold">
            ScholarPulse Security Protocol • v2.6.2
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;
