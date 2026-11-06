(() => {
  'use strict';
  // A paused/closed video must never restart itself through the fallback.
  globalThis.YaelumVideoFallback = function(video, fallback, timers=globalThis) {
    let timer=null, stopped=false, suspended=false, lastTime=video.currentTime;
    const listeners=[];
    function clear(){if(timer!==null)timers.clearTimeout(timer);timer=null;}
    function stop(){if(stopped)return;stopped=true;clear();for(const [event,fn] of listeners)video.removeEventListener(event,fn);}
    function fail(reason){if(stopped)return;stop();fallback(reason);}
    function arm(){clear();if(!stopped&&!suspended)timer=timers.setTimeout(()=>fail('加载或缓冲超过12秒'),12000);}
    function on(event,fn){video.addEventListener(event,fn);listeners.push([event,fn]);}
    on('error',()=>fail(`视频读取失败（${video.error?.code||'网络'}）`));
    on('playing',()=>{suspended=false;arm();});
    on('timeupdate',()=>{if(!video.paused&&video.currentTime!==lastTime){lastTime=video.currentTime;arm();}});
    on('waiting',()=>{if(!video.paused)arm();});
    on('seeking',()=>{if(!video.paused)arm();});
    on('pause',()=>{suspended=true;clear();});
    on('play',()=>{suspended=false;arm();});
    on('ended',()=>{suspended=true;clear();});
    arm();
    return {stop,blocked(){suspended=true;clear();},failed:fail};
  };
})();
