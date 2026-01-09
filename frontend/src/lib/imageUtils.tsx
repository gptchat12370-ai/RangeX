import { List, Calendar, Crown } from "lucide-react";

/**
 * Fallback images for when cover images are missing or broken
 */
export const FallbackImages = {
  playlist: (className?: string) => (
    <div className={`bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center ${className || 'h-48'}`}>
      <List className="h-16 w-16 text-purple-400/50" />
    </div>
  ),
  event: (className?: string) => (
    <div className={`bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center ${className || 'h-48'}`}>
      <Calendar className="h-16 w-16 text-cyan-400/50" />
    </div>
  ),
  careerPath: (className?: string) => (
    <div className={`bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center ${className || 'h-40'}`}>
      <Crown className="h-16 w-16 text-yellow-400/50" />
    </div>
  ),
  scenario: (className?: string) => (
    <div className={`bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center ${className || 'h-48'}`}>
      <div className="text-4xl text-blue-400/50">🎯</div>
    </div>
  ),
};

/**
 * Image component with automatic fallback
 */
interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackType: 'playlist' | 'event' | 'careerPath' | 'scenario';
  fallbackClassName?: string;
}

export function SafeImage({ src, alt, className, fallbackType, fallbackClassName }: SafeImageProps) {
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  if (!src || hasError) {
    return FallbackImages[fallbackType](fallbackClassName);
  }

  return (
    <>
      {isLoading && FallbackImages[fallbackType](fallbackClassName)}
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        style={{ display: isLoading ? 'none' : 'block' }}
      />
    </>
  );
}

// Missing React import
import React from 'react';
