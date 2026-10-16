import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-[#5b4ae8] active:bg-[#4f3fd6]',
  secondary: 'bg-btn text-ink hover:bg-[#5d5f69] active:bg-[#686a75]',
  danger: 'bg-[#d6303a] text-white hover:bg-[#b8252e] active:bg-[#a01f27]',
  ghost: 'bg-transparent text-mute hover:bg-white/10 hover:text-ink active:bg-white/15',
};

export default function Button({ variant = 'secondary', loading = false, size = 'md', className = '', children, disabled, ...rest }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
