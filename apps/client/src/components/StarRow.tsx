import { Icon } from './Icon.js';

/** Five stars representing a 0–10 value (each star = 2 points), with half stars. */
export function StarRow({ value, size = 15 }: { value: number; size?: number }): JSX.Element {
  const outOfFive = value / 2;
  return (
    <div className="flex gap-px" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = outOfFive - i;
        const name = fill >= 1 ? 'star' : fill >= 0.5 ? 'star_half' : 'star';
        const color = fill >= 0.5 ? 'text-star' : 'text-track';
        return <Icon key={i} name={name} size={size} className={color} />;
      })}
    </div>
  );
}
