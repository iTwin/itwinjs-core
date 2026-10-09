/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// A standalone review of recorded framebuffers. This does not run either renderer or change LOD.
/** @internal */
export function createGaussianComparisonReport(report, links = []) {
  const data = JSON.stringify(report).replace(/</g, "\\u003c");
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const navigation = links.map((link) => `<a href="${escape(link.url)}">${escape(link.label)}</a>`).join("");
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>iTwin.js / Cesium Gaussian comparison</title>
<style>
*{box-sizing:border-box}body{background:#0c1118;color:#eef3fa;font:16px system-ui;margin:24px}
main{max-width:1500px;margin:auto}h1{font-size:24px;margin:16px 0 8px}p{line-height:1.5;margin:8px 0}
a{color:#8fc9ff}nav{display:flex;flex-wrap:wrap;gap:20px}.controls{display:flex;flex-wrap:wrap;gap:20px;margin:20px 0}
label{display:flex;align-items:center;gap:8px}select{font:inherit;color:inherit;background:#1a2535;border:1px solid #6b7b90;border-radius:4px;padding:6px}
input[type=range]{width:240px;max-width:45vw;accent-color:#8fc9ff}.scroll{overflow:auto;margin-top:18px}
.stage{position:relative;width:100%;max-width:1200px;margin:auto}.stage img{display:block;width:100%;height:auto}
.stage .native{position:absolute;inset:0}.divider{position:absolute;inset:0 auto 0 50%;width:2px;background:#fff;pointer-events:none}
.badge{position:absolute;top:12px;background:#0c1118dc;padding:6px 10px;border-radius:3px;pointer-events:none}
.badge.left{left:12px}.badge.right{right:12px}.pair{display:none;gap:16px}figure{margin:0;flex:1;min-width:0}
figcaption{margin-bottom:8px}figure img{display:block;width:100%}.timing{color:#bbd4f1}.context,details{color:#aab7c9}
.stage[data-layout=native] .reference,.stage[data-layout=native] .right,.stage[data-layout=reference] .native,
.stage[data-layout=reference] .left,.stage:not([data-layout=wipe]) .divider{visibility:hidden}
@media(max-width:700px){body{margin:12px}.controls{gap:12px}.pair{flex-direction:column}h1{font-size:20px}}
</style>
<main>
<nav aria-label="Comparison reports">${navigation}</nav>
<h1>iTwin.js / CesiumJS</h1><p id="source"></p>
<div class="controls">
<label>View <select id="pose" aria-label="Camera view"></select></label>
<label>Compare <select id="layout" aria-label="Comparison layout"><option value="wipe">Image slider</option><option value="pair">Side by side</option><option value="native">iTwin.js only</option><option value="reference">CesiumJS only</option></select></label>
<label>Size <select id="scale" aria-label="Image size"><option value="fit">Fit</option><option value="1">100% pixels</option><option value="2">200% pixels</option></select></label>
<label id="wipe-control">Reveal iTwin.js <input id="wipe" aria-label="Reveal iTwin.js" type="range" min="0" max="100" value="50"><output id="percent">50%</output></label>
</div>
<p class="timing" id="timing"></p><p class="context" id="completion"></p><p id="counts"></p>
<div class="scroll"><div class="stage" id="stage" data-layout="wipe">
<img class="reference" id="reference" alt="CesiumJS recorded framebuffer"><img class="native" id="native" alt="iTwin.js recorded framebuffer">
<div class="badge left">iTwin.js</div><div class="badge right">CesiumJS</div><div class="divider" id="divider"></div>
</div><div class="pair" id="pair"><figure><figcaption>iTwin.js</figcaption><img id="pair-native" alt="iTwin.js recorded framebuffer"></figure><figure><figcaption>CesiumJS</figcaption><img id="pair-reference" alt="CesiumJS recorded framebuffer"></figure></div></div>
<p class="context" id="settings"></p><p class="context">Recorded views with the same camera and framebuffer size. Terrain, BIM, sky and FXAA disabled. Use the slider or single-renderer view to judge appearance; detail settings may select different content.</p>
<details><summary>Capture and measurement details</summary><p id="method"></p><p id="hardware"></p><p id="metrics"></p></details>
</main>
<script id="capture" type="application/json">${data}</script>
<script>
const report=JSON.parse(document.getElementById('capture').textContent);
const el=id=>document.getElementById(id), number=n=>n?.toLocaleString()??'unavailable';
for(const r of report.results){const option=document.createElement('option');option.value=r.name;option.textContent=r.name[0].toUpperCase()+r.name.slice(1);el('pose').appendChild(option)}
el('source').textContent=typeof report.asset==='number'?'Cesium ion asset '+report.asset:'Identical standalone GLB · '+report.asset;
el('method').textContent=report.method;
el('hardware').textContent=report.results[0].gpu+' · '+report.userAgent+' · DPR '+report.dpr;
function layout(){
  const r=report.results.find(r=>r.name===el('pose').value), mode=el('layout').value, scale=el('scale').value;
  el('stage').dataset.layout=mode;el('stage').style.display=mode==='pair'?'none':'block';el('pair').style.display=mode==='pair'?'flex':'none';
  el('stage').style.width=scale==='fit'?'100%':r.width*Number(scale)+'px';el('stage').style.maxWidth=scale==='fit'?'1200px':'none';
  for(const figure of el('pair').children){figure.style.flex=scale==='fit'?'1':'0 0 '+r.width*Number(scale)+'px'}
  el('wipe-control').style.display=mode==='wipe'?'flex':'none';
  el('native').style.clipPath=mode==='wipe'?'inset(0 '+(100-Number(el('wipe').value))+'% 0 0)':'none';
  el('divider').style.left=el('wipe').value+'%';el('percent').textContent=el('wipe').value+'%';
}
function show(){
  const r=report.results.find(r=>r.name===el('pose').value);
  el('native').src=el('pair-native').src=r.nativeImage;el('reference').src=el('pair-reference').src=r.referenceImage;
  const verified=report.version>=2, hasGpu=r.native.timing.gpu&&r.cesium.timing.gpu;
  const a=hasGpu?r.native.timing.gpu:r.native.timing.completed,b=hasGpu?r.cesium.timing.gpu:r.cesium.timing.completed;
  el('timing').textContent=(hasGpu?'GPU frame work':verified?'Frame with completion probe':'Historical render + finish wall time (GPU completion unverified)')+' median / p95: iTwin.js '+a.medianMs.toFixed(2)+' / '+a.p95Ms.toFixed(2)+' ms · CesiumJS '+b.medianMs.toFixed(2)+' / '+b.p95Ms.toFixed(2)+' ms';
  el('completion').textContent=verified?'Render-call wall median: '+r.native.timing.cpu.medianMs.toFixed(2)+' / '+r.cesium.timing.cpu.medianMs.toFixed(2)+' ms. Frame with one-pixel completion probe: '+r.native.timing.completed.medianMs.toFixed(2)+' / '+r.cesium.timing.completed.medianMs.toFixed(2)+' ms (iTwin.js / CesiumJS). The probe adds synchronization/readback cost.':'These older wall timings were superseded by GPU timer and completion-probe measurements.';
  el('counts').textContent='Drawn splats: iTwin.js '+number(r.native.draw?.drawnInstances)+' · CesiumJS '+number(r.cesium.splats)+'. Selected tiles: '+number(r.native.selectedTiles)+' / '+number(r.cesium.selectedTiles)+'.';
  el('settings').textContent=r.width+' × '+r.height+' pixels · Native tile-size modifier '+report.nativeTileSizeModifier+' · CesiumJS '+report.cesiumVersion+' SSE '+r.cesium.sse;
  el('metrics').textContent='Foreground overlap '+(r.foregroundOverlap*100).toFixed(1)+'%; RGB RMS '+r.colorRms.toFixed(1)+'/255. Observations for comparison, without a pass/fail threshold.';
  layout();
}
el('pose').addEventListener('change',show);for(const id of ['layout','scale'])el(id).addEventListener('change',layout);el('wipe').addEventListener('input',layout);show();
</script></html>`;
}
