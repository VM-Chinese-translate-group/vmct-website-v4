export const keyframes = {
  'error-status-pop': '{from{scale:0.65;opacity:0}to{scale:1;opacity:1}}',
  'error-status-draw': '{to{stroke-dashoffset:0}}',
  'minecraft-player-bob':
    '{0%,\n  100%{transform:translateY(0) rotateY(-12deg) rotateX(1deg)}50%{transform:translateY(var(--bob-y)) rotateY(var(--bob-yaw)) rotateX(1deg)}}',
  'minecraft-player-limb':
    '{0%,\n  100%{transform:var(--part-transform) var(--limb-start)}50%{transform:var(--part-transform) var(--limb-end)}}',
  'success-status-pop': '{from{scale:0.65;opacity:0}to{scale:1;opacity:1}}',
  'success-status-draw': '{to{stroke-dashoffset:0}}',
  creditReveal: '{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
  'image-loading-shimmer': '{to{transform:translateX(100%)}}',
  whirling:
    '{from{transform:rotate3d(0,1,0,-90deg) scale(0.9)}to{transform:rotate3d(0,1,0,90deg) scale(1)}}',
}
