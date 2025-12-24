import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-academic-blue-950 border border-academic-blue-300 dark:border-[#3c4043] rounded-[1.5rem] academic-shadow max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-academic-blue-900 dark:text-[#e8eaed] mb-4">
          {title}
        </h3>
        <p className="text-sm text-academic-blue-600 dark:text-[#bdc1c6] mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-academic-blue-600 dark:text-[#bdc1c6] hover:bg-academic-blue-50 dark:hover:bg-[#3c4043] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-academic-blue-800 dark:bg-[#8ab4f8] text-white dark:text-[#202124] hover:bg-academic-blue-900 dark:hover:bg-[#aecbfa] transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

