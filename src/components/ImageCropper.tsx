'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Move, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { logger } from '@/utils/logger';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedImage: string) => void;
  onCancel: () => void;
  aspectRatio?: number; // width/height
}

export function ImageCropper({ imageSrc, onCrop, onCancel, aspectRatio }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setImageLoaded(true);
      
      // Aguardar um pouco para garantir que o container está renderizado
      setTimeout(() => {
        const container = containerRef.current;
        if (container && imageRef.current) {
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const imgAspect = img.width / img.height;
          
          // Calcular tamanho de exibição inicial (80% do container)
          let displayWidth = containerWidth * 0.8;
          let displayHeight = displayWidth / imgAspect;
          
          if (displayHeight > containerHeight * 0.8) {
            displayHeight = containerHeight * 0.8;
            displayWidth = displayHeight * imgAspect;
          }
          
          // Definir dimensões da imagem
          if (imageRef.current) {
            imageRef.current.style.width = `${displayWidth}px`;
            imageRef.current.style.height = `${displayHeight}px`;
          }
          
          // Calcular área de crop inicial
          const cropSize = Math.min(displayWidth, displayHeight) * 0.6;
          const cropWidth = aspectRatio ? cropSize : cropSize;
          const cropHeight = aspectRatio ? cropSize / aspectRatio : cropSize;
          
          setCropArea({
            x: (containerWidth - cropWidth) / 2,
            y: (containerHeight - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
          });
          
          setPosition({
            x: (containerWidth - displayWidth) / 2,
            y: (containerHeight - displayHeight) / 2
          });
        }
      }, 100);
    };
    img.onerror = () => {
      logger.error('Erro ao carregar imagem');
    };
    img.src = imageSrc;
  }, [imageSrc, aspectRatio]);

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
    
    // Redimensionar área de crop
    if (isResizing && containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      let newCropArea = { ...cropArea };
      
      if (isResizing.includes('e')) {
        // Lado direito
        newCropArea.width = Math.max(50, Math.min(resizeStart.cropWidth + deltaX, rect.width - resizeStart.cropX));
        if (aspectRatio) {
          newCropArea.height = newCropArea.width / aspectRatio;
        }
      }
      if (isResizing.includes('w')) {
        // Lado esquerdo
        const newWidth = Math.max(50, Math.min(resizeStart.cropWidth - deltaX, resizeStart.cropX + resizeStart.cropWidth));
        const newX = resizeStart.cropX + resizeStart.cropWidth - newWidth;
        newCropArea.x = Math.max(0, newX);
        newCropArea.width = newWidth;
        if (aspectRatio) {
          newCropArea.height = newCropArea.width / aspectRatio;
          newCropArea.y = resizeStart.cropY + resizeStart.cropHeight - newCropArea.height;
        }
      }
      if (isResizing.includes('s')) {
        // Lado inferior
        newCropArea.height = Math.max(50, Math.min(resizeStart.cropHeight + deltaY, rect.height - resizeStart.cropY));
        if (aspectRatio) {
          newCropArea.width = newCropArea.height * aspectRatio;
        }
      }
      if (isResizing.includes('n')) {
        // Lado superior
        const newHeight = Math.max(50, Math.min(resizeStart.cropHeight - deltaY, resizeStart.cropY + resizeStart.cropHeight));
        const newY = resizeStart.cropY + resizeStart.cropHeight - newHeight;
        newCropArea.y = Math.max(0, newY);
        newCropArea.height = newHeight;
        if (aspectRatio) {
          newCropArea.width = newCropArea.height * aspectRatio;
          newCropArea.x = resizeStart.cropX + resizeStart.cropWidth - newCropArea.width;
        }
      }
      
      // Garantir que não ultrapasse os limites do container
      if (newCropArea.x + newCropArea.width > rect.width) {
        newCropArea.width = rect.width - newCropArea.x;
        if (aspectRatio) {
          newCropArea.height = newCropArea.width / aspectRatio;
        }
      }
      if (newCropArea.y + newCropArea.height > rect.height) {
        newCropArea.height = rect.height - newCropArea.y;
        if (aspectRatio) {
          newCropArea.width = newCropArea.height * aspectRatio;
        }
      }
      
      setCropArea(newCropArea);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(null);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleCrop = () => {
    const img = imageRef.current;
    if (!img || !imageLoaded) return;

    const container = containerRef.current;
    if (!container) return;

    // Obter dimensões reais da imagem exibida
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calcular posição relativa da imagem no container
    const imgX = imgRect.left - containerRect.left;
    const imgY = imgRect.top - containerRect.top;
    const imgDisplayWidth = imgRect.width;
    const imgDisplayHeight = imgRect.height;

    // Calcular a área de crop relativa à imagem exibida
    const cropXRelative = (cropArea.x - imgX) / imgDisplayWidth;
    const cropYRelative = (cropArea.y - imgY) / imgDisplayHeight;
    const cropWidthRelative = cropArea.width / imgDisplayWidth;
    const cropHeightRelative = cropArea.height / imgDisplayHeight;

    // Garantir que os valores estão dentro dos limites
    const sourceX = Math.max(0, Math.min(cropXRelative * imageDimensions.width, imageDimensions.width));
    const sourceY = Math.max(0, Math.min(cropYRelative * imageDimensions.height, imageDimensions.height));
    const sourceWidth = Math.max(1, Math.min(cropWidthRelative * imageDimensions.width, imageDimensions.width - sourceX));
    const sourceHeight = Math.max(1, Math.min(cropHeightRelative * imageDimensions.height, imageDimensions.height - sourceY));

    // Criar novo canvas para a imagem recortada
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropArea.width;
    croppedCanvas.height = cropArea.height;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    if (croppedCtx) {
      // Desenhar a parte recortada da imagem
      croppedCtx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        cropArea.width,
        cropArea.height
      );
      
      const croppedImage = croppedCanvas.toDataURL('image/png');
      onCrop(croppedImage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
      <div className="bg-black border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-200">Recortar Imagem</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-hidden min-h-[400px]">
          <div
            ref={containerRef}
            className="relative w-full h-full min-h-[400px] bg-black rounded overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageLoaded && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Preview"
                className="absolute top-0 left-0"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transformOrigin: 'top left'
                }}
                onMouseDown={handleMouseDown}
                draggable={false}
              />
            )}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-400">Carregando imagem...</div>
              </div>
            )}

            {/* Área de crop */}
            {cropArea.width > 0 && cropArea.height > 0 && (
              <>
                {/* Overlay escuro ao redor da área de crop */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.7) ${(cropArea.x / (containerRef.current?.clientWidth || 1)) * 100}%, transparent ${(cropArea.x / (containerRef.current?.clientWidth || 1)) * 100}%, transparent ${((cropArea.x + cropArea.width) / (containerRef.current?.clientWidth || 1)) * 100}%, rgba(0,0,0,0.7) ${((cropArea.x + cropArea.width) / (containerRef.current?.clientWidth || 1)) * 100}%)`,
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: `${(cropArea.y / (containerRef.current?.clientHeight || 1)) * 100}%`,
                    background: 'rgba(0,0,0,0.7)',
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 0,
                    bottom: 0,
                    width: '100%',
                    height: `${((containerRef.current?.clientHeight || 1) - cropArea.y - cropArea.height) / (containerRef.current?.clientHeight || 1) * 100}%`,
                    background: 'rgba(0,0,0,0.7)',
                  }}
                />

                {/* Área de crop principal */}
                <div
                  className="absolute border-2 border-blue-500 bg-transparent"
                  style={{
                    left: `${cropArea.x}px`,
                    top: `${cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                    cursor: 'move',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('crop-handle')) {
                      return; // Não mover se clicar nos handles
                    }
                    e.stopPropagation();
                    const startX = e.clientX - cropArea.x;
                    const startY = e.clientY - cropArea.y;
                    const handleMove = (moveEvent: MouseEvent) => {
                      const container = containerRef.current;
                      if (container) {
                        const rect = container.getBoundingClientRect();
                        setCropArea({
                          ...cropArea,
                          x: Math.max(0, Math.min(moveEvent.clientX - rect.left - startX, rect.width - cropArea.width)),
                          y: Math.max(0, Math.min(moveEvent.clientY - rect.top - startY, rect.height - cropArea.height))
                        });
                      }
                    };
                    const handleUp = () => {
                      document.removeEventListener('mousemove', handleMove);
                      document.removeEventListener('mouseup', handleUp);
                    };
                    document.addEventListener('mousemove', handleMove);
                    document.addEventListener('mouseup', handleUp);
                  }}
                >
                  {/* Grid interno */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-blue-400/30" />
                      ))}
                    </div>
                  </div>

                  {/* Handles de redimensionamento */}
                  {/* Canto superior esquerdo */}
                  <div
                    className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize crop-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('nw');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Canto superior direito */}
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize crop-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('ne');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Canto inferior esquerdo */}
                  <div
                    className="absolute -bottom-1 -left-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize crop-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('sw');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Canto inferior direito */}
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize crop-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('se');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Lado esquerdo */}
                  <div
                    className="absolute -left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded cursor-ew-resize crop-handle"
                    style={{ marginTop: '-8px' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('w');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Lado direito */}
                  <div
                    className="absolute -right-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded cursor-ew-resize crop-handle"
                    style={{ marginTop: '-8px' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('e');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Lado superior */}
                  <div
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded cursor-ns-resize crop-handle"
                    style={{ marginLeft: '-8px' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('n');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />
                  {/* Lado inferior */}
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded cursor-ns-resize crop-handle"
                    style={{ marginLeft: '-8px' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsResizing('s');
                      setResizeStart({
                        x: e.clientX,
                        y: e.clientY,
                        cropX: cropArea.x,
                        cropY: cropArea.y,
                        cropWidth: cropArea.width,
                        cropHeight: cropArea.height
                      });
                    }}
                  />

                  {/* Informações de dimensões */}
                  <div className="absolute -bottom-8 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                    {Math.round(cropArea.width)} × {Math.round(cropArea.height)} px
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex items-center justify-between bg-black">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                className="px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400 min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            {cropArea.width > 0 && cropArea.height > 0 && (
              <div className="text-xs text-gray-500 border-l border-gray-700 pl-4">
                <div>Dimensões: {Math.round(cropArea.width)} × {Math.round(cropArea.height)} px</div>
                {aspectRatio && (
                  <div>Proporção: {aspectRatio.toFixed(2)}:1</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrop}
              disabled={!imageLoaded}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-gray-300 transition-colors flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar</span>
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

