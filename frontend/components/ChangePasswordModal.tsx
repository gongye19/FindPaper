import React, { useState } from 'react';
import { updatePassword } from '../services/auth';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
      // 验证新密码
      if (newPassword.length < 6) {
        setError('新密码长度至少为6位');
        setLoading(false);
        return;
      }
      
      // 检查两次输入的密码是否一致
      if (newPassword !== confirmPassword) {
        setError('两次输入的新密码不一致，请重新输入');
        setLoading(false);
        return;
      }

      // 更新密码
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) {
        setError(updateError.message || '修改密码失败，请重试');
      } else {
        setSuccess('密码修改成功！');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-academic-blue-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-academic-blue-950 border border-academic-blue-300 dark:border-[#3c4043] rounded-[1.5rem] academic-shadow max-w-md w-full p-10 animate-in zoom-in-95 duration-400 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8]" />
        
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-academic-blue-400 dark:text-[#9aa0a6] hover:text-academic-blue-600 dark:hover:text-[#bdc1c6] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="w-16 h-16 bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-800 dark:text-[#8ab4f8] rounded-2xl flex items-center justify-center mx-auto mb-8 academic-shadow">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-2 tracking-tight">
          Change Password
        </h2>
        <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-8 leading-relaxed text-sm font-medium">
          Enter your new password. Make sure it's at least 6 characters long.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 新密码输入 */}
          <div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
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
              placeholder="Confirm new password"
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
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-academic-blue-100 dark:border-[#3c4043]">
          <p className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-[0.4em] font-extrabold">
            ScholarPulse Security Protocol • v2.6.2
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;

