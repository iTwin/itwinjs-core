/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* The Gaussian splat shaders are written as whole sources rather than assembled from ProgramBuilder components. The component
 * pipeline is built around a vertex attribute position (quantized or from a lookup table), feature overrides and materials; a
 * splat instead resolves its record through a page table, projects a covariance and culls itself at several points, which would
 * have to be split across components that do not match their names. The sources reuse the native clipping GLSL, and the
 * programs are ordinary ShaderPrograms in the render system's Techniques (see GaussianSplatPrograms).
 */

import { gaussianSplatCodes, gaussianSplatShFractions } from "../../GaussianSplatData";
import { gaussianSplatHiddenTile, gaussianSplatPageTableWidth } from "../../GaussianSplatInstances";
import { gaussianSplatsPerPage } from "../../GaussianSplatSort";
import { applyClipPlanesLoopBody, calcClipPlaneDist, getClipPlaneFloat } from "./Clipping";

/** A number as a GLSL float literal. */
function glslFloat(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

/** Screen-space dilation of the projected covariance, in square pixels. */
const dilation = glslFloat(0.3);
/** Largest projected one-sigma semi-axis, in CSS pixels: Cesium's 1024-unit axis cap is 512 pixels of its drawing buffer,
 * which by default has CSS resolution; three sigma within it. The shader receives it in device pixels (`u_maxSigma`).
 * @internal
 */
export const gaussianSplatMaxSigmaCssPixels = 512 / 3;
/** Centers beyond this multiple of clip w are rejected before projecting covariance. */
const centerBound = glslFloat(1.2);
const maxAlpha = glslFloat(0.99);
const displayThreshold = glslFloat(1 / 255);
/** The compact layout's code scales (see GaussianSplatData). */
const scaleStep = glslFloat(gaussianSplatCodes.scaleStep);
const scaleOffset = glslFloat(gaussianSplatCodes.scaleOffset);
const colorZero = glslFloat(gaussianSplatCodes.colorZero);
const colorStep = glslFloat(gaussianSplatCodes.colorStep);
const opacityMax = glslFloat(gaussianSplatCodes.opacityMax);

/** The vertex shader of the splat technique. Each instance is one logical slot of the sorted order; the page table maps its
 * logical page to an atlas row and a visible tile row, whose metadata row describes the tile occurrence (see
 * gaussianSplatTileMetadata).
 * @param useLogZ The render system writes logarithmic depth.
 * @internal
 */
export function gaussianSplatVertex(useLogZ: boolean): string {
  return `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp usampler2DArray;
precision highp usampler2D;
layout(location=0) in uint a_instance;
uniform usampler2D u_pages;
uniform usampler2DArray u_splats;
uniform usampler2DArray u_auxiliary;
uniform sampler2D u_tiles;
uniform mat4 u_proj;
uniform vec2 u_viewport;
uniform vec3 u_frustum;
uniform vec2 u_logZ;
uniform float u_maxSigma;
// A position outside the clip volume: the instance's quad is not rasterized.
const vec4 culled = vec4(2.0,2.0,2.0,1.0);
out vec2 v_gaussian;
out vec3 v_eyeSpace;
flat out vec4 v_color;
flat out ivec2 v_clipPlanes;
flat out vec4 v_inside;
flat out vec4 v_outside;
flat out int v_space;

// Atlas slot, visible tile row and index within its tile of this instance, resolved through the page table at the start
// of main().
int atlasSlot, tileRow, tileIndex;
// Texel n of this instance's tile metadata row (see gaussianSplatTileMetadata).
vec4 metadata(int n) { return texelFetch(u_tiles, ivec2(n, tileRow), 0); }
// Texel n of this instance's splat. An atlas layer is 256 texels wide and holds 16384 splats of 2 texels each.
uvec4 splat(int n) {
  int layer = atlasSlot / 16384;
  int texel = (atlasSlot % 16384) * 2 + n;
  return texelFetch(u_splats, ivec3(texel % 256, texel / 256, layer), 0);
}
// Higher SH bands (see GaussianSplatData.sh): one byte per coefficient, then one exponent byte per band;
// coefficient = (byte - 128) * 2^(exponent/8 - 24). The tile stores its texel count per splat.
uvec4 shTexels[3];
uint shRaw(int k) { return (shTexels[k/16][(k/4)%4] >> uint((k%4)*8)) & 255u; }
const float shFractions[8]=float[8](${gaussianSplatShFractions.join(",")});
// A power of two built from its bits (exact, unlike exp2) times a float constant, as decodeGaussianSplatShScale.
float shScale(int k) { uint e=shRaw(k); return intBitsToFloat(int((e >> 3u) + 103u) << 23) * shFractions[e & 7u]; }
vec3 sh(int n) { int k=(n-1)*3; return vec3(float(shRaw(k)), float(shRaw(k+1)), float(shRaw(k+2))) - 128.0; }
vec3 lighting(vec3 direction, int degree, vec3 base, int firstTexel, int texels) {
  float x=direction.x, y=direction.y, z=direction.z;
  float xx=x*x, yy=y*y, zz=z*z;
  for (int i=0; i<3; i++) {
    int texel=firstTexel + i;
    shTexels[i]=i<texels ? texelFetch(u_auxiliary, ivec3(texel % 256, (texel / 256) % 128, texel / 32768), 0) : uvec4(0u);
  }
  int exponents=((degree+1)*(degree+1)-1)*3;
  vec3 color = base;
  if (degree > 0)
    color += (-0.4886025119029199*y*sh(1) + 0.4886025119029199*z*sh(2) - 0.4886025119029199*x*sh(3)) * shScale(exponents);
  if (degree > 1)
    color += (1.092548430592079*x*y*sh(4) - 1.092548430592079*y*z*sh(5) +
      0.3153915652525200*(2.0*zz-xx-yy)*sh(6) - 1.092548430592079*x*z*sh(7) +
      0.5462742152960395*(xx-yy)*sh(8)) * shScale(exponents+1);
  if (degree > 2)
    color += (-0.5900435899266435*y*(3.0*xx-yy)*sh(9) + 2.890611442640554*x*y*z*sh(10) -
      0.4570457994644657*y*(4.0*zz-xx-yy)*sh(11) + 0.3731763325901154*z*(2.0*zz-3.0*xx-3.0*yy)*sh(12) -
      0.4570457994644657*x*(4.0*zz-xx-yy)*sh(13) + 1.445305721320277*z*(xx-yy)*sh(14) -
      0.5900435899266435*x*(xx-3.0*yy)*sh(15)) * shScale(exponents+2);
  return max(color, vec3(0.0));
}
void main() {
  uint logicalPage = a_instance / ${gaussianSplatsPerPage}u;
  uvec3 entry = texelFetch(u_pages, ivec2(int(logicalPage % ${gaussianSplatPageTableWidth}u), int(logicalPage / ${gaussianSplatPageTableWidth}u)), 0).xyz;
  if (entry.y == ${gaussianSplatHiddenTile}u) {
    // The sorted occurrence is not drawn this frame (culled, hidden or replaced).
    gl_Position=culled;
    return;
  }
  atlasSlot = int(entry.x * ${gaussianSplatsPerPage}u + a_instance % ${gaussianSplatsPerPage}u);
  tileRow = int(entry.y);
  tileIndex = int(entry.z * ${gaussianSplatsPerPage}u + a_instance % ${gaussianSplatsPerPage}u);
  // Compact layout (see GaussianSplatData): float32 mean, snorm16 xyzw rotation, 16-bit log scales,
  // 12-bit SPZ-grid DC color and 12-bit opacity.
  uvec4 t0 = splat(0), t1 = splat(1);
  vec4 mean=vec4(uintBitsToFloat(t0.xyz), float((t1.z >> 28u) | ((t1.w >> 24u) << 4u)) / ${opacityMax});
  // Antialiasing compensation is at most 1, so a splat below the alpha threshold before it cannot
  // pass after it: reject before projecting covariance. The exact test follows below.
  vec4 appearance=metadata(4);
  float threshold=${displayThreshold};
  if (mean.w*appearance.x<threshold) {
    gl_Position=culled;
    return;
  }
  // x: first clip plane; y: clip plane count; z: SH degree; w: trained color space.
  vec4 options=metadata(3);
  int degree=int(options.z);
  // Rows of the affine transform from the tile's relative means to eye coordinates.
  vec4 r0=metadata(0), r1=metadata(1), r2=metadata(2);
  mat3 modelView = transpose(mat3(r0.xyz, r1.xyz, r2.xyz));
  vec3 eye = modelView*mean.xyz + vec3(r0.w,r1.w,r2.w);
  vec4 clip = u_proj * vec4(eye, 1.0);
  v_gaussian=vec2(0.0); v_eyeSpace=eye; v_color=vec4(0.0);
  v_clipPlanes=ivec2(options.x, options.x + options.y); v_space=int(options.w);
  v_inside=metadata(5); v_outside=metadata(6);
  // Like Cesium, reject centers outside a padded screen boundary before projecting
  // covariance. Near the camera plane, off-screen centers can otherwise expand
  // into enormous ellipses that cover the entire view.
  if (eye.z >= -u_frustum.x || eye.z <= -u_frustum.y || clip.w <= 0.0 ||
      abs(clip.x) > ${centerBound}*clip.w || abs(clip.y) > ${centerBound}*clip.w) {
    gl_Position=culled;
    return;
  }
  // Covariance = (M R S)(M R S)^T, M the model-view rotation, is never formed: project the columns of M R S directly.
  vec4 q=vec4(unpackSnorm2x16(t0.w), unpackSnorm2x16(t1.x));
  q*=inversesqrt(max(dot(q,q),1e-20));
  vec3 scale=exp(vec3(float(t1.y & 65535u), float(t1.y >> 16u), float(t1.z & 65535u))/${scaleStep} - ${scaleOffset});
  float qxx=q.x*q.x, qyy=q.y*q.y, qzz=q.z*q.z, qxy=q.x*q.y, qxz=q.x*q.z, qyz=q.y*q.z, qwx=q.w*q.x, qwy=q.w*q.y, qwz=q.w*q.z;
  mat3 m = modelView * mat3(
    vec3(1.0-2.0*(qyy+qzz), 2.0*(qxy+qwz), 2.0*(qxz-qwy))*scale.x,
    vec3(2.0*(qxy-qwz), 1.0-2.0*(qxx+qzz), 2.0*(qyz+qwx))*scale.y,
    vec3(2.0*(qxz+qwy), 2.0*(qyz-qwx), 1.0-2.0*(qxx+qyy))*scale.z);
  vec3 rowX=vec3(u_proj[0][0],u_proj[1][0],u_proj[2][0]);
  vec3 rowY=vec3(u_proj[0][1],u_proj[1][1],u_proj[2][1]);
  vec3 rowW=vec3(u_proj[0][3],u_proj[1][3],u_proj[2][3]);
  // Rows of the Jacobian of the projection to pixels at the mean.
  vec3 jx=(rowX*clip.w-rowW*clip.x)*(0.5*u_viewport.x/(clip.w*clip.w));
  vec3 jy=(rowY*clip.w-rowW*clip.y)*(0.5*u_viewport.y/(clip.w*clip.w));
  vec3 u=jx*m, w=jy*m;
  float xx=dot(u,u)+${dilation}, xy=dot(u,w), yy=dot(w,w)+${dilation};
  // Eigenvectors and eigenvalues (middle +- delta) of the projected 2D covariance.
  float delta=length(vec2(0.5*(xx-yy),xy));
  float middle=0.5*(xx+yy);
  vec2 e0=abs(xy)>1e-8 ? normalize(vec2(xy,middle+delta-xx)) : (xx>=yy ? vec2(1,0) : vec2(0,1));
  vec2 e1=vec2(-e0.y,e0.x);
  // x: antialiased; y: the tile's first SH texel; z: SH texels per splat.
  vec4 storage=metadata(10);
  float compensation = storage.x>0.0 ? sqrt(max(0.0,((xx-${dilation})*(yy-${dilation})-xy*xy)/(xx*yy-xy*xy))) : 1.0;
  float peakAlpha=mean.w*appearance.x*compensation;
  if (peakAlpha<threshold) {
    gl_Position=culled;
    return;
  }
  // Bound only fragments already rejected by the existing alpha threshold. Keep a
  // small margin around the analytic radius for interpolation/threshold rounding.
  float radius=min(3.0,sqrt(max(0.0,2.0*log(peakAlpha/threshold)))+0.001);
  const vec2 corners[4]=vec2[4](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(1,1));
  v_gaussian=radius*corners[gl_VertexID];
  // Cesium's 1024-unit axis cap becomes 512 pixels after the NDC-to-pixel
  // conversion. Bound our three-sigma semi-axes to the same screen extent.
  vec2 sigma=min(sqrt(max(vec2(0.0),vec2(middle+delta,middle-delta))),vec2(u_maxSigma));
  vec2 pixels=e0*sigma.x*v_gaussian.x + e1*sigma.y*v_gaussian.y;
  gl_Position=clip;
  gl_Position.xy += 2.0*pixels/u_viewport*clip.w;${useLogZ ? `
  // The quad faces the camera at the mean's depth, so log depth is constant across it. Writing it
  // here instead of gl_FragDepth keeps early depth rejection and tile-GPU depth optimizations.
  float depth=u_logZ.x==0.0 ? -eye.z/u_logZ.y : log(-eye.z*u_logZ.x)/u_logZ.y;
  gl_Position.z=(2.0*clamp(depth,0.0,1.0)-1.0)*clip.w;` : ""}
  // The approximate clipping surface is the camera-facing plane through the mean.
  v_eyeSpace.xy += 2.0*pixels/u_viewport*clip.w/vec2(u_proj[0][0],u_proj[1][1]);
  mat3 inverseView=transpose(mat3(metadata(7).xyz,metadata(8).xyz,metadata(9).xyz));
  vec3 direction=normalize(inverseView*(u_frustum.z==2.0 ? eye : vec3(0,0,-1)));
  vec3 base=0.5+0.2820947917738781*(vec3(float((t1.z >> 16u) & 4095u), float(t1.w & 4095u), float((t1.w >> 12u) & 4095u))-${colorZero})/${colorStep};
  // An override color is stored in the tile's trained color space.
  vec3 color=appearance.y>=0.0 ? appearance.yzw : (degree==0 ? max(base,vec3(0.0)) : lighting(direction,degree,base,
    int(storage.y) + tileIndex * int(storage.z), int(storage.z)));
  v_color=vec4(color, peakAlpha);
}`;
}

/** The fragment shader of the splat technique: the Gaussian falloff of the projected ellipse, premultiplied, clipped as the
 * native renderer clips (see Clipping.ts). Clip colors are stored in the tile's trained color space.
 * @internal
 */
export function gaussianSplatFragment(): string {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D s_clipSampler;
uniform int u_space;
in vec2 v_gaussian;
in vec3 v_eyeSpace;
flat in vec4 v_color;
flat in ivec2 v_clipPlanes;
flat in vec4 v_inside;
flat in vec4 v_outside;
flat in int v_space;
layout(location=0) out vec4 out_color;
${getClipPlaneFloat}${calcClipPlaneDist}
bool isClipped() {
  int numPlaneSets = 1;
  int numSetsClippedBy = 0;
  bool clippedByCurrentPlaneSet = false;
  for (int i = v_clipPlanes.x; i < v_clipPlanes.y; i++) {${applyClipPlanesLoopBody}  }

  numSetsClippedBy += int(clippedByCurrentPlaneSet);
  return numSetsClippedBy == numPlaneSets;
}
void main() {
  // Splats of another trained color space are discarded here rather than culled in the vertex shader. Culling them there
  // measured about 7% more GPU time at Redmond's detail pose on Apple M4 Pro (ANGLE on Metal; 12.1 instead of 11.3 ms), even
  // with no splat of another space; why is not known.
  if (v_space != u_space) discard;
  float distance2=dot(v_gaussian,v_gaussian);
  float alpha=min(${maxAlpha},v_color.a*exp(-0.5*distance2));
  if (distance2>9.0 || alpha<${displayThreshold}) discard;
  vec3 color=v_color.rgb;
  if (v_clipPlanes.x < v_clipPlanes.y) {
    if (isClipped()) {
      if (v_outside.a==0.0) discard;
      color=v_outside.rgb;
    } else if (v_inside.a>0.0) {
      color=v_inside.rgb;
    }
  }
  out_color=vec4(color*alpha,alpha);
}`;
}
