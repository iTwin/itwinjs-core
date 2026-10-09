/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const linearFromDisplay = `
vec3 linearFromDisplay(vec3 color) {
  return mix(color/12.92,pow((max(color,vec3(0))+0.055)/1.055,vec3(2.4)),greaterThan(color,vec3(0.04045)));
}`;

/** Private shaders for the sorted Gaussian pass. Metadata rows describe visible tile instances.
 * @internal
 */
export function gaussianSplatVertex(pick: boolean): string {
  return `#version 300 es
#define PICK_PASS ${pick ? 1 : 0}
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp usampler2DArray;
layout(location=0) in uvec2 a_instance;
uniform usampler2DArray u_splats;
uniform sampler2DArray u_auxiliary;
uniform sampler2D u_tiles;
uniform mat4 u_projection;
uniform vec2 u_viewport;
uniform vec3 u_frustum;
uniform vec2 u_logZ;
uniform bool u_useLogZ;
const bool u_pick = ${pick ? "true" : "false"};
out vec2 v_gaussian;
out vec3 v_eye;
flat out vec4 v_color;
#if PICK_PASS
flat out vec4 v_feature;
#endif
flat out ivec2 v_clip;
flat out vec4 v_inside;
flat out vec4 v_outside;
flat out int v_space;
${linearFromDisplay}

vec4 metadata(int n) { return texelFetch(u_tiles, ivec2(n, int(a_instance.y)), 0); }
uvec4 splat(int n) {
  int page = int(a_instance.x) / 16384;
  int texel = (int(a_instance.x) % 16384) * 2 + n;
  return texelFetch(u_splats, ivec3(texel % 256, texel / 256, page), 0);
}
float auxiliary(int offset, int stride, int n) {
  int localIndex = int(a_instance.x) - int(metadata(12).x);
  int index = offset + localIndex * stride + n;
  int texel = index / 4;
  return texelFetch(u_auxiliary, ivec3(texel % 256, (texel / 256) % 128, texel / 32768), 0)[index % 4];
}
vec3 sh(int n) {
  vec4 storage = metadata(11);
  return vec3(auxiliary(int(storage.y),int(storage.z),n*3), auxiliary(int(storage.y),int(storage.z),n*3+1), auxiliary(int(storage.y),int(storage.z),n*3+2));
}
vec3 lighting(vec3 d, int degree) {
  float x=d.x, y=d.y, z=d.z;
  float xx=x*x, yy=y*y, zz=z*z;
  vec3 color = degree==0 ? vec3(0.0) : vec3(0.5) + 0.2820947917738781 * sh(0);
  if (degree > 0)
    color += -0.4886025119029199*y*sh(1) + 0.4886025119029199*z*sh(2) - 0.4886025119029199*x*sh(3);
  if (degree > 1)
    color += 1.092548430592079*x*y*sh(4) - 1.092548430592079*y*z*sh(5) +
      0.3153915652525200*(2.0*zz-xx-yy)*sh(6) - 1.092548430592079*x*z*sh(7) +
      0.5462742152960395*(xx-yy)*sh(8);
  if (degree > 2)
    color += -0.5900435899266435*y*(3.0*xx-yy)*sh(9) + 2.890611442640554*x*y*z*sh(10) -
      0.4570457994644657*y*(4.0*zz-xx-yy)*sh(11) + 0.3731763325901154*z*(2.0*zz-3.0*xx-3.0*yy)*sh(12) -
      0.4570457994644657*x*(4.0*zz-xx-yy)*sh(13) + 1.445305721320277*z*(xx-yy)*sh(14) -
      0.5900435899266435*x*(xx-3.0*yy)*sh(15);
  return max(color, vec3(0.0));
}
void main() {
  uvec4 base = splat(0), packed = splat(1);
  vec3 position = uintBitsToFloat(base.xyz);
  vec2 h0=unpackHalf2x16(packed.x), h1=unpackHalf2x16(packed.y), h2=unpackHalf2x16(packed.z);
  vec4 rgba=vec4(packed.w & 255u,(packed.w>>8u)&255u,(packed.w>>16u)&255u,packed.w>>24u)/255.0;
  int flags=int(metadata(11).w);
  int degree=int(metadata(4).z);
  if ((flags & 2)!=0) {
    int start=int(metadata(12).z);
    rgba=vec4(auxiliary(start,4,0),auxiliary(start,4,1),auxiliary(start,4,2),auxiliary(start,4,3));
  }
  vec4 mean=vec4(position,rgba.a);
  vec4 c0=vec4(h0,h1)*exp2(uintBitsToFloat(base.w))*0.25;
  vec2 c1=h2*exp2(uintBitsToFloat(base.w))*0.25;
  if ((flags & 1)!=0) {
    int start=int(metadata(12).y);
    c0=vec4(auxiliary(start,6,0),auxiliary(start,6,1),auxiliary(start,6,2),auxiliary(start,6,3));
    c1=vec2(auxiliary(start,6,4),auxiliary(start,6,5));
  }
  vec4 r0=metadata(0), r1=metadata(1), r2=metadata(2);
  mat3 a = transpose(mat3(r0.xyz, r1.xyz, r2.xyz));
  vec3 eye = a*mean.xyz + vec3(r0.w,r1.w,r2.w);
  vec4 clip = u_projection * vec4(eye, 1.0);
  v_gaussian=vec2(0.0); v_eye=eye; v_color=vec4(0.0);
#if PICK_PASS
  v_feature=metadata(3);
#endif
  vec4 options=metadata(4);
  v_clip=ivec2(options.xy); v_space=int(options.w);
  v_inside=metadata(6); v_outside=metadata(7);
  // Like Cesium, reject centers outside a padded screen boundary before projecting
  // covariance. Near the camera plane, off-screen centers can otherwise expand
  // into enormous ellipses that cover the entire view.
  if (eye.z >= -u_frustum.x || eye.z <= -u_frustum.y || clip.w <= 0.0 ||
      abs(clip.x) > 1.2*clip.w || abs(clip.y) > 1.2*clip.w) {
    gl_Position=vec4(2.0,2.0,2.0,1.0);
    return;
  }
  mat3 covariance = mat3(c0.x,c0.y,c0.z, c0.y,c0.w,c1.x, c0.z,c1.x,c1.y);
  covariance = a * covariance * transpose(a);
  vec3 rowX=vec3(u_projection[0][0],u_projection[1][0],u_projection[2][0]);
  vec3 rowY=vec3(u_projection[0][1],u_projection[1][1],u_projection[2][1]);
  vec3 rowW=vec3(u_projection[0][3],u_projection[1][3],u_projection[2][3]);
  vec3 jx=(rowX*clip.w-rowW*clip.x)*(0.5*u_viewport.x/(clip.w*clip.w));
  vec3 jy=(rowY*clip.w-rowW*clip.y)*(0.5*u_viewport.y/(clip.w*clip.w));
  float xx=dot(jx,covariance*jx)+0.3, xy=dot(jx,covariance*jy), yy=dot(jy,covariance*jy)+0.3;
  float delta=length(vec2(0.5*(xx-yy),xy));
  float middle=0.5*(xx+yy);
  vec2 e0=abs(xy)>1e-8 ? normalize(vec2(xy,middle+delta-xx)) : (xx>=yy ? vec2(1,0) : vec2(0,1));
  vec2 e1=vec2(-e0.y,e0.x);
  vec4 appearance=metadata(5);
  float compensation = metadata(11).x>0.0 ? sqrt(max(0.0,((xx-0.3)*(yy-0.3)-xy*xy)/(xx*yy-xy*xy))) : 1.0;
  float peakAlpha=mean.w*appearance.x*compensation;
  float threshold=u_pick ? 0.1 : 1.0/255.0;
  if (peakAlpha<threshold) {
    gl_Position=vec4(2.0,2.0,2.0,1.0);
    return;
  }
  // Bound only fragments already rejected by the existing alpha threshold. Keep a
  // small margin around the analytic radius for interpolation/threshold rounding.
  float radius=min(3.0,sqrt(max(0.0,2.0*log(peakAlpha/threshold)))+0.001);
  const vec2 corners[4]=vec2[4](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(1,1));
  v_gaussian=radius*corners[gl_VertexID];
  // Cesium's 1024-unit axis cap becomes 512 pixels after the NDC-to-pixel
  // conversion. Bound our three-sigma semi-axes to the same screen extent.
  // Use the same sigma limit in color and pick passes despite their different
  // alpha thresholds, so picking still describes the displayed Gaussian.
  vec2 sigma=min(sqrt(max(vec2(0.0),vec2(middle+delta,middle-delta))),vec2(512.0/3.0));
  vec2 pixels=e0*sigma.x*v_gaussian.x + e1*sigma.y*v_gaussian.y;
  gl_Position=clip;
  gl_Position.xy += 2.0*pixels/u_viewport*clip.w;
  // The quad faces the camera at the mean's depth, so log depth is constant across it. Writing it
  // here instead of gl_FragDepth keeps early depth rejection and tile-GPU depth optimizations.
  if (u_useLogZ) {
    float depth=u_logZ.x==0.0 ? -eye.z/u_logZ.y : log(-eye.z*u_logZ.x)/u_logZ.y;
    gl_Position.z=(2.0*clamp(depth,0.0,1.0)-1.0)*clip.w;
  }
  // The approximate picking/clipping surface is the camera-facing plane through the mean.
  v_eye.xy += 2.0*pixels/u_viewport*clip.w/vec2(u_projection[0][0],u_projection[1][1]);
  mat3 inverseView=transpose(mat3(metadata(8).xyz,metadata(9).xyz,metadata(10).xyz));
  vec3 direction=normalize(inverseView*(u_frustum.z==2.0 ? eye : vec3(0,0,-1)));
  vec3 color=appearance.y>=0.0 ? appearance.yzw : (degree==0 ? max(rgba.rgb,vec3(0.0)) : lighting(direction,degree));
  if (appearance.y>=0.0 && v_space==1) color=linearFromDisplay(color);
  v_color=vec4(color, peakAlpha);
}`;
}

/** @internal */
export function gaussianSplatFragment(pick: boolean): string {
  return `#version 300 es
#define PICK_PASS ${pick ? 1 : 0}
precision highp float;
precision highp int;
uniform sampler2D u_planes;
uniform vec3 u_frustum;
const bool u_pick = ${pick ? "true" : "false"};
uniform int u_space;
in vec2 v_gaussian;
in vec3 v_eye;
flat in vec4 v_color;
#if PICK_PASS
flat in vec4 v_feature;
#endif
flat in ivec2 v_clip;
flat in vec4 v_inside;
flat in vec4 v_outside;
flat in int v_space;
layout(location=0) out vec4 out_color;
#if PICK_PASS
layout(location=1) out vec4 out_feature;
layout(location=2) out vec4 out_depth;
#endif
${linearFromDisplay}
#if PICK_PASS
vec3 encodeDepth(float d) {
  vec3 enc=fract(vec3(1.0,255.0,65025.0)*min(d,16777215.0/16777216.0));
  enc.xy-=enc.yz/255.0;
  return enc;
}
#endif
void main() {
#if PICK_PASS
  if (v_feature==vec4(0.0)) discard;
#endif
  if (!u_pick && v_space!=u_space) discard;
  float distance2=dot(v_gaussian,v_gaussian);
  float alpha=min(0.99,v_color.a*exp(-0.5*distance2));
  if (distance2>9.0 || alpha<(u_pick ? 0.1 : 1.0/255.0)) discard;
  vec3 color=v_color.rgb;
  if (v_clip.y>0) {
    int sets=1, rejected=0;
    bool outside=false, failed=false;
    for (int i=v_clip.x; i<v_clip.x+v_clip.y; i++) {
      vec4 plane=texelFetch(u_planes,ivec2(0,i),0);
      if (plane.x==2.0) {
        if (rejected+int(outside)==sets) { failed=true; break; }
        sets=1; rejected=0; outside=false;
      } else if (plane.xyz==vec3(0)) {
        rejected+=int(outside); sets++; outside=false;
      } else if (dot(vec4(v_eye,1),plane)<0.0) {
        outside=true;
      }
    }
    failed = failed || rejected+int(outside)==sets;
    if (failed) {
      if (v_outside.a==0.0) discard;
      color=v_space==1 ? linearFromDisplay(v_outside.rgb) : v_outside.rgb;
    } else if (v_inside.a>0.0) {
      color=v_space==1 ? linearFromDisplay(v_inside.rgb) : v_inside.rgb;
    }
  }
  out_color=vec4(color*alpha,alpha);
#if PICK_PASS
  out_feature=v_feature;
  out_depth=vec4(3.0/16.0,encodeDepth(1.0-(-v_eye.z-u_frustum.x)/(u_frustum.y-u_frustum.x)));
#endif
}`;
}

/** @internal */
export const gaussianSplatCompositeVertex = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 xy=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  v_uv=xy;
  gl_Position=vec4(xy*2.0-1.0,0.0,1.0);
}`;

/** @internal */
export const gaussianSplatCompositeFragment = `#version 300 es
precision highp float;
uniform sampler2D u_color;
uniform int u_mode;
in vec2 v_uv;
layout(location=0) out vec4 out_color;
${linearFromDisplay}
vec3 display(vec3 linear) {
  return mix(12.92*linear,1.055*pow(max(linear,vec3(0)),vec3(1.0/2.4))-0.055,greaterThan(linear,vec3(0.0031308)));
}
void main() {
  vec4 color=texture(u_color,v_uv);
  // Modes 0/1 initialize the trained-space field from the opaque display background.
  // Modes 2/3 clamp the composed field before its optional display transfer function.
  if (u_mode==1) color.rgb=linearFromDisplay(color.rgb);
  if (u_mode>=2) color.rgb=clamp(color.rgb,vec3(0),vec3(1));
  if (u_mode==3) color.rgb=display(color.rgb);
  out_color=vec4(color.rgb,1.0);
}`;
