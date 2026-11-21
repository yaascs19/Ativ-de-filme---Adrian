export function BrandMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="64" height="64" rx="16" fill="#0F172A" />
      <circle cx="32" cy="32" r="22" fill="var(--cr-accent, #E11D48)" />
      <circle cx="32" cy="15" r="2.2" fill="#0F172A" opacity="0.45" />
      <circle cx="32" cy="49" r="2.2" fill="#0F172A" opacity="0.45" />
      <circle cx="15" cy="32" r="2.2" fill="#0F172A" opacity="0.45" />
      <circle cx="49" cy="32" r="2.2" fill="#0F172A" opacity="0.45" />
      <path d="M27 22.5L43.5 32L27 41.5V22.5Z" fill="#FFFFFF" />
    </svg>
  );
}
