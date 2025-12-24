import React, { useState } from 'react';
import { signUp, signIn } from '../services/auth';

interface RegistrationModalProps {
  onRegister: () => void;
  onClose?: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onRegister, onClose }) => {
  const [isLogin, setIsLogin] = useState(true); // true = 登录, false = 注册
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
      if (isLogin) {
        // 登录
        const { user, session, error: authError } = await signIn(email, password);
        if (authError) {
          setError(authError.message || '登录失败，请检查邮箱和密码');
        } else if (user && session) {
          setSuccess('登录成功！');
          setTimeout(() => {
            onRegister();
          }, 500);
        }
      } else {
        // 注册：验证密码
        if (password.length < 6) {
          setError('密码长度至少为6位');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setLoading(false);
          return;
        }

        // 调用 signUp，Supabase 会发送验证邮件
        const { user, session, error: authError } = await signUp(email, password);
        
        if (authError) {
          setError(authError.message || '注册失败，请检查邮箱和密码');
        } else if (user) {
          // 注册成功，Supabase 已发送验证邮件
          // session 通常为 null（因为需要验证邮箱）
          if (session) {
            // 如果直接返回 session，说明邮箱验证已禁用，直接登录成功
            setSuccess('注册成功！');
            setTimeout(() => {
              onRegister();
            }, 500);
          } else {
            // 需要邮箱验证
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
          {isLogin ? 'Institutional Sign-In' : 'Create Account'}
        </h2>
        <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-8 leading-relaxed text-sm font-medium">
          {isLogin 
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
          
          {/* 密码输入 */}
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
          
          {/* 确认密码（仅注册时显示） */}
          {!isLogin && (
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
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>
        
        {/* 切换登录/注册 */}
        <div className="mt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
              setPassword('');
              setConfirmPassword('');
            }}
            className="text-academic-blue-600 dark:text-[#8ab4f8] text-sm font-medium hover:text-academic-blue-800 dark:hover:text-[#aecbfa] transition-colors"
          >
            {isLogin 
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
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
