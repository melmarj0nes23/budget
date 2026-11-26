import { FC, ReactNode } from 'react';
import Eyebrow from './Eyebrow';
import { cn } from '../../../lib/utils';

type Props = {
  tag: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  role?: 'status' | 'note';
  className?: string;
};

const Notice: FC<Props> = ({
  tag,
  title,
  children,
  role = 'note',
  className,
}) => (
  <div
    role={role}
    className={cn(
      'border-l-4 border-ed-navy bg-ed-paper-2 p-6 max-md:p-5',
      className
    )}
  >
    <Eyebrow tone='navy'>{tag}</Eyebrow>
    <p className='mt-2 font-serif-ed text-[22px] font-semibold leading-snug text-ed-ink max-md:text-lg'>
      {title}
    </p>
    {children}
  </div>
);

export default Notice;
