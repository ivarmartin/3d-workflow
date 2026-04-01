// iOS Chrome uses WebKit which has strict GPU memory limits.
// Detect platform to cap DPR and disable expensive features on mobile.
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isMobile = isIOS || /Android/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
