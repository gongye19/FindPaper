/**
 * 重置密码页面
 * 处理 Supabase 密码重置链接的回跳
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { updatePassword } from '../services/auth';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证重置链接...');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleResetPassword = async () => {
      try {
        // Supabase 密码重置链接可能使用 hash 或 query 参数
        // 先检查 hash（SPA 模式）
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        // 再检查 query（某些情况下）
        const queryParams = new URLSearchParams(window.location.search);
        
        const error = hashParams.get('error') || queryParams.get('error');
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

        if (error) {
          setStatus('error');
          setMessage(errorDescription || error || '重置链接无效或已过期');
          setTimeout(() => {
            navigate('/');
          }, 5000);
          return;
        }

        // Supabase 会自动处理 hash 中的 token，我们只需要获取 session
        // 等待一下让 Supabase 处理完
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 尝试获取 session（如果链接有效，应该会有 session）
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setStatus('error');
          setMessage('重置链接无效或已过期。请重新申请密码重置。');
          setTimeout(() => {
            navigate('/');
          }, 5000);
          return;
        }

        // 链接有效，显示重置密码表单
        setStatus('form');
        setMessage('');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : '验证重置链接时出现错误');
        setTimeout(() => {
          navigate('/');
        }, 5000);
      }
    };

    handleResetPassword();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 验证密码
      if (newPassword.length < 6) {
        setError('密码长度至少为6位');
        setLoading(false);
        return;
      }
      
      // 检查两次输入的密码是否一致
      if (newPassword !== confirmPassword) {
        setError('两次输入的密码不一致，请重新输入');
        setLoading(false);
        return;
      }

      // 更新密码
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) {
        setError(updateError.message || '重置密码失败，请重试');
        setLoading(false);
      } else {
        setStatus('success');
        setMessage('密码重置成功！正在跳转到首页...');
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置密码失败，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-academic-blue-50 dark:bg-academic-blue-1000 p-4">
      <div className="bg-white dark:bg-academic-blue-950 border border-academic-blue-300 dark:border-[#3c4043] rounded-[1.5rem] academic-shadow max-w-md w-full p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8]" />
        
        <div className="w-16 h-16 bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-800 dark:text-[#8ab4f8] rounded-2xl flex items-center justify-center mx-auto mb-8 academic-shadow">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        {status === 'loading' && (
          <>
            <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-2 tracking-tight">
              验证重置链接
            </h2>
            <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-8 leading-relaxed text-sm font-medium">
              {message}
            </p>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-academic-blue-800 dark:border-[#8ab4f8] border-t-transparent rounded-full animate-spin" />
            </div>
          </>
        )}

        {status === 'form' && (
          <>
            <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-2 tracking-tight">
              重置密码
            </h2>
            <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-8 leading-relaxed text-sm font-medium">
              请输入您的新密码
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 新密码输入 */}
              <div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码（至少6位）"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-academic-blue-50 dark:bg-[#3c4043] border border-academic-blue-200 dark:border-[#3c4043] rounded-xl text-academic-blue-900 dark:text-[#e8eaed] placeholder-academic-blue-400 dark:placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-academic-blue-800 dark:focus:ring-[#8ab4f8] transition-all"
                />
              </div>
              
              {/* 确认新密码 */}
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认新密码"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-academic-blue-50 dark:bg-[#3c4043] border border-academic-blue-200 dark:border-[#3c4043] rounded-xl text-academic-blue-900 dark:text-[#e8eaed] placeholder-academic-blue-400 dark:placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-academic-blue-800 dark:focus:ring-[#8ab4f8] transition-all"
                />
              </div>
              
              {/* 错误提示 */}
              {error && (
                <div className="text-red-500 dark:text-red-400 text-sm font-medium bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-lg">
                  {error}
                </div>
              )}
              
              {/* 提交按钮 */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '重置中...' : '重置密码'}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <>
            <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-2 tracking-tight">
              密码重置成功
            </h2>
            <p className="text-green-600 dark:text-green-400 mb-8 leading-relaxed text-sm font-medium">
              {message}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98]"
            >
              返回首页
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-2 tracking-tight">
              重置失败
            </h2>
            <p className="text-red-500 dark:text-red-400 mb-8 leading-relaxed text-sm font-medium">
              {message}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98]"
            >
              返回首页
            </button>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-academic-blue-100 dark:border-[#3c4043]">
          <p className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-[0.4em] font-extrabold">
            ScholarPulse Security Protocol • v2.6.2
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

