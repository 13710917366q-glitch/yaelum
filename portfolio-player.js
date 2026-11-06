(() => {
  'use strict';
  const files = Object.freeze({1:'cover1.mp4',2:'cover2.mp4',3:'cover4.mp4',4:'cover5.mp4',5:'cover6.mp4',6:'cover7.mp4',7:'cover8.mp4',8:'cover9.mp4',9:'intro.mp4'});
  const primaryBase = 'https://video.yaelumworks.art';
  const backupBase = 'https://13710917366q-glitch.github.io/yaelum-video-hosting-test/video';
  const requested = new URLSearchParams(location.search).get('source');
  const source = ['r2','github','bilibili'].includes(requested) ? requested : 'r2';

  window.YaelumPortfolioPlayer = (container, page, bvid, title) => {
    let disposed = false, media = null, guard = null, kind = null;
    const root = document.createElement('div');
    root.className = 'portfolio-player';
    const status = document.createElement('span');
    status.className = 'player-status';
    status.setAttribute('role', 'status');
    const switcher = document.createElement('button');
    switcher.type = 'button';
    switcher.className = 'player-switch';
    const onSwitch = () => open(kind === 'bilibili' ? 'r2' : 'bilibili');
    switcher.addEventListener('click', onSwitch);
    root.append(status, switcher);
    container.append(root);

    function clearMedia() {
      guard?.stop(); guard = null;
      if (media instanceof HTMLVideoElement) {
        media.pause(); media.removeAttribute('src'); media.load();
      } else if (media) media.src = 'about:blank';
      media?.remove(); media = null;
    }
    function open(next, resumeAt = 0) {
      if (disposed) return;
      clearMedia(); kind = next; root.dataset.source = next;
      status.textContent = '';
      switcher.hidden = !files[page];
      switcher.textContent = next === 'bilibili' ? '高清播放' : 'B站播放';
      if (next === 'bilibili' || !files[page]) {
        kind = 'bilibili'; root.dataset.source = kind;
        const frame = document.createElement('iframe');
        frame.title = title;
        frame.allow = 'autoplay; fullscreen; picture-in-picture';
        frame.allowFullscreen = true;
        frame.src = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${page}&p=${page}&autoplay=1`;
        media = frame; root.prepend(frame);
        return;
      }
      const video = document.createElement('video');
      video.controls = true; video.playsInline = true; video.preload = 'none';
      video.setAttribute('aria-label', title);
      video.dataset.source = next;
      video.src = `${next === 'r2' ? primaryBase : backupBase}/${files[page]}`;
      media = video; root.prepend(video);
      status.textContent = next === 'github' ? '正在加载高清备用…' : '正在加载高清…';
      video.addEventListener('loadedmetadata', () => {
        if (disposed || media !== video) return;
        if (resumeAt > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 0.1));
      }, {once:true});
      video.addEventListener('playing', () => {
        if (media === video) status.textContent = '';
      });
      guard = window.YaelumVideoFallback(video, () => {
        if (disposed || media !== video) return;
        if (next === 'r2') {
          open('github', video.currentTime);
        } else {
          clearMedia();
          status.textContent = '高清暂时加载失败，请点右上角「B站播放」。';
        }
      });
      const thisGuard = guard;
      video.play().catch(error => {
        if (disposed || media !== video) return;
        if (error.name === 'NotAllowedError') {
          thisGuard.blocked(); status.textContent = '点击视频播放';
        } else if (error.name !== 'AbortError') thisGuard.failed(error.message);
      });
    }
    open(files[page] ? source : 'bilibili');
    return () => {
      if (disposed) return;
      disposed = true; clearMedia();
      switcher.removeEventListener('click', onSwitch); root.remove();
    };
  };
})();
