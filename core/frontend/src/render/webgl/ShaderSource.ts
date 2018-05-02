/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ShaderBuilder, FragmentShaderBuilder, VariableType } from "./ShaderBuilder";
import { RenderPass } from "./RenderFlags";

/** Snippets of glsl code used to assemble ShaderBuilders */
export namespace ShaderSource {
  export const decodeUInt16 =
    `float decodeUInt16(vec2 v) {
      v = v * vec2(1.0, 256.0); // v.y <<= 8
      return dot(v, vec2(1.0)); // v.x+v.y => v.x | v.y
    }`;

  export const decodeUInt32 =
    `float decodeUInt32(vec3 v) {
      v = v * vec3(1.0, 256.0, 256.0*256.0); // v.y <<= 8; v.z <<= 16
      return dot(v, vec3(1.0)); // v.x+v.y+v.z => v.x | v.y | v.z
    }`;

  /**
   * Adds a uniform holding the current render pass and a set of kRenderPass_* constants
   * uniform float u_renderPass
   */
  export function addRenderPass(builder: ShaderBuilder) {
    builder.addUniform("u_renderPass", VariableType.Float, (prog) => {
        prog.addProgramUniform("u_renderPass", (uniform, params) => {
          let renderPass = params.renderPass;
          if (RenderPass.HiddenEdge === renderPass) {
            renderPass = RenderPass.OpaqueGeneral; // no distinction from shader POV...
          }

          uniform.setUniform1f(renderPass);
        });
      });

    builder.addGlobal("kRenderPass_Background", VariableType.Float, "0.0", true);
    builder.addGlobal("kRenderPass_OpaqueLinear", VariableType.Float, "1.0", true);
    builder.addGlobal("kRenderPass_OpaquePlanar", VariableType.Float, "2.0", true);
    builder.addGlobal("kRenderPass_OpaqueGeneral", VariableType.Float, "3.0", true);
    builder.addGlobal("kRenderPass_Translucent", VariableType.Float, "4.0", true);
    builder.addGlobal("kRenderPass_HiddenEdge", VariableType.Float, "5.0", true);
    builder.addGlobal("kRenderPass_Hilite", VariableType.Float, "6.0", true);
    builder.addGlobal("kRenderPass_WorldOverlay", VariableType.Float, "7.0", true);
    builder.addGlobal("kRenderPass_ViewOverlay", VariableType.Float, "8.0", true);
  }

  /** Components specific to vertex shaders. */
  export namespace Vertex {
    export const unquantizePosition =
      `vec4 unquantizePosition(vec3 pos, vec3 origin, vec3 scale) {
        return vec4(origin + scale * pos, 1.0);
      }`;

    export const unquantizeVertexPosition =
      `vec4 unquantizeVertexPosition(vec3 pos, vec3 origin, vec3 scale) {
        return unquantizePosition(pos, origin, scale);
      }`;

    export const initializeVertLUTCoords =
      `g_vertexLUTIndex = decodeUInt32(a_pos);
       g_vertexBaseCoords = compute_vert_coords(g_vertexLUTIndex);`;

    export const unquantizeVertexPositionFromLUT =
      `vec4 unquantizeVertexPosition(vec3 encodedIndex, vec3 origin, vec3 scale) {
        // Need to read 2 rgba values to obtain 6 16-bit integers for position
        vec2 tc = g_vertexBaseCoords;
        vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
        tc.x += g_vert_stepX;
        vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
        tc.x += g_vert_stepX;
        g_featureIndexCoords = tc;

        vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));

        // Might as well decode the color index since we already read it...may not end up being used.
        // (NOTE = If this is a textured mesh, the normal is stored where the color index would otherwise be...)
        g_vertexData2 = enc2.zw;

        return unquantizePosition(qpos, origin, scale);
      }`;

    export const unquantize3d =
      `vec3 unquantize3d(vec3 qpos, vec3 origin, vec3 scale) { return origin + scale * qpos; }`;

    export const unquantize2d =
     `// params.xy = origin. params.zw = scale.
     vec2 unquantize2d(vec2 qpos, vec4 params) { return params.xy + params.zw * qpos; }`;

    export const computeTexCoord = `return isSurfaceBitSet(kSurfaceBit_HasTexture) ? unquantize2d(a_texCoord, u_qTexCoordParams)  = vec2(0.0);`;

    export const earlyDiscard =
      `if (checkForEarlyDiscard(rawPosition)) {
        // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
        // Also place it outside NDC range (for GL_POINTS)
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
      }`;

    export const discard =
      `if (checkForDiscard()) {
        // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
        // Also place it outside NDC range (for GL_POINTS)
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
      }`;

    export const computeLineWeight = `float ComputeLineWeight() { return u_lineWeight; }`;

    export const computeLineCode = `float ComputeLineCode() { return u_lineCode; }`;

    export const modelToWindowCoordinates =
      `vec4 modelToWindowCoordinates(vec4 position, vec4 next) {
        if (kRenderPass_ViewOverlay == u_renderPass || kRenderPass_Background == u_renderPass) {
          vec4 q = u_mvp * position;
          q.xyz /= q.w;
          q.xyz = (u_viewportTransformation * vec4(q.xyz, 1.0)).xyz;
          return q;
        }

        // Negative values are in front of the camera (visible).
        float s_maxZ = -u_frustum.x; // use -near (front) plane for segment drop test since u_frustum's near & far are pos.
        vec4  q = u_mv * position; // eye coordinates.
        vec4  n = u_mv * next;

        if (q.z > s_maxZ) {
          if (n.z > s_maxZ) {
            return vec4(0.0, 0.0,  1.0, 0.0);   // Entire segment behind eye.
          }

          float t = (s_maxZ - q.z) / (n.z - q.z);

          q.x += t * (n.x - q.x);
          q.y += t * (n.y - q.y);
          q.z = s_maxZ;                       // q.z + (s_maxZ - q.z) * (s_maxZ - q.z) / n.z - q.z
        }

        q = u_proj * q;
        q.xyz /= q.w; // normalized device coords
        q.xyz = (u_viewportTransformation * vec4(q.xyz, 1.0)).xyz; // window coords
        return q;
      }`;

    export const metersPerPixel =
     `float metersPerPixel(vec4 posEye) {
        if (kRenderPass_Background == u_renderPass || kRenderPass_ViewOverlay == u_renderPass)
          return 1.0;

        float width = u_viewport.z;
        float height = u_viewport.w;
        float pixelWidth;
        float pixelHeight;

        float top = u_frustumPlanes.x;
        float bottom = u_frustumPlanes.y;
        float left = u_frustumPlanes.z;
        float right = u_frustumPlanes.w;

        if (kFrustumType_Perspective == u_frustum.z) {
          float distanceToPixel = -posEye.z;
          float inverseNear = 1.0 / u_frustum.x;
          float tanTheta = top * inverseNear;
          pixelHeight = 2.0 * distanceToPixel * tanTheta / height;
          tanTheta = right * inverseNear;
          pixelWidth = 2.0 * distanceToPixel * tanTheta / width;
        } else {
          float frustumWidth = right - left;
          float frustumHeight = top - bottom;
          pixelWidth = frustumWidth / width;
          pixelHeight = frustumHeight / height;
        }

        return max(pixelWidth, pixelHeight);
     }`;
  }

  /** Components specific to fragment shaders */
  export namespace Fragment {
    const windowCoordsToTexCoords = `vec2 windowCoordsToTexCoords(vec2 wc) { return wc * u_invScreenSize; }`;

    export function addWindowToTexCoords(frag: FragmentShaderBuilder) {
      frag.addFunction(windowCoordsToTexCoords);
      frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
        prog.addProgramUniform("u_invScreenSize", (uniform, params) => {
          const rect = params.target.viewRect;
          const invScreenSize = [ 1.0 / rect.width, 1.0 / rect.height ];
          uniform.setUniform2fv(invScreenSize);
        });
      });
    }
  }
}
