/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { Id64String } from "@itwin/core-bentley";
import {
  BlobOptions, BlobOptionsBuilder, BlobRange, DbBlobRequest, DbBlobResponse, DbQueryError, DbRequestExecutor, DbRequestKind,
} from "./ConcurrentQuery";

/** @beta */
export class Uint8Chunks implements Iterable<Uint8Array> {
  private _chunks: Uint8Array[] = [];
  public append(chunk: Uint8Array) {
    this._chunks.push(chunk);
  }
  public at(idx: number) { return this._chunks[idx]; }
  public get length() { return this._chunks.length; }
  public [Symbol.iterator](): Iterator<Uint8Array, any, undefined> {
    return (this._chunks as any)[Symbol.iterator];
  }
  public combine(): Uint8Array {
    const totalChunkLength = this._chunks.reduce((acc, v) => acc + v.length, 0);
    const combineChunk = new Uint8Array(totalChunkLength);
    let offset = 0;
    for (const array of this._chunks) {
      combineChunk.set(array, offset);
      offset += array.length;
    }
    return combineChunk;
  }
}
/** @beta */
export class BlobReader {
  private _chunks = new Uint8Chunks();
  private _lengthToRead: number = -1;
  private _options = new BlobOptionsBuilder().getOptions();
  public constructor(private _executor: DbRequestExecutor<DbBlobRequest, DbBlobResponse>,
    public readonly className: string,
    public readonly accessString: string,
    public readonly instanceId: Id64String,
    options?: BlobOptions) {
    this.reset(options);
  }
  public reset(options?: BlobOptions) {
    if (options) {
      this._options = options;
    }
    this._chunks = new Uint8Chunks();
    this._lengthToRead = this.range.count!;
  }
  public get range(): BlobRange { return this._options.range!; }
  public async step(): Promise<boolean> {
    if (this._lengthToRead === this._chunks.length) {
      return false;
    }
    const request: DbBlobRequest = {
      kind: DbRequestKind.BlobIO,
      className: this.className,
      accessString: this.accessString,
      instanceId: this.instanceId,
      ...this._options,
    };
    request.range = {offset: this._chunks.length, count: this.range ? this._lengthToRead - this._chunks.length : 0};
    const resp = await this._executor.execute(request);
    DbQueryError.throwIfError(resp, request);

    if (this._lengthToRead === -1) {
      this._lengthToRead = resp.rawBlobSize;
    }
    if (resp.data && resp.data.length > 0) {
      this._chunks.append(resp.data);
    }
    return true;
  }
  public async readToEnd(): Promise<Uint8Array> {
    while (await this.step()) { }
    return this._chunks.combine();
  }
  public get current(): Uint8Array {
    if (this._chunks.length === 0) {
      throw new Error("there is no current buffer");
    }
    return this._chunks.at(this._chunks.length);
  }
  public get chunks(): Uint8Chunks { return this._chunks; }
}
