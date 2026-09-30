'use client';

import { Fragment, useRef, type HTMLAttributes } from 'react';
import { useHoverLift } from './motion';

/**
 * Be mat kinh chuan. Mac dinh KHONG co padding - dung <CardBody> cho phan than.
 * padded=true them p-4 - danh cho cho nao dang viet noi dung truc tiep vao Card
 * ma khong qua CardHeader/CardBody (thay cho kieu cu <Card className="p-5">).
 * Luu y: .card co overflow:hidden (theo mock-up). Card nao chua dropdown/popover
 * (Combobox, ProjectSwitcher, menu sap xep) phai them className="overflow-visible".
 *
 * Q4=(a)/CS-3: hover nhac nhe dung engine spring that (useHoverLift) chu khong
 * con CSS ":hover{transform}" xap xi - xem globals.css:211 (chi con box-shadow
 * o CSS, transform do JS ghi rieng de 2 co che khong de/giang co nhau).
 */
export function Card({
  className = '',
  padded = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useHoverLift(ref);
  return <div ref={ref} className={`card card-hover ${padded ? 'p-4' : ''} ${className}`} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  titleExtra,
  action,
}: {
  title: string;
  subtitle?: string;
  titleExtra?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="hd">
      <h3>
        {title}
        {subtitle && <span className="en">{subtitle}</span>}
        {titleExtra != null && <Fragment key="titleExtra">{titleExtra}</Fragment>}
      </h3>
      {/* Fragment co key (ca titleExtra o tren): de tran thi trang Chi tiet bi React dev bao "unique key" (e2e/38 C-4); khong doi DOM. */}
      {action != null && <Fragment key="action">{action}</Fragment>}
    </div>
  );
}

export function CardBody({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bd ${className}`} {...props} />;
}
