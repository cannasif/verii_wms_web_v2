import type { ComponentProps, ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

export type WmsIconData = ComponentProps<typeof HugeiconsIcon>['icon'];

interface WmsIconProps {
  icon: WmsIconData;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function WmsIcon({ icon, size = 20, strokeWidth = 1.75, className }: WmsIconProps): ReactElement {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} className={cn('shrink-0', className)} aria-hidden />;
}
