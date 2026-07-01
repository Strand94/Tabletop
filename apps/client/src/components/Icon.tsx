import type { JSX } from 'react';
/** Material Symbols Rounded icon. `name` is the symbol ligature, e.g. "casino". */
export function Icon({
  name,
  size = 20,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <span className={`ms ${className}`} style={{ fontSize: size, ...style }} aria-hidden="true">
      {name}
    </span>
  );
}
