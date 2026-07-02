import { ArrowLeft } from 'lucide-react';

interface AdminBackButtonProps {
  label?: string;
  onClick?: () => void;
  href?: string;
}

const className = 'inline-flex items-center rounded-2xl border border-[#385144]/15 bg-white px-4 py-3 text-sm font-black text-[#385144] shadow-[0_12px_28px_rgba(56,81,68,0.12)] transition hover:-translate-y-0.5 hover:border-[#385144]/30 hover:bg-[#EAF1EA]';

export const AdminBackButton = ({ label = 'Назад', onClick, href }: AdminBackButtonProps) => {
  const content = (
    <>
      <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-xl bg-[#385144] text-white">
        <ArrowLeft className="h-4 w-4" />
      </span>
      {label}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
};
