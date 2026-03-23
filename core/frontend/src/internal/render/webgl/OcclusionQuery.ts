/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Matrix4d, Range3d, Transform } from "@itwin/core-geometry";
import { DrawCommands } from "./DrawCommand";
import { Matrix4 } from "./Matrix";
import { Primitive } from "./Primitive";
import { RenderCommands } from "./RenderCommands";
import { RenderPass } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";

/* eslint-disable no-restricted-syntax */

// --- Shader sources ---
const occlusionVS = `#version 300 es
uniform mat4 u_mvp;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
in float a_corner;
void main() {
  int c = int(a_corner);
  vec3 pos = vec3(
    (c & 1) != 0 ? u_boxMax.x : u_boxMin.x,
    (c & 2) != 0 ? u_boxMax.y : u_boxMin.y,
    (c & 4) != 0 ? u_boxMax.z : u_boxMin.z
  );
  gl_Position = u_mvp * vec4(pos, 1.0);
}`;

const occlusionFS = `#version 300 es
precision lowp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.0);
}`;

// Logarithmic depth variants - match the depth encoding used by the main rendering pipeline.
const occlusionVS_logZ = `#version 300 es
uniform mat4 u_mvp;
uniform mat4 u_mv;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
in float a_corner;
out float v_eyeSpaceZ;
void main() {
  int c = int(a_corner);
  vec3 pos = vec3(
    (c & 1) != 0 ? u_boxMax.x : u_boxMin.x,
    (c & 2) != 0 ? u_boxMax.y : u_boxMin.y,
    (c & 4) != 0 ? u_boxMax.z : u_boxMin.z
  );
  gl_Position = u_mvp * vec4(pos, 1.0);
  v_eyeSpaceZ = (u_mv * vec4(pos, 1.0)).z;
}`;

const occlusionFS_logZ = `#version 300 es
precision highp float;
uniform vec2 u_logZ;
in float v_eyeSpaceZ;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.0);
  gl_FragDepth = u_logZ.x == 0.0
    ? -v_eyeSpaceZ / u_logZ.y
    : log(-v_eyeSpaceZ * u_logZ.x) / u_logZ.y;
}`;

// 8 corner indices as float attribute (bit 0=x, bit 1=y, bit 2=z select min/max).
const BOX_CORNERS = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);

// 12 triangles forming a closed box (36 indices). Winding is irrelevant since face culling is disabled.
const BOX_INDICES = new Uint8Array([
  0, 1, 3, 0, 3, 2,   // -Z face
  4, 6, 7, 4, 7, 5,   // +Z face
  0, 4, 5, 0, 5, 1,   // -Y face
  2, 3, 7, 2, 7, 6,   // +Y face
  0, 2, 6, 0, 6, 4,   // -X face
  1, 5, 7, 1, 7, 3,   // +X face
]);

/** Minimum number of draw vertices for a primitive to be worth querying. Small meshes are cheaper to draw than to query. */
const MIN_VERTICES_FOR_QUERY = 128;

/**
 * GPU-based occlusion culling system using WebGL2 occlusion queries.
 *
 * After the opaque pass fills the depth buffer, bounding boxes are rendered with
 * `ANY_SAMPLES_PASSED_CONSERVATIVE` queries. Results from the previous frame
 * determine which primitives to skip in the current frame (one-frame latency).
 *
 * @internal
 */
export class OcclusionQueryManager {
  private readonly _gl: WebGL2RenderingContext;
  private _program: WebGLProgram | null = null;
  private _vao: WebGLVertexArrayObject | null = null;
  private _cornerBuf: WebGLBuffer | null = null;
  private _indexBuf: WebGLBuffer | null = null;
  private _uMvp: WebGLUniformLocation | null = null;
  private _uBoxMin: WebGLUniformLocation | null = null;
  private _uBoxMax: WebGLUniformLocation | null = null;
  private _uMv: WebGLUniformLocation | null = null;
  private _uLogZ: WebGLUniformLocation | null = null;
  private _useLogZ = false;

  // Query tracking
  private _queryPool: WebGLQuery[] = [];
  private _pendingQueries = new Map<Primitive, WebGLQuery>();
  private _visibility = new WeakMap<Primitive, boolean>();

  private _enabled = false;
  private _frozen = false;
  private _initialized = false;

  // Per-frame statistics
  private _numTested = 0;
  private _numOccluded = 0;

  /** Number of primitives tested for occlusion this frame. */
  public get numTested(): number { return this._numTested; }
  /** Number of primitives skipped due to occlusion this frame. */
  public get numOccluded(): number { return this._numOccluded; }

  // Scratch objects (avoid per-frame allocation)
  private readonly _scratchTransform = Transform.createIdentity();
  private readonly _scratchMV = Matrix4d.createIdentity();
  private readonly _scratchMVP = Matrix4d.createIdentity();
  private readonly _scratchMVP32 = new Matrix4();
  private readonly _scratchMV32 = new Matrix4();
  private readonly _scratchRange = new Range3d();

  public constructor(gl: WebGL2RenderingContext) {
    this._gl = gl;
  }

  public get enabled(): boolean { return this._enabled; }
  public set enabled(value: boolean) { this._enabled = value; }

  /** When true, no new queries are issued and existing visibility state is preserved. */
  public get frozen(): boolean { return this._frozen; }
  public set frozen(value: boolean) { this._frozen = value; }

  /** Returns true if the primitive was determined to be fully occluded in the previous frame. */
  public isOccluded(primitive: Primitive): boolean {
    if (!this._enabled)
      return false;

    this._numTested++;
    // `undefined` (never queried) → treat as visible. `true` → visible. `false` → occluded.
    const occluded = this._visibility.get(primitive) === false;
    if (occluded)
      this._numOccluded++;

    return occluded;
  }

  /** Resolve pending queries from the previous frame. Call at beginning of each frame. */
  public resolveQueries(): void {
    // Reset per-frame stats
    this._numTested = 0;
    this._numOccluded = 0;

    if (this._frozen || this._pendingQueries.size === 0)
      return;

    const gl = this._gl;
    const resolved: Primitive[] = [];
    for (const [primitive, query] of this._pendingQueries) {
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        const anyPassed = gl.getQueryParameter(query, gl.QUERY_RESULT);
        this._visibility.set(primitive, !!anyPassed);
        this._queryPool.push(query);
        resolved.push(primitive);
      }
      // Not available yet — leave in _pendingQueries so we retry next frame.
    }
    for (const p of resolved)
      this._pendingQueries.delete(p);
  }

  /**
   * Run occlusion queries for all opaque primitives against the current depth buffer.
   * Must be called while the FBO containing the depth buffer is bound.
   */
  public runOcclusionQueries(target: Target, commands: RenderCommands): void {
    if (!this._enabled || this._frozen)
      return;

    if (!this._initialized)
      this._initGLResources();

    if (!this._program || !this._vao)
      return;

    const passes = [RenderPass.OpaqueLinear, RenderPass.OpaquePlanar, RenderPass.OpaqueGeneral];
    let hasAnyCmds = false;
    for (const pass of passes) {
      if (commands.getCommands(pass).length > 0) {
        hasAnyCmds = true;
        break;
      }
    }
    if (!hasAnyCmds)
      return;

    const gl = this._gl;

    //Force-resolve any leftover pending queries (they've had 2+ frames to complete).
    for (const [_primitive, query] of this._pendingQueries) {
      // if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      //   const anyPassed = gl.getQueryParameter(query, gl.QUERY_RESULT);
      //   this._visibility.set(primitive, !!anyPassed);
      // } else {
      //   // Still not available after 2+ frames — conservatively mark visible to avoid holes.
      //   this._visibility.set(primitive, true);
      // }
      this._queryPool.push(query);
    }
    this._pendingQueries.clear();

    // Save GL state that we'll modify
    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const prevVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

    // Set up state: no color writes, no depth writes, depth test on, no culling
    gl.useProgram(this._program);
    gl.bindVertexArray(this._vao);
    gl.colorMask(false, false, false, false);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    // Set logZ uniform once per frame (same for all primitives).
    if (this._useLogZ)
      gl.uniform2fv(this._uLogZ, target.uniforms.frustum.logZ);

    const viewMatrix = target.uniforms.frustum.viewMatrix;
    const projMatrix = target.uniforms.frustum.projectionMatrix;

    for (const pass of passes) {
      const cmds = commands.getCommands(pass);
      this._processCommands(target, cmds, viewMatrix, projMatrix);
    }

    // Restore state
    gl.useProgram(prevProgram);
    gl.bindVertexArray(prevVao);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  }

  /** Process a command list, maintaining branch/transform state, and issuing queries for surface primitives. */
  private _processCommands(target: Target, cmds: DrawCommands, viewMatrix: Transform, projMatrix: Matrix4d): void {
    const branchDepth = target.uniforms.branch.length;

    try {
      for (const cmd of cmds) {
        switch (cmd.opcode) {
          case "pushBranch":
            target.pushBranch(cmd.branch);
            break;
          case "popBranch":
            target.popBranch();
            break;
          case "pushState":
            target.pushState(cmd.state);
            break;
          case "drawPrimitive":
            this._queryPrimitive(cmd.primitive, target, viewMatrix, projMatrix);
            break;
          // pushBatch, popBatch, pushClip, popClip: no-op for occlusion
        }
      }
    } finally {
      // Ensure branch stack is restored even if something throws
      while (target.uniforms.branch.length > branchDepth)
        target.popBranch();
    }
  }

  private _queryPrimitive(primitive: Primitive, target: Target, viewMatrix: Transform, projMatrix: Matrix4d): void {
    // Only query non-instanced surfaces with enough vertices to justify the overhead
    if (primitive.cachedGeometry.isInstanced)
      return;
    if (primitive.cachedGeometry.isEdge)
      return;
    if (primitive.cachedGeometry.numDrawVertices < MIN_VERTICES_FOR_QUERY)
      return;

    const range = primitive.cachedGeometry.computeRange(this._scratchRange);
    if (range.isNull)
      return;

    const gl = this._gl;

    // Compute MVP = projection * view * model
    const modelMatrix = target.currentTransform;
    const mv = viewMatrix.multiplyTransformTransform(modelMatrix, this._scratchTransform);
    Matrix4d.createTransform(mv, this._scratchMV);
    projMatrix.multiplyMatrixMatrix(this._scratchMV, this._scratchMVP);
    this._scratchMVP32.initFromMatrix4d(this._scratchMVP);

    gl.uniformMatrix4fv(this._uMvp, false, this._scratchMVP32.data);
    if (this._useLogZ) {
      this._scratchMV32.initFromMatrix4d(this._scratchMV);
      gl.uniformMatrix4fv(this._uMv, false, this._scratchMV32.data);
    }
    gl.uniform3f(this._uBoxMin, range.low.x, range.low.y, range.low.z);
    gl.uniform3f(this._uBoxMax, range.high.x, range.high.y, range.high.z);

    const query = this._queryPool.length > 0
      ? this._queryPool.pop()!
      : gl.createQuery()!;

    gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, query);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_BYTE, 0);
    gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);

    this._pendingQueries.set(primitive, query);
  }

  private _initGLResources(): void {
    this._initialized = true;
    const gl = this._gl;

    this._useLogZ = System.instance.supportsLogZBuffer;
    const vs = this._compileShader(gl.VERTEX_SHADER, this._useLogZ ? occlusionVS_logZ : occlusionVS);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, this._useLogZ ? occlusionFS_logZ : occlusionFS);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    this._program = program;
    this._uMvp = gl.getUniformLocation(program, "u_mvp");
    this._uBoxMin = gl.getUniformLocation(program, "u_boxMin");
    this._uBoxMax = gl.getUniformLocation(program, "u_boxMax");
    if (this._useLogZ) {
      this._uMv = gl.getUniformLocation(program, "u_mv");
      this._uLogZ = gl.getUniformLocation(program, "u_logZ");
    }

    // Create VAO with unit box geometry
    this._vao = gl.createVertexArray();
    if (!this._vao)
      return;

    gl.bindVertexArray(this._vao);

    this._cornerBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, BOX_CORNERS, gl.STATIC_DRAW);

    const aCorner = gl.getAttribLocation(program, "a_corner");
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 1, gl.FLOAT, false, 0, 0);

    this._indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, BOX_INDICES, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }

  private _compileShader(type: number, source: string): WebGLShader | null {
    const gl = this._gl;
    const shader = gl.createShader(type);
    if (!shader)
      return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  public dispose(): void {
    const gl = this._gl;
    for (const query of this._queryPool)
      gl.deleteQuery(query);
    for (const query of this._pendingQueries.values())
      gl.deleteQuery(query);
    this._queryPool.length = 0;
    this._pendingQueries.clear();

    if (this._vao) {
      gl.deleteVertexArray(this._vao);
      this._vao = null;
    }
    if (this._cornerBuf) {
      gl.deleteBuffer(this._cornerBuf);
      this._cornerBuf = null;
    }
    if (this._indexBuf) {
      gl.deleteBuffer(this._indexBuf);
      this._indexBuf = null;
    }
    if (this._program) {
      gl.deleteProgram(this._program);
      this._program = null;
    }

    this._initialized = false;
  }
}
