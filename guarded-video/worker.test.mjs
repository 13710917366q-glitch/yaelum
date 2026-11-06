import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{VIDEOS,parseRange} from './worker.mjs';

function fixture(mode='ok') {
  const calls=[];
  const env={VIDEO_ENABLED:'1',VIDEOS:{
    async get(key,options){calls.push(['get',key,options]);return result(key,options);},
    async head(key){calls.push(['head',key]);return result(key);}
  }};
  function result(key,options){
    if(mode==='throw')throw Error('backend');
    if(mode==='missing')return null;
    return {size:mode==='wrong'?1:VIDEOS[key],httpEtag:'"test-etag"',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(options?.range?.length||1));c.close();}})};
  }
  return {env,calls};
}
function request(path='/intro.mp4',method='GET',headers={}){return new Request(`https://video.test${path}`,{method,headers});}
test('disabled, unknown, query, writes, OPTIONS, health and invalid ranges do zero reads',async()=>{
  for(const [path,method,headers,status] of [
    ['/x.mp4','GET',{},404],['/intro.mp4?bypass=1','GET',{},404],
    ['/intro.mp4','POST',{},405],['/intro.mp4','PUT',{},405],['/intro.mp4','DELETE',{},405],
    ['/intro.mp4','OPTIONS',{},204],['/health','GET',{},200],
    ['/intro.mp4','GET',{Range:'bytes=0-1,4-8'},416],['/intro.mp4','GET',{Range:'bytes=999999999-1000000000'},416]
  ]){const f=fixture();assert.equal((await worker.fetch(request(path,method,headers),f.env)).status,status);assert.equal(f.calls.length,0);}
  const f=fixture();f.env.VIDEO_ENABLED='0';assert.equal((await worker.fetch(request(),f.env)).status,503);assert.equal(f.calls.length,0);
});
test('GET streams exactly one get; HEAD uses exactly one head',async()=>{
  for(const method of ['GET','HEAD']){
    const f=fixture(),response=await worker.fetch(request('/intro.mp4',method),f.env);
    assert.equal(response.status,200);assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],method.toLowerCase());
    assert.equal(response.headers.get('Content-Length'),String(VIDEOS['intro.mp4']));
    assert.equal(response.headers.get('Content-Type'),'video/mp4');assert.equal(response.headers.get('Accept-Ranges'),'bytes');
    if(method==='HEAD')assert.equal(response.body,null);else assert.equal((await response.arrayBuffer()).byteLength,1);
  }
});
test('byte ranges preserve streaming headers and exact offsets',async()=>{
  for(const [value,start,length] of [['bytes=0-15',0,16],['bytes=-8',VIDEOS['intro.mp4']-8,8],['bytes=99825210-',99825210,5],['bytes=99825210-999999999',99825210,5]]){
    const f=fixture(),r=await worker.fetch(request('/intro.mp4','GET',{Range:value}),f.env);
    assert.equal(r.status,206);assert.deepEqual(f.calls[0][2],{range:{offset:start,length}});assert.equal(f.calls.length,1);
    assert.equal(r.headers.get('Content-Range'),`bytes ${start}-${start+length-1}/${VIDEOS['intro.mp4']}`);
    assert.equal((await r.arrayBuffer()).byteLength,length);
  }
  for(const value of ['bytes=-0','bytes=-','bytes=2-1','bytes=9007199254740992-','items=0-1'])assert.throws(()=>parseRange(value,10));
});
test('backend failures and revision mismatch never retry or expose origin',async()=>{
  for(const mode of ['throw','missing','wrong']){
    const f=fixture(mode),r=await worker.fetch(request(),f.env);
    assert.equal(r.status,mode==='missing'?404:503);assert.equal(f.calls.length,1);assert.equal(r.headers.get('Location'),null);assert.equal(r.headers.get('Cache-Control'),'no-store');
  }
});
test('concurrent requests stay within one read per incoming request',async()=>{
  const f=fixture();const responses=await Promise.all(Array.from({length:40},()=>worker.fetch(request('/cover4.mp4','HEAD'),f.env)));
  assert.equal(f.calls.length,40);assert.ok(responses.every(r=>r.status===200));
});
test('custom-domain CORS preserves only approved origins without adding storage reads',async()=>{
  for(const origin of ['https://yaelumworks.art','https://www.yaelumworks.art','https://yaelumworks.pages.dev','https://13710917366q-glitch.github.io','https://unrelated.example']){
    const f=fixture();
    const r=await worker.fetch(request('/health','GET',{Origin:origin}),f.env);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin==='https://unrelated.example'?'https://yaelumworks.art':origin);
    assert.equal(r.headers.get('Vary'),'Origin');
    assert.equal(f.calls.length,0);
  }
});
