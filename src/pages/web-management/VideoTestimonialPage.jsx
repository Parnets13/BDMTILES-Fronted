import ContentManager, { statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';
import { resolveUploadUrl } from '../../config/api.js';

const service = {
  get: webManagementService.getVideoTestimonials,
  create: webManagementService.createVideoTestimonial,
  update: webManagementService.updateVideoTestimonial,
  delete: webManagementService.deleteVideoTestimonial,
};

const BADGE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#F97316'];

const fields = [
  { name: 'name', label: 'Customer Name', type: 'text', required: true, placeholder: 'e.g. Mr. Vishal' },
  { name: 'badge', label: 'Badge / Role', type: 'text', placeholder: 'e.g. Architect & Interior Designer' },
  { name: 'badgeColor', label: 'Badge Color', type: 'color', presets: BADGE_COLORS, help: 'Background color of the badge pill' },
  { name: 'quote', label: 'Quote', type: 'textarea', required: true, placeholder: '"100% genuine Hettich & Action Tesa boards at direct distributor rates."' },
  { name: 'caption', label: 'Caption', type: 'text', placeholder: 'e.g. Hear what Mr. Vishal had to say' },
  { name: 'thumbnail', label: 'Thumbnail Image', type: 'image', help: 'Optional: portrait photo shown as card background. If blank the video\'s own first frame is used.' },
  { name: 'videoUrl', label: 'Video', type: 'video', required: true, help: 'Upload a video file (MP4/WEBM/MOV, max 100 MB) or paste a YouTube/Vimeo URL' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

/**
 * Inline video player cell.
 * - When videoUrl resolves to a direct file → <video> with controls.
 *   No poster prop when no thumbnail is set, so the browser generates its own
 *   first-frame thumbnail via preload="metadata".
 * - When videoUrl is a YouTube/Vimeo link → show a play-icon thumbnail that
 *   opens the link (these can't be embedded in <video>).
 */
const VideoCell = ({ videoUrl, thumbnail }) => {
  if (!videoUrl) {
    return (
      <div className="w-52 h-28 rounded-xl bg-neutral-100 border border-gray-200 flex flex-col items-center justify-center gap-1">
        <i className="fa-solid fa-video text-gray-300 text-2xl" />
        <span className="text-[10px] text-gray-400">No video</span>
      </div>
    );
  }

  const src = resolveUploadUrl(videoUrl);
  const posterSrc = thumbnail ? resolveUploadUrl(thumbnail) : undefined;

  const isExternal = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') || videoUrl.includes('vimeo.com');

  if (isExternal) {
    // External embeds: show a thumbnail-style card with a link to open.
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block w-52 h-28 rounded-xl overflow-hidden bg-neutral-900 border border-gray-200"
      >
        {posterSrc && (
          <img src={posterSrc} alt="thumbnail" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
            <i className="fa-brands fa-youtube text-white text-lg" />
          </div>
          <span className="text-[10px] text-white/80 font-semibold">Open in browser</span>
        </div>
      </a>
    );
  }

  // Self-hosted video — play inline. No poster = browser auto-generates first frame.
  return (
    <video
      src={src}
      poster={posterSrc}
      className="w-52 h-28 rounded-xl bg-black border border-gray-200"
      controls
      preload="metadata"
      style={{ display: 'block', objectFit: 'cover' }}
    />
  );
};

/** Live preview card in the Add/Edit modal — portrait style matching the website. */
const renderPreview = (v) => {
  const badgeBg = v.badgeColor || '#F59E0B';
  const videoSrc = v.videoUrl ? resolveUploadUrl(v.videoUrl) : null;
  const thumbSrc = v.thumbnail ? resolveUploadUrl(v.thumbnail) : null;
  const isExternal = videoSrc && (videoSrc.includes('youtube.com') || videoSrc.includes('youtu.be') || videoSrc.includes('vimeo.com'));

  return (
    <div className="max-w-xs mx-auto space-y-2">
      {/* Portrait card */}
      <div
        className="relative w-full bg-neutral-900 rounded-3xl overflow-hidden shadow-md border border-gray-200"
        style={{ aspectRatio: '9/14' }}
      >
        {thumbSrc && (
          <img src={thumbSrc} alt={v.name || 'Customer'} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        {!thumbSrc && videoSrc && !isExternal && (
          // Show video itself as the background when no thumbnail is set.
          <video src={videoSrc} className="absolute inset-0 w-full h-full object-cover opacity-60" muted preload="metadata" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-lg" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)', border: '1.5px solid rgba(255,255,255,0.5)' }}>
            <i className="fa-solid fa-play ml-1" />
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-center space-y-1.5">
          {v.badge && (
            <span className="inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: badgeBg, color: '#fff' }}>
              {v.badge}
            </span>
          )}
          <p className="text-xs font-bold text-white leading-snug drop-shadow">{v.quote || 'Customer quote goes here…'}</p>
        </div>
      </div>
      <p className="text-xs font-bold text-center text-gray-800">{v.caption || v.name || ''}</p>
    </div>
  );
};

const columns = [
  {
    title: 'Video',
    key: 'video',
    width: 220,
    render: (_, r) => <VideoCell videoUrl={r.videoUrl} thumbnail={r.thumbnail} />,
  },
  {
    title: 'Customer',
    key: 'customer',
    render: (_, r) => (
      <div>
        <div className="font-medium text-sm">{r.name}</div>
        {r.badge && (
          <span
            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mt-0.5"
            style={{ backgroundColor: r.badgeColor || '#F59E0B' }}
          >
            {r.badge}
          </span>
        )}
        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2 max-w-[240px]">{r.quote}</div>
        {r.caption && <div className="text-xs text-gray-500 mt-0.5 italic">{r.caption}</div>}
      </div>
    ),
  },
  orderColumn,
  statusColumn,
];

const VideoTestimonialPage = () => (
  <ContentManager
    title="Video Testimonials"
    subtitle="Video testimonial cards shown in the 'Customers love BDM TILES' section on the website"
    service={service}
    fields={fields}
    columns={columns}
    preview={renderPreview}
  />
);

export default VideoTestimonialPage;
