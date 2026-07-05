import type { JSX } from 'react';
import { useEffect, useState } from 'react';

/** Small square preview of a chosen cover: a staged file wins over the saved URL. */
export function CoverPreview({
  imagePath,
  file,
}: {
  imagePath: string;
  file: File | null;
}): JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = objectUrl ?? (imagePath.trim() || null);
  return (
    <div className="h-16 w-16 flex-none overflow-hidden rounded-lg border border-border bg-chip">
      {src && <img src={src} alt="" className="h-full w-full object-contain" />}
    </div>
  );
}
