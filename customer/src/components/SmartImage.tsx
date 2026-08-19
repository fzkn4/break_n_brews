import { useEffect, useState } from 'react';
import { FALLBACK_IMAGE } from '../lib/catalog';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
}

/** Stock photo URLs rot and admins paste broken links; either way the card should still look right. */
export default function SmartImage({ src, alt, className }: SmartImageProps) {
  const [source, setSource] = useState(src);

  useEffect(() => setSource(src), [src]);

  return (
    <img
      className={className}
      src={source}
      alt={alt}
      loading="lazy"
      onError={() => setSource((current) => (current === FALLBACK_IMAGE ? current : FALLBACK_IMAGE))}
    />
  );
}
