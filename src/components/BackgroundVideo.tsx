import { useEffect, useState, type Ref } from 'react';
import asset from '@/assets/vulture-video.asset.json';
export default function BackgroundVideo({ videoRef }: { videoRef?: Ref<HTMLVideoElement> }) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [source, setSource] = useState(asset.url);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  if (reducedMotion) return null;
  return <video ref={videoRef} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" src={source} onError={() => { if (source !== '/video.mp4') setSource('/video.mp4'); }} />;
}
