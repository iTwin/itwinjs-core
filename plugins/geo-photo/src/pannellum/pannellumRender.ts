// This source code was derived from mpetroff/pannellum on github, and modified
// to convert it to more modern typescript. I dropped support for the cubemap
// and the multires types to simplify it, since we use it only for panoramic images.

/*
 * libpannellum - A WebGL and CSS 3D transform based Panorama Renderer
 * Copyright (c) 2012-2019 Matthew Petroff
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// tslint:disable:no-console

export interface PannellumRenderParameters {
  horizonPitch?: number;
  horizonRoll?: number;
  backgroundColor?: number[];
}

export interface RenderParams {
  roll?: number;
  returnImage?: boolean;
}

type CallbackFunc = (() => void);

// Panorama renderer.
export class PannellumRenderer {

  private _canvas: HTMLCanvasElement;

  private _gl: WebGLRenderingContext | null;
  private _program: WebGLProgram | null;
  private _vertexShader: WebGLShader | null;
  private _facetShader: WebGLShader | null;
  private _image: HTMLImageElement | undefined;

  private _world: HTMLDivElement | undefined;
  private _pose: number[] | undefined;
  private _dynamic: boolean | undefined;
  private _texCoordBuffer: WebGLBuffer | null;
  private _params: PannellumRenderParameters | undefined;
  public fadeImg: HTMLImageElement | undefined;

  constructor(private _container: HTMLElement) {
    this._gl = null;
    this._program = null;
    this._vertexShader = null;
    this._facetShader = null;
    this._texCoordBuffer = null;

    this._canvas = document.createElement("canvas");
    this._canvas.style.width = this._canvas.style.height = "100%";
    this._container.appendChild(this._canvas);

    this.resize();
    this.fadeImg = undefined;
  }

  /**
   * @param {HTMLImageElement} panoImage - Input image. Must be equirectangular panoramic image.
   * @param {string} imageType - The type of the image.
   * @param {boolean} dynamic - Whether or not the image is dynamic (e.g. video).
   * @param {number} horizAngleView - Initial horizontal angle of view.
   * @param {number} vertAngleView - Initial vertical angle of view.
   * @param {number} vertOffset - Initial vertical offset angle.
   * @param {function} callback - Load callback function.
   * @param {GlobalParams | undefined} params - Other configuration parameters (`horizonPitch`, `horizonRoll`, `backgroundColor`)
   */
  public init(panoImage: HTMLImageElement, _dynamic: boolean, horizAngleView: number, vertAngleView: number, vertOffset: number, callback: CallbackFunc, params: PannellumRenderParameters | undefined) {
    // Default argument for image type
    this._image = panoImage;
    this._dynamic = _dynamic;
    this._params = (undefined !== params) ? params : {};

    // Clear old data
    if (this._program && this._gl) {
      if (this._vertexShader) {
        this._gl.detachShader(this._program, this._vertexShader);
        this._gl.deleteShader(this._vertexShader);
      }
      if (this._facetShader) {
        this._gl.detachShader(this._program, this._facetShader);
        this._gl.deleteShader(this._facetShader);
      }
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, null);
      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, null);
      if ((this._program as any).texture)
        this._gl.deleteTexture((this._program as any).texture);

      if ((this._program as any).texture2)
        this._gl.deleteTexture((this._program as any).texture2);

      this._gl.deleteProgram(this._program);
      this._program = null;
    }
    this._pose = undefined;

    if (!this._gl)
      this._gl = this._canvas.getContext("experimental-webgl", { alpha: false, depth: false }) as WebGLRenderingContext | null;
    if (this._gl && this._gl.getError() === 1286)
      this.handleWebGLError1286();

    if (!this._gl) {
      console.log("Error: no WebGL support detected!");
      throw { type: "no webgl" };
    }

    // eliminate need for all the this.gl's from here
    const gl = this._gl;

    // Make sure image isn't too big
    const maxWidth = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (Math.max(panoImage.width / 2, panoImage.height) > maxWidth) {
      console.log("Error: The image is too big; it's " + panoImage.width + "px wide, " +
        "but this device's maximum supported size is " + (maxWidth * 2) + "px.");
      throw { type: "webgl size error", width: panoImage.width, maxWidth: maxWidth * 2 };
    }

    // Store horizon pitch and roll if applicable
    if ((this._params.horizonPitch !== undefined || this._params.horizonRoll !== undefined))
      this._pose = [this._params.horizonPitch === undefined ? 0 : this._params.horizonPitch,
        this._params.horizonRoll === undefined ? 0 : this._params.horizonRoll];

    // Set 2d texture binding
    const glBindType = gl.TEXTURE_2D;

    // Create viewport for entire canvas
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Check precision support
    if (gl.getShaderPrecisionFormat) {
      const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (precision && precision.precision < 1) {
        // `highp` precision not supported; https://stackoverflow.com/a/33308927
        this._fragEquiCubeBase = this._fragEquiCubeBase.replace("highp", "mediump");
      }
    }

    // Create vertex shader
    this._vertexShader = gl.createShader(gl.VERTEX_SHADER);
    this._gl.shaderSource(this._vertexShader!, this._vertexShaderSource);
    gl.compileShader(this._vertexShader!);

    // Create fragment shader
    this._facetShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(this._facetShader!, this._fragEquirectangular);
    gl.compileShader(this._facetShader!);

    // Link WebGL program
    this._program = gl.createProgram();

    // make it so we don't need all the this.program!'s
    const program: WebGLProgram = this._program!;

    gl.attachShader(program, this._vertexShader!);
    gl.attachShader(program, this._facetShader!);
    gl.linkProgram(program);

    // Log errors
    if (!gl.getShaderParameter(this._vertexShader!, gl.COMPILE_STATUS))
      console.log(gl.getShaderInfoLog(this._vertexShader!));
    if (!gl.getShaderParameter(this._facetShader!, gl.COMPILE_STATUS))
      console.log(gl.getShaderInfoLog(this._facetShader!));
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      console.log(gl.getProgramInfoLog(program));

    // Use WebGL program
    gl.useProgram(program);

    // Set background clear color (does not apply to cubemap/fallback image)
    const color = this._params.backgroundColor ? this._params.backgroundColor : [0, 0, 0];
    gl.clearColor(color[0], color[1], color[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Look up texture coordinates location
    (program as any).texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray((program as any).texCoordLocation);

    // Provide texture coordinates for rectangle
    if (!this._texCoordBuffer)
      this._texCoordBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer((program as any).texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Pass aspect ratio
    (program as any).aspectRatio = gl.getUniformLocation(program, "u_aspectRatio");
    gl.uniform1f((program as any).aspectRatio, gl.drawingBufferWidth / gl.drawingBufferHeight);

    // Locate psi, theta, focal length, horizontal extent, vertical extent, and vertical offset
    (program as any).psi = gl.getUniformLocation(program, "u_psi");
    (program as any).theta = gl.getUniformLocation(program, "u_theta");
    (program as any).f = gl.getUniformLocation(program, "u_f");
    (program as any).h = gl.getUniformLocation(program, "u_h");
    (program as any).v = gl.getUniformLocation(program, "u_v");
    (program as any).vo = gl.getUniformLocation(program, "u_vo");
    (program as any).rot = gl.getUniformLocation(program, "u_rot");

    // Pass horizontal extent, vertical extent, and vertical offset
    gl.uniform1f((program as any).h, horizAngleView / (Math.PI * 2.0));
    gl.uniform1f((program as any).v, vertAngleView / Math.PI);
    gl.uniform1f((program as any).vo, vertOffset / Math.PI * 2);

    // Set background color
    (program as any).backgroundColor = gl.getUniformLocation(program, "u_backgroundColor");
    gl.uniform4fv((program as any).backgroundColor, color.concat([1]));

    // Create texture
    (program as any).texture = gl.createTexture();
    gl.bindTexture(glBindType, (program as any).texture);

    // Upload images to texture depending on type
    if (panoImage.width <= maxWidth) {
      gl.uniform1i(gl.getUniformLocation(program, "u_splitImage"), 0);
      // Upload image to the texture
      gl.texImage2D(glBindType, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, panoImage);
    } else {
      // Image needs to be split into two parts due to texture size limits
      gl.uniform1i(gl.getUniformLocation(program, "u_splitImage"), 1);

      // Draw image on canvas
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = panoImage.width / 2;
      cropCanvas.height = panoImage.height;
      const cropContext = cropCanvas.getContext("2d");
      cropContext!.drawImage(panoImage, 0, 0);

      // Upload first half of image to the texture
      let cropImage = cropContext!.getImageData(0, 0, panoImage.width / 2, panoImage.height);
      gl.texImage2D(glBindType, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cropImage);

      // Create and bind texture for second half of image
      (program as any).texture2 = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(glBindType, (program as any).texture2);
      gl.uniform1i(gl.getUniformLocation(program, "u_image1"), 1);

      // Upload second half of image to the texture
      cropContext!.drawImage(panoImage, -panoImage.width / 2, 0);
      cropImage = cropContext!.getImageData(0, 0, panoImage.width / 2, panoImage.height);
      gl.texImage2D(glBindType, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cropImage);

      // Set parameters for rendering any size
      gl.texParameteri(glBindType, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(glBindType, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(glBindType, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(glBindType, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // Reactivate first texture unit
      gl.activeTexture(gl.TEXTURE0);
    }

    // Set parameters for rendering any size
    gl.texParameteri(glBindType, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(glBindType, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(glBindType, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(glBindType, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const err = gl.getError();
    if (err !== 0) {
      console.log("Error: Something went wrong with WebGL!", err);
      throw { type: "webgl error" };
    }

    callback();
  }

  /**
   * Destroy renderer.
   * @memberof Renderer
   * @instance
   */
  public destroy() {
    if (this._container !== undefined) {
      if (this._canvas !== undefined && this._container.contains(this._canvas)) {
        this._container.removeChild(this._canvas);
      }
      if (this._world !== undefined && this._container.contains(this._world)) {
        this._container.removeChild(this._world);
      }
    }
    if (this._gl) {
      // The spec says this is only supposed to simulate losing the WebGL
      // context, but in practice it tends to actually free the memory.
      const extension = this._gl.getExtension("WEBGL_lose_context");
      if (extension)
        extension.loseContext();
    }
  }

  /**
   * Resize renderer (call after resizing container).
   * @memberof Renderer
   * @instance
   */
  public resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    this._canvas.width = this._canvas.clientWidth * pixelRatio;
    this._canvas.height = this._canvas.clientHeight * pixelRatio;
    if (this._gl) {
      if (this._gl.getError() === 1286)
        this.handleWebGLError1286();
      this._gl.viewport(0, 0, this._gl.drawingBufferWidth, this._gl.drawingBufferHeight);
      this._gl.uniform1f((this._program as any).aspectRatio, this._canvas.clientWidth / this._canvas.clientHeight);
    }
  }

  /**
   * Set renderer horizon pitch and roll.
   * @memberof Renderer
   * @instance
   */
  public setPose(horizonPitch: number, horizonRoll: number) {
    this._pose = [horizonPitch, horizonRoll];
  }

  /**
   * Render new view of panorama.
   * @memberof Renderer
   * @instance
   * @param {number} pitch - Pitch to render at (in radians).
   * @param {number} yaw - Yaw to render at (in radians).
   * @param {number} hfov - Horizontal field of view to render with (in radians).
   * @param {Object} [params] - Extra configuration parameters.
   * @param {number} [params.roll] - Camera roll (in radians).
   * @param {boolean} [params.returnImage] - Return rendered image?
   */
  public render(pitch: number, yaw: number, hfov: number, params: RenderParams | undefined): string | undefined {
    let focal;

    let roll = 0;
    if (params === undefined)
      params = {};

    if (params.roll)
      roll = params.roll;

    // Apply pitch and roll transformation if applicable
    if (this._pose !== undefined) {
      const horizonPitch = this._pose[0];
      const horizonRoll = this._pose[1];

      // Calculate new pitch and yaw
      const origPitch = pitch;
      const origYaw = yaw;
      const x = Math.cos(horizonRoll) * Math.sin(pitch) * Math.sin(horizonPitch) +
        Math.cos(pitch) * (Math.cos(horizonPitch) * Math.cos(yaw) +
          Math.sin(horizonRoll) * Math.sin(horizonPitch) * Math.sin(yaw));
      const y = -Math.sin(pitch) * Math.sin(horizonRoll) +
        Math.cos(pitch) * Math.cos(horizonRoll) * Math.sin(yaw);
      const z = Math.cos(horizonRoll) * Math.cos(horizonPitch) * Math.sin(pitch) +
        Math.cos(pitch) * (-Math.cos(yaw) * Math.sin(horizonPitch) +
          Math.cos(horizonPitch) * Math.sin(horizonRoll) * Math.sin(yaw));
      pitch = Math.asin(Math.max(Math.min(z, 1), -1));
      yaw = Math.atan2(y, x);

      // Calculate roll
      const v = [Math.cos(origPitch) * (Math.sin(horizonRoll) * Math.sin(horizonPitch) * Math.cos(origYaw) - Math.cos(horizonPitch) * Math.sin(origYaw)),
        Math.cos(origPitch) * Math.cos(horizonRoll) * Math.cos(origYaw),
        Math.cos(origPitch) * (Math.cos(horizonPitch) * Math.sin(horizonRoll) * Math.cos(origYaw) + Math.sin(origYaw) * Math.sin(horizonPitch))];
      const w = [-Math.cos(pitch) * Math.sin(yaw), Math.cos(pitch) * Math.cos(yaw)];
      let rollAdj = Math.acos(Math.max(Math.min((v[0] * w[0] + v[1] * w[1]) /
        (Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) *
          Math.sqrt(w[0] * w[0] + w[1] * w[1])), 1), -1));
      if (v[2] < 0)
        rollAdj = 2 * Math.PI - rollAdj;
      roll += rollAdj;
    }

    // Calculate focal length from vertical field of view
    const gl = this._gl!;
    const vfov = 2 * Math.atan(Math.tan(hfov * 0.5) / (gl.drawingBufferWidth / gl.drawingBufferHeight));
    focal = 1 / Math.tan(vfov * 0.5);

    // Pass psi, theta, roll, and focal length
    const program: WebGLProgram = this._program!;
    gl.uniform1f((program as any).psi, yaw);
    gl.uniform1f((program as any).theta, pitch);
    gl.uniform1f((program as any).rot, roll);
    gl.uniform1f((program as any).f, focal);

    if (this._dynamic === true) {
      // Update texture if dynamic
      gl.bindTexture(gl.TEXTURE_2D, (program as any).texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this._image!);
    }

    // Draw using current buffer
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (params.returnImage !== undefined) {
      return this._canvas.toDataURL("image/png");
    }
    return undefined;
  }

  /**
   * Retrieve renderer's canvas.
   * @memberof Renderer
   * @instance
   * @returns {HTMLElement} Renderer's canvas.
   */
  public get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /**
   * On iOS (iPhone 5c, iOS 10.3), this WebGL error occurs when the canvas is
   * too big. Unfortuately, there's no way to test for this beforehand, so we
   * reduce the canvas size if this error is thrown.
   * @private
   */
  private handleWebGLError1286() {
    console.log("Reducing canvas size due to error 1286!");
    this._canvas.width = Math.round(this._canvas.width / 2);
    this._canvas.height = Math.round(this._canvas.height / 2);
  }

  // Vertex shader for equirectangular and cube
  private _vertexShaderSource = [
    "attribute vec2 a_texCoord;",
    "varying vec2 v_texCoord;",

    "void main() {",
    // Set position
    "gl_Position = vec4(a_texCoord, 0.0, 1.0);",

    // Pass the coordinates to the fragment shader
    "v_texCoord = a_texCoord;",
    "}",
  ].join("");

  // Fragment shader
  private _fragEquiCubeBase = [
    "precision highp float;", // mediump looks bad on some mobile devices

    "uniform float u_aspectRatio;",
    "uniform float u_psi;",
    "uniform float u_theta;",
    "uniform float u_f;",
    "uniform float u_h;",
    "uniform float u_v;",
    "uniform float u_vo;",
    "uniform float u_rot;",

    "const float PI = 3.14159265358979323846264;",

    // Texture
    "uniform sampler2D u_image0;",
    "uniform sampler2D u_image1;",
    "uniform bool u_splitImage;",
    "uniform samplerCube u_imageCube;",

    // Coordinates passed in from vertex shader
    "varying vec2 v_texCoord;",

    // Background color (display for partial panoramas)
    "uniform vec4 u_backgroundColor;",

    "void main() {",
    // Map canvas/camera to sphere
    "float x = v_texCoord.x * u_aspectRatio;",
    "float y = v_texCoord.y;",
    "float sinrot = sin(u_rot);",
    "float cosrot = cos(u_rot);",
    "float rot_x = x * cosrot - y * sinrot;",
    "float rot_y = x * sinrot + y * cosrot;",
    "float sintheta = sin(u_theta);",
    "float costheta = cos(u_theta);",
    "float a = u_f * costheta - rot_y * sintheta;",
    "float root = sqrt(rot_x * rot_x + a * a);",
    "float lambda = atan(rot_x / root, a / root) + u_psi;",
    "float phi = atan((rot_y * costheta + u_f * sintheta) / root);",
  ].join("\n");

  // Fragment shader
  private _fragEquirectangular = this._fragEquiCubeBase + [
    // Wrap image
    "lambda = mod(lambda + PI, PI * 2.0) - PI;",

    // Map texture to sphere
    "vec2 coord = vec2(lambda / PI, phi / (PI / 2.0));",

    // Look up color from texture
    // Map from [-1,1] to [0,1] and flip y-axis
    "if(coord.x < -u_h || coord.x > u_h || coord.y < -u_v + u_vo || coord.y > u_v + u_vo)",
    "gl_FragColor = u_backgroundColor;",
    "else {",
    "if(u_splitImage) {",
    // Image was split into two textures to work around texture size limits
    "if(coord.x < 0.0)",
    "gl_FragColor = texture2D(u_image0, vec2((coord.x + u_h) / u_h, (-coord.y + u_v + u_vo) / (u_v * 2.0)));",
    "else",
    "gl_FragColor = texture2D(u_image1, vec2((coord.x + u_h) / u_h - 1.0, (-coord.y + u_v + u_vo) / (u_v * 2.0)));",
    "} else {",
    "gl_FragColor = texture2D(u_image0, vec2((coord.x + u_h) / (u_h * 2.0), (-coord.y + u_v + u_vo) / (u_v * 2.0)));",
    "}",
    "}",
    "}",
  ].join("\n");

}
