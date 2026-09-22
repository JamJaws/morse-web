import type { ComponentProps } from 'react';

const variants = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-stroke bg-surface text-ink hover:bg-raised',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
};
type ButtonProps = ComponentProps<'button'> & {
  variant?: keyof typeof variants;
  size?: 'normal' | 'icon';
};

export function Button({
  variant = 'secondary',
  size = 'normal',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${size === 'icon' ? 'w-11' : 'px-4 py-2'} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  label,
  ...props
}: Omit<ButtonProps, 'size'> & { label: string }) {
  return <Button {...props} size="icon" aria-label={label} title={label} />;
}
