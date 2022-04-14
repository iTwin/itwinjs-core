/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, BeTimePoint, dispose, disposeArray, IDisposable } from "@itwin/core-bentley";
import { ImageBuffer, RenderTexture, TextureTransparency } from "@itwin/core-common";
import { CreateTextureArgs } from "../RenderTexture";
import { System } from "./System";
import { Texture, Texture2DHandle } from "./Texture";

/// Tests only: remove before merge
class Stats {
  public meanSize = 0;
  private _totalSize = 0;
  private _totalSizeCount = 0;

  public meanCreatedBytes = 0;
  public totalCreatedBytes = 0;
  private _totalCreatedCount = 0;

  public meanReusedBytes = 0;
  public totalReusedBytes = 0;
  private _totalReusedCount = 0;

  public meanDisposedBytes = 0;
  public totalDisposedBytes = 0;
  private _totalDisposedBytesCount = 0;

  private _totalInsertedCount = 0;

  public totalWastedBytes = 0;
  private _totalWastedCount = 0;

  private _totalMissingCount = 0;

  public createdRatio = 0;
  public reusedRatio = 0;

  public createPerDim = new Map<string, number>();
  public reusePerDim = new Map<string, number>();
  public insertPerDim = new Map<string, number>();
  public wastedPerDim = new Map<string, number>();
  public missingPerDim = new Map<string, number>();
  public createRatioPerDim = new Map<string, number>();
  public reuseRatioPerDim = new Map<string, number>();
  public insertRatioPerDim = new Map<string, number>();
  public wastedRatioPerDim = new Map<string, number>();
  public missingRatioPerDim = new Map<string, number>();

  constructor() {
    setInterval(() => {
      // eslint-disable-next-line no-console
      console.log(this);
    }, 1000 * 30);
  }

  public statSize(size: number) {
    this._totalSize += size;
    this._totalSizeCount++;
    this.meanSize = this._totalSize / this._totalSizeCount;
  }

  public statCreate(size: number, width: number, height: number) {
    this.totalCreatedBytes += size;
    this._totalCreatedCount++;
    this.meanCreatedBytes = this.totalCreatedBytes / this._totalCreatedCount;
    const key = this.dimensionKey(width, height);
    this.createPerDim.set(key, (this.createPerDim.get(key) ?? 0 ) + 1);
    this.computeRatios();
  }

  public statReuse(size: number, width: number, height: number) {
    this.totalReusedBytes += size;
    this._totalReusedCount++;
    this.meanReusedBytes = this.totalReusedBytes / this._totalReusedCount;
    const key = this.dimensionKey(width, height);
    this.reusePerDim.set(key, (this.reusePerDim.get(key) ?? 0 ) + 1);
    this.computeRatios();
  }

  public statInsert(_size: number, width: number, height: number) {
    this._totalInsertedCount++;
    const key = this.dimensionKey(width, height);
    this.insertPerDim.set(key, (this.insertPerDim.get(key) ?? 0 ) + 1);
    this.computeRatios();
  }

  public statWaste(size: number, width: number, height: number) {
    this.totalWastedBytes += size;
    this._totalWastedCount++;
    const key = this.dimensionKey(width, height);
    this.wastedPerDim.set(key, (this.wastedPerDim.get(key) ?? 0 ) + 1);
    this.computeRatios();
  }

  public statMissing(width: number, height: number, type: RenderTexture.Type) {
    this._totalMissingCount++;
    const key = this.dimensionKey(width, height, type);
    this.missingPerDim.set(key, (this.missingPerDim.get(key) ?? 0 ) + 1);
    this.computeRatios();
  }

  public statDispose(size: number) {
    this.totalDisposedBytes += size;
    this._totalDisposedBytesCount++;
    this.meanDisposedBytes = this.totalDisposedBytes / this._totalDisposedBytesCount;
  }

  private computeRatios() {
    const totalCount = this._totalCreatedCount + this._totalReusedCount;
    this.createdRatio = this._totalCreatedCount / totalCount;
    this.reusedRatio = this._totalReusedCount / totalCount;

    for (const [key, value] of this.createPerDim) {
      this.createRatioPerDim.set(key, value / this._totalCreatedCount);
    }

    for (const [key, value] of this.reusePerDim) {
      this.reuseRatioPerDim.set(key, value / this._totalReusedCount);
    }

    for (const [key, value] of this.insertPerDim) {
      this.insertRatioPerDim.set(key, value / this._totalInsertedCount);
    }

    for (const [key, value] of this.wastedPerDim) {
      this.wastedRatioPerDim.set(key, value / this._totalWastedCount);
    }

    for (const [key, value] of this.missingPerDim) {
      this.missingRatioPerDim.set(key, value / this._totalMissingCount);
    }
  }

  private dimensionKey(width: number, height: number, type?: RenderTexture.Type) {
    if (type)
      return `${width}x${height}(${type})`;
    else
      return `${width}x${height}`;
  }
}

class TrackedTexture implements IDisposable {
  /// The inner texture
  private _texture: Texture;

  /// The next texture in the lru list
  public next: TrackedTexture | null;

  /// The previous texture in the lru list
  public previous: TrackedTexture | null;

  /// Last time it has been used
  private _lastUsage: BeTimePoint;

  public get texture(): Texture {
    return this._texture;
  }

  public get width(): number {
    return this._texture.texture.width;
  }

  public get height(): number {
    return this._texture.texture.height;
  }

  public get type(): RenderTexture.Type {
    return this._texture.type;
  }

  public get lastUsage(): BeTimePoint {
    return this._lastUsage;
  }

  constructor(texture: Texture) {
    this._texture = texture;
    this.next = this.previous = null;
    this._lastUsage = BeTimePoint.now();
  }

  public canBeReusedWith(type: RenderTexture.Type, width: number, height: number) {
    return this.type === type && this.width === width && this.height === height;
  }

  public compare(other: TrackedTexture) {
    return this.width - other.width || this.height - other.height || this.type - other.type;
  }

  public dispose(): void {
    dispose(this._texture);
  }
}

/// An LRU list for TrackedTexture
class LRUTextureList {
  private _head: TrackedTexture | null = null;
  private _tail: TrackedTexture | null = null;
  private _totalBytesUsed: number = 0;
  public get head(): TrackedTexture | null {
    return this._head;
  }

  public get tail(): TrackedTexture | null {
    return this._tail;
  }

  public get totalBytesUsed(): number {
    return this._totalBytesUsed;
  }

  public insert(texture: TrackedTexture) {
    if (this._tail === null) {
      assert(this._head === null && this._totalBytesUsed === 0, "lru should be empty");
      this._tail = this._head = texture;
      texture.next = texture.previous = null;
    } else if (this._tail.lastUsage.milliseconds <= texture.lastUsage.milliseconds) {
      texture.previous = this._tail;
      texture.next = null;
      this._tail.next = texture;
      this._tail = texture;
    } else {
      assert(false, "unimplemented"); // TODO: handle case when we insert a texture that should not be at the end
    }

    this._totalBytesUsed += texture.texture.bytesUsed;
  }

  public remove(texture: TrackedTexture) {
    if (texture.previous !== null)
      texture.previous.next = texture.next;
    if (texture.next !== null)
      texture.next.previous = texture.previous;

    if (this._tail === texture)
      this._tail = texture.previous;
    if (this._head === texture)
      this._head = texture.next;

    texture.next = texture.previous = null;

    this._totalBytesUsed -= texture.texture.bytesUsed;
    assert(this._totalBytesUsed >= 0, "Removed more from the lru list than available");
  }

  public clear() {
    this._head = this._tail = null;
    this._totalBytesUsed = 0;
  }
}

/** @internal */
export class TexturePool implements IDisposable {
  private _system: System;
  /// Textures are first split using their type, then sorted by width and finally height
  private _textures: Array<TrackedTexture> = [];

  /// LRU list
  private _lruList = new LRUTextureList();

  /// Maximum size of the pool
  public readonly maxSize = 2048 * 2048 * 4 * 64;

  /// Minimum size of textures stored
  public readonly minimumTextureSize = 128;

  /// Number of milliseconds before removing textures from the list
  public readonly textureExpirationTime = 1000 * 60;

  /// Time between two pruning
  public readonly pruningTime = 1000 * 1;

  /// Last time we pruned
  private _lastPruneTime?: BeTimePoint;

  /// Timeout for pruning
  private _pruneTimeout?: NodeJS.Timeout;

  private _stats: Stats = new Stats();

  public constructor(system: System) {
    this._system = system;
  }

  public dispose(): void { // FIXME never called?
    disposeArray(this._textures);
    this._textures.length = 0;
    this._lruList.clear();
    // eslint-disable-next-line no-console
    console.log("Disposing", this._stats);
  }

  public prune(): void {
    const now = BeTimePoint.now();
    let head = this._lruList.head;
    let freedMemory = 0;
    while (head !== null && now.milliseconds - head.lastUsage.milliseconds > this.textureExpirationTime) {
      const bytesUsed = head.texture.bytesUsed;
      this._stats.statWaste(bytesUsed, head.width, head.height);
      const successfullyRemoved = this.removeTexture(head);
      freedMemory += bytesUsed;

      assert(successfullyRemoved);
      head = this._lruList.head;
    }
    // eslint-disable-next-line no-console
    console.log(`Pruning ${freedMemory} bytes`);
    this._lastPruneTime = now;
  }

  /**
   * Prune the pool if the time since last pruning is more than the limit time.
   * Sets a timeout callback to prune again in the future.
   */
  private requestPruning(): void {
    const now = BeTimePoint.now();

    if (!this._lastPruneTime || this._lastPruneTime.milliseconds - now.milliseconds > this.pruningTime)
      this.prune();

    if (this._pruneTimeout) {
      clearTimeout(this._pruneTimeout);
    }

    this._pruneTimeout = setTimeout(() => {this.prune();} , Math.max(this.pruningTime, this.textureExpirationTime));
  }

  public createOrReuseTexture(args: CreateTextureArgs): RenderTexture | undefined {
    const texture = this.extractMatchingTexture(args.type ?? RenderTexture.Type.Normal, args.image.source.width, args.image.source.height);

    this._stats.statSize(this._lruList.totalBytesUsed);
    if (texture !== undefined) {
      const result =  this.reuseTexture(texture,  args);

      if (result !== undefined) {
        this._stats.statReuse(texture.texture.bytesUsed, texture.width, texture.height);
        // eslint-disable-next-line no-console
        console.log(`Reuse texture of size ${texture.width}x${texture.height} (target is ${args.image.source.width}x${args.image.source.height}). New size is ${this._lruList.totalBytesUsed}/${this.maxSize}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`Failed to reuse texture`);
      }

      if (result !== undefined)
        return result;
      else
        dispose(texture); // TODO: Maybe put it back in the array?
    } else {
      this._stats.statMissing(args.image.source.width, args.image.source.height, args.type ?? RenderTexture.Type.Normal);
    }

    const tmpResult = this._system.createTexture(args) as Texture;

    this.requestPruning();
    this._stats.statCreate(tmpResult.bytesUsed, tmpResult.texture.width, tmpResult.texture.height);
    return tmpResult;
  }

  private reuseTexture(texture: TrackedTexture, args: CreateTextureArgs): RenderTexture | undefined{
    const handle = texture.texture.texture as Texture2DHandle; // TODO handle case when it's not a texture2DHandle

    const type = args.type ?? RenderTexture.Type.Normal;
    const source = args.image.source;
    const useMipMaps = args.type !== RenderTexture.Type.TileSection;

    let replacementSuccessful;
    if (source instanceof ImageBuffer)
      replacementSuccessful = handle.replaceTextureData(source.data);
    else if (source instanceof HTMLImageElement)
      replacementSuccessful = handle.replaceTextureDataWithSource(source, useMipMaps);
    // else if (source instanceof ImageBitmap)
    //  handle.replaceTextureDataWithSource(source, useMipMapsZ);
    else
      assert(false);

    if (!replacementSuccessful) {
      // eslint-disable-next-line no-console
      console.log("Failed to reuse texture.");
      return undefined;
    }

    const newTexture = new Texture({ handle, type, ownership: args.ownership, transparency: args.image.transparency ?? TextureTransparency.Mixed });

    return newTexture;
  }

  public disposeOrReuseTexture(texture: RenderTexture): undefined {
    this.requestPruning();

    const shouldReuse = this._lruList.totalBytesUsed + texture.bytesUsed < this.maxSize
      && texture instanceof Texture && texture.texture instanceof Texture2DHandle
      && texture.texture.width >= this.minimumTextureSize && texture.texture.width >= this.minimumTextureSize;

    if (shouldReuse) {
      this.insertTexture(texture);

      this._stats.statInsert(texture.bytesUsed, texture.texture.width, texture.texture.height);
      this._stats.statSize(this._lruList.totalBytesUsed);
      return undefined;
    }

    if (this._lruList.totalBytesUsed + texture.bytesUsed >= this.maxSize)
    // eslint-disable-next-line no-console
      console.log("Size limit reached.");

    this._stats.statSize(this._lruList.totalBytesUsed);
    this._stats.statDispose(texture.bytesUsed);
    dispose(texture);
    return undefined;
  }

  private extractMatchingTexture(type: RenderTexture.Type, width: number, height: number): TrackedTexture | undefined {
    if (this._textures.length === 0)
      return undefined;

    if (width < this.minimumTextureSize || height < this.minimumTextureSize)
      return undefined;

    const index = this._textures.findIndex((texture) => (texture.canBeReusedWith(type, width, height)));

    if (index < 0)
      return undefined;

    const result = this._textures.splice(index, 1)[0];

    this._lruList.remove(result);

    return result;
  }

  private removeTexture(texture: TrackedTexture): boolean {
    const index = this._textures.findIndex((current) => (current === texture));

    if (index < 0)
      return false;

    const result = this._textures.splice(index, 1)[0];

    this._lruList.remove(result);

    dispose(texture);

    return true;
  }

  private insertTexture(texture: Texture) {
    const trackedTexture = new TrackedTexture(texture);
    this._textures.push(trackedTexture);
    this._textures.sort((t1, t2) => t1.compare(t2)); // TODO: insert at the correct index

    this._lruList.insert(trackedTexture);

    // eslint-disable-next-line no-console
    console.log(`Inserted texture of size ${texture.texture.width}x${texture.texture.height}. New size is ${this._lruList.totalBytesUsed}/${this.maxSize}`);
  }
}
