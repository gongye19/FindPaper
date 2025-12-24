/**
 * 邮箱验证回调页面
 * 处理 Supabase 邮箱验证链接的回跳
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase 邮箱验证链接可能使用 hash 或 query 参数
        // 先检查 hash（SPA 模式）
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        // 再检查 query（某些情况下）
        const queryParams = new URLSearchParams(window.location.search);
        
        const error = hashParams.get('error') || queryParams.get('error');
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

        if (error) {
          setStatus('error');
          setMessage(errorDescription || error || '验证失败');
          setTimeout(() => {
            navigate('/');
          }, 3000);
          return;
        }

        // Supabase 会自动处理 hash 中的 token，我们只需要获取 session
        // 等待一下让 Supabase 处理完
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 尝试获取 session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setStatus('error');
          setMessage('获取登录状态失败：' + sessionError.message);
          setTimeout(() => {
            navigate('/');
          }, 3000);
          return;
        }

        if (session) {
          // 验证成功，已登录
          setStatus('success');
          setMessage('邮箱验证成功！正在跳转...');
          setTimeout(() => {
            navigate('/');
          }, 1500);
        } else {
          // 验证成功但还没有 session（可能需要在登录页登录）
          setStatus('success');
          setMessage('邮箱验证成功！请返回登录页面登录。');
          setTimeout(() => {
            navigate('/');
          }, 3000);
        }
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : '验证过程中出现错误');
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-academic-blue-50 dark:bg-academic-blue-1000">
      <div className="bg-white dark:bg-academic-blue-950 border border-academic-blue-300 dark:border-[#3c4043] rounded-[1.5rem] academic-shadow max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-800 dark:text-[#8ab4f8] rounded-2xl flex items-center justify-center mx-auto mb-8 academic-shadow">
          {status === 'loading' && (
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {status === 'success' && (
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'error' && (
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-4 tracking-tight">
          {status === 'loading' && '验证中...'}
          {status === 'success' && '验证成功'}
          {status === 'error' && '验证失败'}
        </h2>

        <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-8 leading-relaxed text-sm font-medium">
          {message}
        </p>

        {status === 'success' && (
          <button
            onClick={() => navigate('/')}
            className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98]"
          >
            返回首页
          </button>
        )}

        {status === 'error' && (
          <button
            onClick={() => navigate('/')}
            className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98]"
          >
            返回首页
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;

