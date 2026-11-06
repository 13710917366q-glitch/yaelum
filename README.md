# Yaelum 作品集

正式地址：https://yaelumworks.art/

Cloudflare Pages 从 `codex/yaelumworks-pages` 分支自动部署。构建命令为 `node scripts/build.mjs`，输出目录为 `dist`。原来的 `main` 分支与旧版站点保留。

## 视频

- 点击作品后才加载视频；页面初始加载不请求 MP4，关闭弹窗清空视频地址并停止下载。
- 九个现有 MP4 通过 `https://video.yaelumworks.art` 上的 `yaelum-video-guard` 读取私有 R2 桶，未重新编码。
- 高清读取失败或连续 12 秒无进展，切换到原有 GitHub Pages 的相同 MP4，最多回退一次。暂停、播放结束、关闭及浏览器阻止自动播放不触发超时回退。
- 播放器右上角可手动切换 B 站。尚未找到本地 MP4 的商业 PV 保持 B 站播放。
- `?source=bilibili` / `?source=github` / `?source=r2` 保留作来源核对入口，公开页面不显示测试面板。

## 费用保护

R2 桶 `yaelum-portfolio-video-private` 保持私有，禁止添加直接公开的 R2 域名或启用 r2.dev。Worker 只允许九个固定文件，只读，每个请求至多一次存储读取。

账户须保持 Workers Free。每日账户总计 100,000 次请求的硬停机制，在当前固定文件、单次读取的实现下，将此播放路径的月读取次数限制在 R2 免费读取额度内。此方案不等于整个 Cloudflare 账户的金额硬上限，其他桶、脚本、上传或套餐升级仍有各自用量。

保护脚本独立部署，不由 Pages 自动发布。源配置默认 `VIDEO_ENABLED=0`，核实 Free 套餐、私有桶与对象大小后才通过官方 Wrangler 加 `--var VIDEO_ENABLED:1` 启用。不要将 `dist` 之外的目录作为 Pages 输出。

## 验证

`node scripts/build.mjs`

`node --test guarded-video/worker.test.mjs guarded-video/fallback.test.mjs`

自动化检查涵盖字节范围、每请求最多一次读取、禁用开关、非法请求零读取、异常不重试、CORS、暂停及关闭后的超时清理。真实网络播放与自定义域名证书状态须在线验证。
