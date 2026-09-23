import type { HTMLAttributes } from 'react';

/**
 * Be mat kinh chuan. Mac dinh KHONG co padding - dung <CardBody> cho phan than.
 * padded=true them p-4 - danh cho cho nao dang viet noi dung truc tiep vao Card
 * ma khong qua CardHeader/CardBody (thay cho kieu cu <Card className="p-5">).
 * Luu y: .card co overflow:hidden (theo mock-up). Card nao chua dropdown/popover
 * (Combobox, ProjectSwitcher, menu sap xep) phai them className="overflow-visible".
 */
export function Card({
  className = '',
  padded = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={`card card-hover ${padded ? 'p-4' : ''} ${className}`} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="hd">
      <h3>
        {title}
        {subtitle && <span className="en">{subtitle}</span>}
      </h3>
      {action}
    </div>
  );
}

export function CardBody({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bd ${className}`} {...props} />;
}
