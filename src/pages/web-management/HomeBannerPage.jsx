import ContentManager, { imageColumn, statusColumn, orderColumn, colorColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getBanners,
  create: webManagementService.createBanner,
  update: webManagementService.updateBanner,
  delete: webManagementService.deleteBanner,
};

// Text-colour presets (dark for light backgrounds, white for dark backgrounds).
const TEXT_COLORS = ['#111827', '#EA580C', '#1D4ED8', '#047857', '#7C3AED', '#FFFFFF'];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small — 1 column' },
  { value: 'wide', label: 'Wide (Rectangle) — 2 columns' },
  { value: 'full', label: 'Full width — whole row' },
];

const OVERLAY_STYLE_OPTIONS = [
  { value: 'gradient', label: 'Gradient (fades to transparent)' },
  { value: 'solid', label: 'Solid (flat color)' },
];

const GRADIENT_DIR_OPTIONS = [
  { value: 'to right', label: 'Left → Right' },
  { value: 'to left', label: 'Right → Left' },
  { value: 'to bottom', label: 'Top → Bottom' },
  { value: 'to top', label: 'Bottom → Top' },
  { value: 'to bottom right', label: 'Diagonal ↘' },
  { value: 'to top right', label: 'Diagonal ↗' },
];

const fields = [
  { name: 'eyebrow', label: 'Eyebrow / Tag', type: 'text', placeholder: 'e.g. Premium Hardware' },
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Hettich Hardware' },
  { name: 'subtitle', label: 'Subtitle', type: 'textarea', placeholder: 'Short supporting line' },
  { name: 'image', label: 'Banner Image', type: 'image' },
  { name: 'size', label: 'Banner Size', type: 'select', options: SIZE_OPTIONS, help: 'How wide the banner shows on the website' },
  { name: 'bgColor', label: 'Background / Overlay Color', type: 'color', help: 'Color layer over the card (and image)' },
  { name: 'overlayStyle', label: 'Overlay Style', type: 'select', options: OVERLAY_STYLE_OPTIONS, help: 'Gradient fades the color to transparent (like the website); solid is a flat tint' },
  { name: 'gradientDirection', label: 'Gradient Direction', type: 'select', options: GRADIENT_DIR_OPTIONS, help: 'Direction the gradient fades (only for gradient style)' },
  { name: 'bgOpacity', label: 'Color Strength', type: 'opacity', help: 'How strong the color is (0 = transparent, 100% = solid)' },
  { name: 'textColor', label: 'Text Color', type: 'color', presets: TEXT_COLORS, help: 'Eyebrow/title/subtitle text color' },
  { name: 'ctaLabel', label: 'Button Text', type: 'text', placeholder: 'e.g. Shop Now', help: 'Text shown on the banner button' },
  { name: 'link', label: 'Button Link', type: 'text', placeholder: 'e.g. /category/hinges-and-channels' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

// Grid column span (in the CRM gallery) per banner size.
const cardSpan = (item) => {
  if (item.size === 'full') return 'col-span-full';
  if (item.size === 'wide') return 'sm:col-span-2';
  return '';
};

// Min-height per size so the shape reflects the layout.
const sizeMinHeight = (size) => (size === 'full' ? 420 : size === 'wide' ? 360 : 300);

// Convert a hex color + opacity (0-1) into an rgba() string for the overlay.
const hexToRgba = (hex, opacity) => {
  if (!hex) return `rgba(248,250,252,${opacity ?? 1})`;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${opacity ?? 1})`;
};

// Overlay CSS — must match the storefront (BrandSpotlightGrid.overlayBackground).
const overlayBackground = (color, opacity, style, direction) => {
  const strong = hexToRgba(color, opacity ?? 1);
  if (style === 'solid') return strong;
  const mid = hexToRgba(color, Math.max(0, (opacity ?? 1) * 0.55));
  const faint = hexToRgba(color, 0);
  return `linear-gradient(${direction || 'to right'}, ${strong}, ${mid} 55%, ${faint})`;
};

// Live preview — a faithful duplicate of the storefront home-screen banner
// (matches BannerCarousel: full-bleed image, dark veil, frosted eyebrow pill,
// large title, subtitle and white "Shop Now" pill) with the chosen overlay.
const renderPreview = (v, { resolveUploadUrl }) => {
  const overlay = overlayBackground(v.bgColor, v.bgOpacity ?? 1, v.overlayStyle || 'gradient', v.gradientDirection || 'to right');
  const minHeight = sizeMinHeight(v.size);
  const textColor = v.textColor || '#FFFFFF';
  return (
    <div className="relative w-full overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/10">
      <div className="relative overflow-hidden" style={{ minHeight }}>
        {v.image && (
          <img src={resolveUploadUrl(v.image)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {/* chosen color/gradient overlay */}
        <div className="absolute inset-0" style={{ background: overlay }} />
        {/* dark veil on the left for text contrast — same as the website */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.1) 40%, transparent)' }} />

        <div className="relative z-10 h-full flex flex-col justify-center max-w-md px-8 py-8" style={{ minHeight, color: textColor }}>
          <span className="inline-flex items-center gap-1.5 w-fit bg-white/15 backdrop-blur ring-1 ring-white/25 text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider" style={{ color: textColor }}>
            <i className="fa-solid fa-bolt text-amber-300" /> {v.eyebrow || 'BDM Tiles'}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] drop-shadow-sm" style={{ color: textColor }}>
            {v.title || 'Banner title'}
          </h2>
          {v.subtitle && (
            <p className="mt-3 text-sm font-medium max-w-sm drop-shadow-sm" style={{ color: textColor, opacity: 0.9 }}>{v.subtitle}</p>
          )}
          <span className="mt-5 w-fit bg-white text-neutral-900 font-bold text-sm px-5 py-2.5 rounded-full flex items-center gap-2">
            {v.ctaLabel || 'Shop Now'}
            <i className="fa-solid fa-arrow-right text-[11px]" />
          </span>
        </div>
      </div>
    </div>
  );
};

const columns = [
  imageColumn(),
  { title: 'Banner', dataIndex: 'title', render: (v, r) => (
    <div>
      {r.eyebrow && <div className="text-[11px] uppercase tracking-wide text-orange-600">{r.eyebrow}</div>}
      <div className="font-medium text-sm">{v}</div>
      <div className="text-xs text-gray-400 truncate max-w-[260px]">{r.subtitle}</div>
    </div>
  ) },
  { title: 'Size', dataIndex: 'size', width: 90, render: (v) => (v || 'small') },
  colorColumn('bgColor', 'Background'),
  orderColumn,
  statusColumn,
];

const HomeBannerPage = () => (
  <ContentManager
    title="Home Banner"
    subtitle="Promotional banners displayed on the website home page"
    service={service}
    fields={fields}
    columns={columns}
    preview={renderPreview}
    cardRender={renderPreview}
    cardSpan={cardSpan}
  />
);

export default HomeBannerPage;
