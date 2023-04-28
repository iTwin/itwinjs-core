/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.storage;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ABuffer } from "../buffer/ABuffer";
import { AList } from "../collection/AList";
import { ALong } from "../runtime/ALong";
import { Message } from "../runtime/Message";
import { FileContent } from "./FileContent";
import { FileRange } from "./FileRange";
import { FileStorage } from "./FileStorage";

/**
 * Class ContentLoader helps requesting and loading multiple ranges from a file with a single request to the storage service.
 */
/** @internal */
export class ContentLoader {
  /** The name of this module */
  private static readonly MODULE: string = "ContentLoader";

  /** The storage space of the file */
  private _fileStorage: FileStorage;
  /** The name of the file */
  private _fileName: string;

  /** The list of requests */
  private _requests: AList<FileRange>;
  /** Has loading started? */
  private _loading: boolean;
  /** Has loading stopped? */
  private _loaded: boolean;
  /** The list of responses */
  private _responses: AList<FileContent>;

  /**
   * Create a new content loader.
   */
  public constructor(fileStorage: FileStorage, fileName: string) {
    this._fileStorage = fileStorage;
    this._fileName = fileName;
    this.clear();
  }

  /**
   * Clear the content loader for reuse.
   */
  public clear(): void {
    this._requests = new AList<FileRange>();
    this._loading = false;
    this._loaded = false;
    this._responses = null;
  }

  /**
   * Add a request to load a content range.
   */
  public requestFilePart(offset: ALong, size: int32): ContentLoader {
    this._requests.add(new FileRange(offset, size));
    return this;
  }

  /**
   * Get the total size of the data to be loaded.
   */
  public getTotalRequestSize(): int32 {
    let totalSize: int32 = 0;
    for (let i: number = 0; i < this._requests.size(); i++) totalSize += this._requests.get(i).size;
    return totalSize;
  }

  /**
   * Print info.
   */
  public printInfo(): void {
    Message.print(
      ContentLoader.MODULE,
      "Requesting " +
        this._requests.size() +
        " parts from '" +
        this._fileName +
        "' with total size " +
        this.getTotalRequestSize()
    );
  }

  /**
   * Has all content been loaded?
   */
  public isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Has all content been loaded?
   */
  public isAvailable(): boolean {
    return this.isLoaded();
  }

  /**
   * Load all content from storage.
   */
  public async load(): Promise<ContentLoader> {
    this._loading = true;
    this.printInfo();
    this._responses = await this._fileStorage.readFileParts(this._fileName, this._requests);
    this._loaded = true;
    return this;
  }

  /**
   * Get a content range that has been loaded.
   */
  public getFilePart(offset: ALong, size: int32): ABuffer {
    for (let i: number = 0; i < this._responses.size(); i++) {
      let response: FileContent = this._responses.get(i);
      if (response.offset.same(offset) && response.content.size() == size) {
        return response.content;
      }
    }
    return null;
  }
}
