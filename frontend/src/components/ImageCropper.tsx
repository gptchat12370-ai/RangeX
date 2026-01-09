import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: Blob) => void;
  imageFile: File | null;
  aspectRatio?: number; // 1 for square (profile pictures)
  title?: string;
}

export function ImageCropper({
  open,
  onClose,
  onCropComplete,
  imageFile,
  aspectRatio = 1,
  title = 'Crop Image'
}: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      };
      reader.onerror = () => {
        console.error('Failed to read image file');
      };
      reader.readAsDataURL(imageFile);
    }

    // Cleanup function
    return () => {
      if (imageSrc && imageSrc.startsWith('data:')) {
        // Data URLs don't need cleanup, but reset state
        setImageSrc('');
      }
    };
  }, [imageFile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const getCroppedImage = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      
      if (!canvas || !image) {
        reject(new Error('Canvas or image not found'));
        return;
      }

      // Wait for image to load if not already loaded
      if (!image.complete || image.naturalWidth === 0) {
        image.onload = () => processImage();
        image.onerror = () => reject(new Error('Failed to load image'));
        return;
      }

      processImage();

      function processImage() {
        const ctx = canvas.getContext('2d');
        if (!ctx || !image) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas size (square for profile pictures)
        const size = 400;
        canvas.width = size;
        canvas.height = size;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Fill with white background (prevents black)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Calculate dimensions
        const imgWidth = image.naturalWidth || image.width;
        const imgHeight = image.naturalHeight || image.height;
        
        // Calculate scale to fit the image in the preview area initially
        const scale = zoom;
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;

        // Save context state
        ctx.save();

        // Move to center
        ctx.translate(size / 2, size / 2);
        
        // Apply rotation
        ctx.rotate((rotation * Math.PI) / 180);

        // Draw image centered with position offset (accounting for the 400x400 preview area scale)
        const offsetX = position.x * (size / 400);
        const offsetY = position.y * (size / 400);
        
        ctx.drawImage(
          image,
          -scaledWidth / 2 + offsetX,
          -scaledHeight / 2 + offsetY,
          scaledWidth,
          scaledHeight
        );

        // Restore context state
        ctx.restore();

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.95);
      }
    });
  }, [zoom, rotation, position]);

  const handleSave = async () => {
    try {
      const croppedBlob = await getCroppedImage();
      onCropComplete(croppedBlob);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Area */}
          <div className="relative bg-muted rounded-lg overflow-hidden" style={{ height: '400px' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Circle mask overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at center, transparent 150px, rgba(0,0,0,0.5) 150px)'
                }}
              />
              
              {/* Draggable image */}
              {imageSrc && (
                <div
                  className="relative cursor-move select-none"
                  style={{
                    width: '400px',
                    height: '400px',
                    overflow: 'hidden'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="Preview"
                    crossOrigin="anonymous"
                    className="absolute"
                    style={{
                      transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin: 'center',
                      maxWidth: 'none',
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                      left: '50%',
                      top: '50%',
                    }}
                    draggable={false}
                  />
                </div>
              )}

              {/* Circle preview indicator */}
              <div 
                className="absolute border-4 border-primary rounded-full pointer-events-none"
                style={{
                  width: '300px',
                  height: '300px'
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="flex items-center gap-4">
              <ZoomOut className="h-4 w-4" />
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={0.5}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4" />
              <span className="text-sm text-muted-foreground w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Rotate Button */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRotate}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Rotate 90°
              </Button>
              <span className="text-sm text-muted-foreground">
                {rotation}°
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Drag the image to reposition • Use slider to zoom • The circle shows your final result
          </p>
        </div>

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
