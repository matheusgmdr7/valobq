/**
 * Utilitário para exportar gráficos como imagem
 */

export interface ExportOptions {
  format?: 'png' | 'jpeg' | 'svg' | 'pdf';
  quality?: number; // 0-1 para JPEG
  filename?: string;
  backgroundColor?: string;
  width?: number;
  height?: number;
}

/**
 * Exporta canvas como imagem
 */
export function exportCanvasAsImage(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {}
): Promise<Blob> {
  const {
    format = 'png',
    quality = 0.92,
    backgroundColor = '#1a1a1a'
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Criar canvas temporário para adicionar background se necessário
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get 2D context'));
        return;
      }

      // Preencher background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Copiar conteúdo do canvas original
      ctx.drawImage(canvas, 0, 0);

      // Converter para blob
      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        format === 'jpeg' ? quality : undefined
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Faz download da imagem
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta gráfico WebGL como imagem
 */
export async function exportChartAsImage(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {}
): Promise<void> {
  try {
    const {
      format = 'png',
      filename = `chart-${new Date().toISOString().slice(0, 10)}.${format}`
    } = options;

    const blob = await exportCanvasAsImage(canvas, options);
    downloadImage(blob, filename);
  } catch (error) {
    console.error('Error exporting chart:', error);
    throw error;
  }
}

/**
 * Copia gráfico para clipboard
 */
export async function copyChartToClipboard(
  canvas: HTMLCanvasElement
): Promise<void> {
  try {
    const blob = await exportCanvasAsImage(canvas, { format: 'png' });
    
    // Converter blob para clipboard
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
  } catch (error) {
    console.error('Error copying chart to clipboard:', error);
    throw error;
  }
}

/**
 * Exporta canvas como SVG
 */
export function exportCanvasAsSVG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {}
): string {
  const {
    width = canvas.width,
    height = canvas.height,
    backgroundColor = '#1a1a1a'
  } = options;

  const imgData = canvas.toDataURL('image/png');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
  <image href="${imgData}" width="${width}" height="${height}"/>
</svg>`;
}

/**
 * Exporta gráfico como SVG
 */
export async function exportChartAsSVG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {}
): Promise<void> {
  try {
    const {
      filename = `chart-${new Date().toISOString().slice(0, 10)}.svg`
    } = options;

    const svgContent = exportCanvasAsSVG(canvas, options);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    downloadImage(blob, filename);
  } catch (error) {
    console.error('Error exporting chart as SVG:', error);
    throw error;
  }
}

/**
 * Exporta gráfico como CSV (dados)
 */
export function exportChartDataAsCSV(
  data: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
  filename: string = `chart-data-${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const headers = ['Time', 'Open', 'High', 'Low', 'Close', 'Volume'];
  const rows = data.map(candle => [
    new Date(candle.time).toISOString(),
    candle.open.toString(),
    candle.high.toString(),
    candle.low.toString(),
    candle.close.toString(),
    (candle.volume || 0).toString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadImage(blob, filename);
}

/**
 * Exporta gráfico como JSON (dados)
 */
export function exportChartDataAsJSON(
  data: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
  filename: string = `chart-data-${new Date().toISOString().slice(0, 10)}.json`
): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadImage(blob, filename);
}

/**
 * Abre gráfico em nova janela para impressão
 */
export function printChart(canvas: HTMLCanvasElement): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Could not open print window');
    return;
  }

  const img = canvas.toDataURL('image/png');
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Chart</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white;
          }
          img {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <img src="${img}" alt="Chart" />
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
}

