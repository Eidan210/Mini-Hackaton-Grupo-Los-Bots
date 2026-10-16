import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-[#7b6dff]',
  secondary: 'bg-btn text-ink hover:bg-[#5a5c65]',
  danger: 'bg-bad text-white hover:bg-[#d93539]',
  ghost: 'bg-transparent text-mute hover:bg-white/5 hover:text-ink',
};

export default function Button({ variant = 'secondary', loading = false, size = 'md', className = '', children, disabled, ...rest }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
