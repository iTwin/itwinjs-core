/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "../../../IModelApp";
import { gaussianSplatStride } from "../GaussianSplatData";
import { gaussianSplatsPerPage } from "../GaussianSplatSort";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { System } from "./System";

/** Preserve bindings when using a private program/VAO/textures alongside the native renderer's caches.
 * RenderState and FrameBufferStack continue to own render flags and framebuffer bindings.
 * @internal
 */
export function withGaussianSplatBindings<T>(operation: (gl: WebGL2RenderingContext) => T): T {
  const gl = System.instance.context;
  const active = gl.getParameter(gl.ACTIVE_TEXTURE);
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  const vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
  const buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
  const textures: Array<[WebGLTexture | null, WebGLTexture | null]> = [];
  for (let unit = 0; unit < 4; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    textures.push([gl.getParameter(gl.TEXTURE_BINDING_2D), gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY)]);
  }

  try {
    return operation(gl);
  } finally {
    for (let unit = 0; unit < textures.length; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, textures[unit][0]);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, textures[unit][1]);
    }

    gl.activeTexture(active);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
  }
}

interface Allocation {
  geometry: WeakRef<GaussianSplatGeometry>;
  pages: number[];
}

/** Shared GPU atlas. Only pages selected by at least one viewport remain resident.
 * CPU tile-cache memory remains independently bounded by the existing tile administrator.
 * @internal
 */
export class GaussianSplatAtlas implements Disposable {
  public texture?: WebGLTexture;
  public readonly width = 1920;
  public readonly height = 128;
  private _capacity = 0;
  private readonly _allocations = new Map<number, Allocation>();
  private readonly _users = new Map<object, Set<number>>();
  private readonly _maxPages: number;

  public constructor() {
    this._maxPages = System.instance.context.getParameter(System.instance.context.MAX_ARRAY_TEXTURE_LAYERS);
  }

  public get bytesUsed(): number { return this._capacity * this.width * this.height * 16; }
  public get numPages(): number { return [...this._allocations.values()].reduce((sum, allocation) => sum + allocation.pages.length, 0); }

  public update(user: object, geometries: GaussianSplatGeometry[]): void {
    this._users.set(user, new Set(geometries.map((geometry) => geometry.id)));
    this.sweep();
    const newGeometries = geometries.filter((geometry) => !this._allocations.has(geometry.id));
    const numPages = this.numPages + newGeometries.reduce((sum, geometry) => sum + Math.ceil(geometry.splats.count / gaussianSplatsPerPage), 0);
    if (numPages > this._maxPages)
      throw new Error("Gaussian splats: visible GPU data exceeds the array texture capacity; reduce visible tile detail");

    if (!numPages || (this.texture && !newGeometries.length && numPages > this._capacity / 4))
      return;

    withGaussianSplatBindings((gl) => {
      gl.activeTexture(gl.TEXTURE0);
      const previous = new Map([...this._allocations].map(([id, allocation]) => [id, { geometry: allocation.geometry, pages: allocation.pages.slice() }]));
      let replacement: WebGLTexture | undefined;
      try {
        const used = new Set<number>();
        for (const allocation of this._allocations.values())
          for (const page of allocation.pages)
            used.add(page);

        let required = used.size ? Math.max(...used) + 1 : 0;
        const added: Allocation[] = [];
        for (const geometry of newGeometries) {
          const pages = [];
          let next = 0;
          for (let i = 0; i < Math.ceil(geometry.splats.count / gaussianSplatsPerPage); i++) {
            while (used.has(next))
              next++;

            pages.push(next);
            used.add(next);
            required = Math.max(required, next + 1);
          }

          const allocation = { geometry: new WeakRef(geometry), pages };
          this._allocations.set(geometry.id, allocation);
          added.push(allocation);
        }

        const shrink = numPages <= this._capacity / 4;
        if (shrink) {
          let next = 0;
          for (const allocation of this._allocations.values())
            allocation.pages = allocation.pages.map(() => next++);

          required = next;
        }

        if (!this.texture || required > this._capacity || shrink) {
          const capacity = Math.min(this._maxPages, Math.max(1, 2 ** Math.ceil(Math.log2(required))));
          replacement = gl.createTexture() ?? undefined;
          if (!replacement)
            throw new Error("Gaussian splats: failed to allocate GPU atlas");

          gl.bindTexture(gl.TEXTURE_2D_ARRAY, replacement);
          gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA32F, this.width, this.height, capacity);
          if (gl.getError() !== gl.NO_ERROR)
            throw new Error("Gaussian splats: GPU atlas allocation failed; reduce visible tile detail");

          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          for (const allocation of this._allocations.values())
            this.upload(gl, allocation);

          if (gl.getError() !== gl.NO_ERROR)
            throw new Error("Gaussian splats: GPU atlas upload failed; reduce visible tile detail");

          // Retain the working field until the replacement and all its pages are valid.
          gl.deleteTexture(this.texture ?? null);
          this.texture = replacement;
          this._capacity = capacity;
          replacement = undefined;
        } else {
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
          for (const allocation of added)
            this.upload(gl, allocation);

          if (gl.getError() !== gl.NO_ERROR)
            throw new Error("Gaussian splats: GPU atlas upload failed; reduce visible tile detail");
        }

        if (shrink)
          // Compaction changes slot addresses used by all viewport instance lists.
          for (const viewport of IModelApp.viewManager)
            viewport.requestRedraw();
      } catch (error) {
        gl.deleteTexture(replacement ?? null);
        this._allocations.clear();
        for (const [id, allocation] of previous)
          this._allocations.set(id, allocation);

        throw error;
      }
    });
  }

  public pages(id: number): number[] {
    const allocation = this._allocations.get(id);
    if (!allocation)
      throw new Error("Gaussian splats: missing GPU tile allocation");

    return allocation.pages;
  }

  private upload(gl: WebGL2RenderingContext, allocation: Allocation): void {
    const geometry = allocation.geometry.deref();
    if (!geometry || geometry.isDisposed)
      return;

    const data = geometry.splats.data;
    const pageFloats = gaussianSplatsPerPage * gaussianSplatStride;
    for (let p = 0; p < allocation.pages.length; p++) {
      let values = data.subarray(p * pageFloats, (p + 1) * pageFloats);
      if (values.length !== pageFloats) {
        const padded = new Float32Array(pageFloats);
        padded.set(values);
        values = padded;
      }

      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, allocation.pages[p], this.width, this.height, 1, gl.RGBA, gl.FLOAT, values);
    }
  }

  private sweep(): void {
    const active = new Set<number>();
    for (const user of this._users.values())
      for (const id of user)
        active.add(id);

    for (const [id, allocation] of this._allocations)
      if (!active.has(id) || !allocation.geometry.deref() || allocation.geometry.deref()?.isDisposed)
        this._allocations.delete(id);

    // Release the entire allocation when all views stop displaying splats.
    if (!this._allocations.size && this.texture) {
      System.instance.context.deleteTexture(this.texture);
      this.texture = undefined;
      this._capacity = 0;
    }
  }

  public release(user: object): void {
    this._users.delete(user);
    this.sweep();
  }

  public [Symbol.dispose](): void {
    if (this.texture)
      System.instance.context.deleteTexture(this.texture);

    this.texture = undefined;
    this._capacity = 0;
    this._allocations.clear();
    this._users.clear();
  }
}

let atlas: GaussianSplatAtlas | undefined;

/** @internal */
export function getGaussianSplatAtlas(): GaussianSplatAtlas {
  if (!atlas) {
    atlas = new GaussianSplatAtlas();
    IModelApp.onBeforeShutdown.addOnce(() => {
      atlas?.[Symbol.dispose]();
      atlas = undefined;
    });
  }

  return atlas;
}
