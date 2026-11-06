// One incoming request performs at most one R2 read. Keep the account on Workers Free.
export const VIDEOS = Object.freeze({
  'cover1.mp4':53847537,'cover2.mp4':9567837,'cover4.mp4':15207075,
  'cover5.mp4':66506817,'cover6.mp4':16425451,'cover7.mp4':28701111,
  'cover8.mp4':15450398,'cover9.mp4':29354099,'intro.mp4':99825215
});
const ORIGINS = new Set(['https://yaelumworks.art', 'https://www.yaelumworks.art', 'https://yaelumworks.pages.dev', 'https://13710917366q-glitch.github.io', 'https://yaelum-video-test.yaelum-video-guard.workers.dev']);
export function parseRange(value, size) {
  if (value === null) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2])) throw new Error('range');
  let start, end;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error('range');
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(m[1]); end = m[2] ? Number(m[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) throw new Error('range');
    end = Math.min(end, size - 1);
  }
  return {offset:start, length:end-start+1};
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = new Headers({
      'Access-Control-Allow-Origin': ORIGINS.has(request.headers.get('Origin')) ? request.headers.get('Origin') : 'https://yaelumworks.art',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers':'Range',
      'Access-Control-Expose-Headers':'Content-Length, Content-Range, Accept-Ranges, ETag',
      'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'
    });
    const reply = (message, status, extra={}) => new Response(request.method==='HEAD'?null:message, {status,headers:new Headers([...headers,...Object.entries(extra)])});
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) return reply('Method not allowed',405,{'Allow':'GET, HEAD, OPTIONS'});
    if (request.method==='OPTIONS') return reply(null,204);
    if (url.pathname==='/health') return reply(JSON.stringify({build:'guard-v1',enabled:env.VIDEO_ENABLED==='1'}),200,{'Content-Type':'application/json'});
    if (env.VIDEO_ENABLED!=='1' || !env.VIDEOS) return reply('Video temporarily unavailable',503);
    const key = url.pathname.slice(1);
    if (!Object.hasOwn(VIDEOS,key) || url.search) return reply('Not found',404);
    const size = VIDEOS[key];
    let range;
    try { range = request.method==='GET' ? parseRange(request.headers.get('Range'),size) : null; }
    catch { return reply('Invalid byte range',416,{'Content-Range':`bytes */${size}`}); }
    // HEAD does not run GET first. Failed/missing reads never retry internally.
    let object;
    try {
      object = request.method==='HEAD'
        ? await env.VIDEOS.head(key)
        : await env.VIDEOS.get(key,range?{range}:{});
    } catch { return reply('Video temporarily unavailable',503); }
    if (!object) return reply('Not found',404);
    if (object.size!==size) {
      if (object.body) await object.body.cancel().catch(()=>{});
      return reply('Video revision mismatch',503);
    }
    headers.set('Content-Type','video/mp4');
    headers.set('Accept-Ranges','bytes');
    headers.set('Cache-Control','private, max-age=3600');
    if (object.httpEtag) headers.set('ETag',object.httpEtag);
    headers.set('Content-Length',String(range?.length ?? size));
    if (range) headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${size}`);
    return new Response(request.method==='HEAD'?null:object.body,{status:range?206:200,headers});
  }
};
