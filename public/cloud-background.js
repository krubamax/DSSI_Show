(() => {
  function mountCloudBackground() {
    let element = document.querySelector('[data-cloud-background]');
    if (!element) {
      element = document.createElement('div');
      element.setAttribute('data-cloud-background', '');
      document.body.prepend(element);
    }

    element.classList.add('global-cloud-background');

    if (!window.VANTA?.CLOUDS || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    try {
      window.dssiCloudBackground?.destroy();
      window.dssiCloudBackground = window.VANTA.CLOUDS({
        el: element,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        skyColor: 0x6eb6e2,
        cloudColor: 0xe5f2f9,
        cloudShadowColor: 0x789aae,
        sunColor: 0xffad63,
        sunGlareColor: 0xffd7a1,
        sunlightColor: 0xffdfb0,
        speed: 0.45,
      });
    } catch (error) {
      console.warn('Vanta unavailable; using the static cloud background.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCloudBackground, { once: true });
  } else {
    mountCloudBackground();
  }
})();
