/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, BeTimePoint, dispose, disposeArray, DuplicatePolicy, IDisposable, SortedArray } from "@itwin/core-bentley";
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

  private _totalCreateTime = 0;
  private _totalReuseTime = 0;
  public meanCreateTime = 0;
  public meanReuseTime = 0;

  public createPerDim = new Map<string, number>();
  public reusePerDim = new Map<string, number>();
  public createTimePerDim = new Map<string, number>();
  public reuseTimePerDim = new Map<string, number>();
  public insertPerDim = new Map<string, number>();
  public wastedPerDim = new Map<string, number>();
  public missingPerDim = new Map<string, number>();
  public createRatioPerDim = new Map<string, number>();
  public reuseRatioPerDim = new Map<string, number>();
  public meanCreateTimePerDim = new Map<string, number>();
  public meanReuseTimePerDim = new Map<string, number>();
  public insertRatioPerDim = new Map<string, number>();
  public wastedRatioPerDim = new Map<string, number>();
  public missingRatioPerDim = new Map<string, number>();

  constructor() {
    setInterval(() => {
      // eslint-disable-next-line no-console
      console.log(this.prettyPrint);
    }, 1000 * 30);
  }

  public get prettyPrint(): string{
    const sortFn = (key1: string, key2: string) => {
      const [w1, h1] = key1.split("x").map((str1) => Number.parseFloat(str1));
      const [w2, h2] = key2.split("x").map((str2) => Number.parseFloat(str2));
      return (w1 * h1) - (w2 * h2) || w1 - w2 || h1 - h2; // Sort by area
    };

    return `{${Object.keys(this).map(
      (key) => {
        const value = this[key as keyof this];
        if (typeof value === "string") {
          return `"${key}":"${value}"`;
        } else if (typeof value === "number") {
          return `"${key}":${value}`;
        } else if (value instanceof Map) {
          return `"${key}":"\\"Key\\",\\"Value\\"\\n${
            Array.from(value.keys()).sort(sortFn).map((dim) => `\\"${dim}\\",${value.get(dim)}`).join("\\n")
          }"`;
        } else   {
          return "";
        }
      }).join(",")}}`;
  }

  public statSize(size: number) {
    this._totalSize += size;
    this._totalSizeCount++;
    this.meanSize = this._totalSize / this._totalSizeCount;
  }

  public statCreate(size: number, width: number, height: number, time: number) {
    this.totalCreatedBytes += size;
    this._totalCreateTime += time;
    this._totalCreatedCount++;
    this.meanCreatedBytes = this.totalCreatedBytes / this._totalCreatedCount;
    this.meanCreateTime = this._totalCreateTime / this._totalCreatedCount;
    const key = this.dimensionKey(width, height);
    this.createPerDim.set(key, (this.createPerDim.get(key) ?? 0) + 1);
    this.createTimePerDim.set(key, (this.createTimePerDim.get(key) ?? 0) + time);
    this.computeRatios();
  }

  public statReuse(size: number, width: number, height: number, time: number) {
    this.totalReusedBytes += size;
    this._totalReuseTime += time;
    this._totalReusedCount++;
    this.meanReusedBytes = this.totalReusedBytes / this._totalReusedCount;
    this.meanReuseTime = this._totalReuseTime / this._totalReusedCount;
    const key = this.dimensionKey(width, height);
    this.reusePerDim.set(key, (this.reusePerDim.get(key) ?? 0) + 1);
    this.reuseTimePerDim.set(key, (this.reuseTimePerDim.get(key) ?? 0) + time);
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

    for (const [key, value] of this.createTimePerDim) {
      this.meanCreateTimePerDim.set(key, value / (this.createPerDim.get(key) ?? 1));
    }

    for (const [key, value] of this.reuseTimePerDim) {
      this.meanReuseTimePerDim.set(key, value / (this.reusePerDim.get(key) ?? 1));
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

  /// Byte used by the texture
  private _bytesUsed: number;

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

  public get bytesUsed(): number {
    return this._bytesUsed;
  }

  constructor(texture: Texture) {
    this._texture = texture;
    this.next = this.previous = null;
    this._bytesUsed = texture.bytesUsed;
    this._lastUsage = BeTimePoint.now();
  }

  public compareWithParams(type: RenderTexture.Type, width: number, height: number) {
    return this.width - width || this.height - height || this.type - type;
  }

  public static compare(lhs: TrackedTexture, rhs: TrackedTexture) {
    return lhs.compareWithParams(rhs.type, rhs.width, rhs.height);
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

    this._totalBytesUsed += texture.bytesUsed;
  }

  public remove(texture: TrackedTexture) {
    if (this._tail === texture)
      this._tail = texture.previous;
    if (this._head === texture)
      this._head = texture.next;

    if (texture.previous !== null)
      texture.previous.next = texture.next;
    if (texture.next !== null)
      texture.next.previous = texture.previous;

    texture.next = texture.previous = null;

    this._totalBytesUsed -= texture.bytesUsed;
    assert(this._totalBytesUsed >= 0, "Removed more from the lru list than available");
  }

  public clear() {
    this._head = this._tail = null;
    this._totalBytesUsed = 0;
  }
}

/// Sorted array of textures
class TextureSortedArray extends SortedArray<TrackedTexture> {
  constructor() {
    super(TrackedTexture.compare, DuplicatePolicy.Allow);
  }

  /** Get a texture matching the parameters and extract it from the array.
   * Parameters can either be a texture or a type/width/height combination
   * Returns undefined if no matching texture has been found.
   */
  public spliceTexture(args: {type: RenderTexture.Type, width: number, height: number} | TrackedTexture): TrackedTexture | undefined {
    const index = args instanceof TrackedTexture
      ? this.indexOf(args)
      : this.indexOfEquivalent((element) => (element.compareWithParams(args.type, args.width, args.height)));

    if (index < 0)
      return undefined;

    return this._array.splice(index, 1)[0];
  }
}

/** @internal */
export class TexturePool implements IDisposable {
  private _system: System;

  /// Textures are stored in a sorted array to find quickly fitting candidate
  private _textures = new TextureSortedArray();

  /// LRU list
  private _lruList = new LRUTextureList();

  /// Maximum size of the pool
  public readonly maxSize = 2048 * 2048 * 4 * 64;

  /// Limit of size for stored textures
  public readonly minimumTextureSize = 1;
  public readonly maximumTextureSize = 512;

  /// Number of milliseconds before removing textures from the list
  public readonly textureExpirationTime = 1000 * 60;

  /// Time between two pruning
  public readonly pruningTime = 1000 * 30;

  /// Last time we pruned
  private _lastPruneTime?: BeTimePoint;

  /// Timeout for pruning
  private _pruneTimeout?: NodeJS.Timeout;

  private _stats: Stats = new Stats();

  public constructor(system: System) {
    this._system = system;
  }

  public dispose(): void { // FIXME never called?
    disposeArray(this._textures.extractArray());
    this._lruList.clear();
    // eslint-disable-next-line no-console
    console.log("Disposing", this._stats);
  }

  public prune(): void {
    const now = BeTimePoint.now();
    let head = this._lruList.head;
    const beforeBytes = this._lruList.totalBytesUsed;
    let freedMemory = 0;
    while (head !== null && now.milliseconds - head.lastUsage.milliseconds > this.textureExpirationTime) {
      const bytesUsed = head.bytesUsed;
      this._stats.statWaste(bytesUsed, head.width, head.height);
      const successfullyRemoved = this.removeTexture(head);
      freedMemory += bytesUsed;

      assert(successfullyRemoved);
      head = this._lruList.head;
    }
    // eslint-disable-next-line no-console
    console.log(`Pruning ${freedMemory} bytes. New size is ${this._lruList.totalBytesUsed}.`);
    assert(this._lruList.totalBytesUsed === beforeBytes - freedMemory, `Pruning error (Expected ${beforeBytes - freedMemory} Got ${this._lruList.totalBytesUsed}`);
    this._lastPruneTime = now;
  }

  /**
   * Prune the pool if the time since last pruning is more than the limit time.
   * Sets a timeout callback to prune again in the future.
   */
  private requestPruning(): void {
    const now = BeTimePoint.now();

    if (!this._lastPruneTime || now.milliseconds - this._lastPruneTime.milliseconds > this.pruningTime)
      this.prune();

    if (this._pruneTimeout) {
      clearTimeout(this._pruneTimeout);
    }

    // We compute the duration to make sure we won't need to prune after this call if no texture is inserted
    const timeoutDuration = Math.max(this.pruningTime, this.textureExpirationTime);
    this._pruneTimeout = setTimeout(() => {this.prune();}, timeoutDuration);
  }

  public createOrReuseTexture(args: CreateTextureArgs): RenderTexture | undefined {
    const texture = this.extractMatchingTexture(args.type ?? RenderTexture.Type.Normal, args.image.source.width, args.image.source.height);

    this._stats.statSize(this._lruList.totalBytesUsed);

    const startTime = window.performance.now();
    if (texture !== undefined) {
      const result = this.reuseTexture(texture, args);

      if (result !== undefined) {
        this._stats.statReuse(texture.bytesUsed, texture.width, texture.height, window.performance.now() - startTime);
        // eslint-disable-next-line no-console
        console.log(`Reuse texture of size ${texture.width}x${texture.height} (target is ${args.image.source.width}x${args.image.source.height}). New size is ${this._lruList.totalBytesUsed}/${this.maxSize}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`Failed to reuse texture`);
      }

      this.requestPruning();
      if (result !== undefined)
        return result;
      else
        dispose(texture); // TODO: Maybe put it back in the array?
    } else {
      this._stats.statMissing(args.image.source.width, args.image.source.height, args.type ?? RenderTexture.Type.Normal);
    }

    const tmpResult = this._system.createTexture(args) as Texture;

    this._stats.statCreate(tmpResult.bytesUsed, tmpResult.texture.width, tmpResult.texture.height, window.performance.now() - startTime);
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
      && texture.texture.width >= this.minimumTextureSize && texture.texture.height >= this.minimumTextureSize
      && texture.texture.width <= this.maximumTextureSize && texture.texture.height <= this.maximumTextureSize;

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

    if (width < this.minimumTextureSize || height < this.minimumTextureSize || width > this.maximumTextureSize || height < this.maximumTextureSize)
      return undefined;

    const result = this._textures.spliceTexture({type, width, height});

    if (result === undefined)
      return undefined;

    this._lruList.remove(result);

    return result;
  }

  private removeTexture(texture: TrackedTexture): boolean {
    const result = this._textures.spliceTexture(texture);

    if (result === undefined)
      return false;

    this._lruList.remove(result);

    dispose(texture);

    return true;
  }

  private insertTexture(texture: Texture) {
    const trackedTexture = new TrackedTexture(texture);

    this._textures.insert(trackedTexture);
    this._lruList.insert(trackedTexture);

    // eslint-disable-next-line no-console
    console.log(`Inserted texture of size ${texture.texture.width}x${texture.texture.height}. New size is ${this._lruList.totalBytesUsed}/${this.maxSize}`);
  }
}
