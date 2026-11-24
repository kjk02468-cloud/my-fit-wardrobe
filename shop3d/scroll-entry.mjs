// Load the pinned UMD scripts only on the 3D route. They are hosted with the app.
function loadScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(file, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error('입장 스크롤 모듈을 불러오지 못했어요.'));
    document.head.append(script);
  });
}

let pluginReady;
export function prepareScrollTrigger() {
  pluginReady ||= (async () => {
    await loadScript('./vendor/gsap.min.js');
    await loadScript('./vendor/ScrollTrigger.min.js');
    window.gsap.registerPlugin(window.ScrollTrigger);
    return window.ScrollTrigger;
  })();
  return pluginReady;
}

export function bindEntryScroll(ScrollTrigger, element, draw, finish) {
  return ScrollTrigger.create({
    scroller: element,
    start: 0,
    end: () => Math.max(1, element.scrollHeight - element.clientHeight),
    onUpdate({progress}) {
      draw(progress);
      if (progress >= .999) finish();
    },
  });
}
