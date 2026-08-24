import { useState, createContext, useContext } from 'react';
import getImageUrl from '../utils/imageUrl.js';

/**
 * ImageLightbox — Global image viewer with zoom.
 * 
 * Usage:
 *   1. Wrap app with <LightboxProvider>
 *   2. Use <ProductImage src="..." /> anywhere — auto-clickable to enlarge
 *   3. Or call openLightbox(url) directly via useLightbox() hook
 */

const LightboxContext = createContext(null);

export const LightboxProvider = ({ children }) => {
  const [image, setImage] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  const openLightbox = (src) => {
    if (!src) return;
    setImage(getImageUrl(src));
    setZoomed(false);
  };

  const closeLightbox = () => { setImage(null); setZoomed(false); };

  return (
    <LightboxContext.Provider value={{ openLightbox }}>
      {children}

      {/* Lightbox Overlay */}
      {image && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={closeLightbox}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-red-50 hover:text-red-600 z-10 text-lg font-bold"
              onClick={closeLightbox}>✕</button>

            {/* Image */}
            <img
              src={image}
              alt="Product"
              className={`rounded-lg shadow-2xl transition-transform duration-300 ${zoomed ? 'scale-150 cursor-zoom-out' : 'max-w-[85vw] max-h-[85vh] object-contain cursor-zoom-in'}`}
              onClick={() => setZoomed(!zoomed)}
              style={zoomed ? { transformOrigin: 'center center' } : {}}
            />

            {/* Zoom hint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1 rounded-full">
              {zoomed ? 'Click to zoom out' : 'Click image to zoom in'}
            </div>
          </div>
        </div>
      )}
    </LightboxContext.Provider>
  );
};

export const useLightbox = () => {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within LightboxProvider');
  return ctx;
};

/**
 * ProductImage — A clickable product thumbnail that opens in lightbox.
 * Drop-in replacement for <img> with automatic lightbox on click.
 * 
 * Props:
 *   src: image path (relative or absolute)
 *   size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' (default: 'sm')
 *   className: additional classes
 *   rounded: boolean (default: true)
 */
export const ProductImage = ({ src, size = 'sm', className = '', rounded = true }) => {
  const { openLightbox } = useLightbox();

  if (!src) return null;

  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const sizeClass = sizeMap[size] || sizeMap.sm;

  return (
    <img
      src={getImageUrl(src)}
      alt=""
      className={`${sizeClass} ${rounded ? 'rounded' : ''} object-cover border border-gray-100 cursor-pointer hover:ring-2 hover:ring-blue-300 hover:shadow-md transition-all shrink-0 ${className}`}
      onClick={(e) => { e.stopPropagation(); openLightbox(src); }}
    />
  );
};

export default LightboxProvider;
