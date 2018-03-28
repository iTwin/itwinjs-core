/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { QPoint3dList, QPoint2dList, QParams3d, QParams2d } from "../QPoint";
import { XY, XYZ } from "@bentley/geometry-core";
import { PointUtil } from "../Utility";

export const enum ContextState {
  Uninitialized,
  Success,
  Error,
}

export class Capabilities {
  public maxTextureSize: number = 0;
  public nonPowerOf2Textures: boolean = false;
  public drawBuffers: boolean = false;
  public elementIndexUint: boolean = false;
  public textureFloat: boolean = false;
  public renderToFloat: boolean = false;
  public depthStencilTexture: boolean = false;
  public shaderTextureLOD: boolean = false;

  public init(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext("webgl");
    if (!gl) return false;

    const maxTS = gl.getParameter(WebGLRenderingContext.MAX_TEXTURE_SIZE);
    this.maxTextureSize = (maxTS & 0xffff); // >64kx64k textures?!

    // let maxVertUniforms: GLint = gl.GetParameter(WebGLRenderingContext.MAX_VERTEX_UNIFORM_VECTORS);
    // let maxFragUniforms: GLint = gl.GetParameter(WebGLRenderingContext.MAX_FRAGMENT_UNIFORM_VECTORS);
    // DEBUG_PRINTF("Max uniforms: vert: %d frag: %d", maxVertUniforms, maxFragUniforms);

    const extensions = gl.getSupportedExtensions();
    if (extensions) {
      for (const ext of extensions) {
        if (ext === "OES_texture_float")
          this.textureFloat = (gl.getExtension(ext) != null);
        else if (ext === "OES_element_index_uint")
          this.elementIndexUint = (gl.getExtension(ext) != null);
        else if (ext === "WEBGL_depth_texture")
          this.depthStencilTexture = (gl.getExtension(ext) != null);
        else if (ext === "WEBGL_draw_buffers")
          this.drawBuffers = (gl.getExtension(ext) != null);
        else if (ext === "EXT_color_buffer_float")
          this.renderToFloat = (gl.getExtension(ext) != null);
        else if (ext === "EXT_shader_texture_lod")
          this.shaderTextureLOD = (gl.getExtension(ext) != null);
      }
    }
    // Return based on required extensions.
    return this.depthStencilTexture && this.textureFloat && this.drawBuffers && this.elementIndexUint;
  }

  public GetMaxTextureSize(): number { return this.maxTextureSize; } // GL_MAX_TEXTURE_SIZE - e.g. returns 2048 if max texture dimensions are 2048x2048
  public SupportsNonPowerOf2Textures(): boolean { return this.nonPowerOf2Textures; } // WebGL does not have full support for power of 2 textures
  public SupportsDrawBuffers(): boolean { return this.drawBuffers; } // WEBGL_draw_buffers
  public Supports32BitElementIndex(): boolean { return this.elementIndexUint; } // OES_element_index_uint
  public SupportsTextureFloat(): boolean { return this.textureFloat; } // OES_texture_float
  public SupportsRenderToFloat(): boolean { return this.renderToFloat; } // EXT_color_buffer_float
  public SupportsDepthStencilTexture(): boolean { return this.depthStencilTexture; } // WEBGL_depth_texture - combined depth/stencil tex
  public SupportsShaderTextureLOD(): boolean { return this.shaderTextureLOD; } // WEBGL_depth_texture - combined depth/stencil tex
}

export class ViewportQuad {
  public readonly vertices = new QPoint3dList();
  public readonly indices = new Uint32Array(6);
  constructor() {
    const vertices = PointUtil.fromNumberArrays([-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]) as XYZ[];
    this.vertices.assign(vertices, QParams3d.fromNormalizedRange());
    this.indices[0] = 0;
    this.indices[1] = 1;
    this.indices[2] = 2;
    this.indices[3] = 0;
    this.indices[4] = 2;
    this.indices[5] = 3;
  }
}

export class TexturedViewportQuad extends ViewportQuad {
  public readonly textureUV = new QPoint2dList();
  constructor() {
    super();
    const textureUVPts = PointUtil.fromNumberArrays([0, 0], [1, 0], [1, 1], [0, 1]) as XY[];
    this.textureUV.assign(textureUVPts, QParams2d.fromDefaultRange());
  }
}
