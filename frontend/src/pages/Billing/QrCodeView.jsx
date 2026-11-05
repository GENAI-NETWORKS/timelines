import { useMemo } from 'react';
import { createQrSvgString } from './qrCodeGenerator';

/**
 * Reusable QR Code SVG View
 * Renders a pure-SVG QR code using the zero-dependency generator.
 * Fully safe — returns a fallback placeholder on any error.
 */
export default function QrCodeView({
  value = '',
  size = 100,
  margin = 2,
  className = '',
  fgColor = '#000000',
  bgColor = '#ffffff'
}) {
  const svgHtml = useMemo(() => {
    const str = String(value ?? '').trim();
    if (!str) return '';
    try {
      const result = createQrSvgString(str, { size, margin, fgColor, bgColor });
      // Sanity-check: must start with <svg
      return typeof result === 'string' && result.startsWith('<svg') ? result : '';
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[QrCodeView] Failed to generate QR Code for:', str, e);
      return '';
    }
  }, [value, size, margin, fgColor, bgColor]);

  if (!svgHtml) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-400 select-none"
      >
        QR
      </div>
    );
  }

  return (
    <div
      className={`inline-block ${className}`}
      style={{ lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

