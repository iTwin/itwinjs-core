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
import { FileContent } from "./FileContent";
import { FileRange } from "./FileRange";

/**
 * Class FileStorage defines access methods to file content in a certain file storage account.
 */
/** @internal */
export class FileStorage {
  /**
   * Create new storage.
   */
  public constructor() {}

  /**
   * Close the storage.
   */
  public close(): void {
    /* Override if needed */
  }

  /**
   * Print (and optionally clear) file access statistics.
   */
  public printStatistics(clear: boolean): void {
    /* Override if needed */
  }

  /**
   * Get the length of a file (returns -1 if the file is not found).
   */
  public async getFileLength(fileName: string): Promise<ALong> {
    /* Override this method */
    return ALong.MINUS_ONE;
  }

  /**
   * Read some parts of a file.
   */
  public async readFileParts(
    fileName: string,
    ranges: AList<FileRange>
  ): Promise<AList<FileContent>> {
    /* Override this method */
    return null;
  }

  /**
   * Read a part of a file.
   */
  public async readFilePart(
    fileName: string,
    offset: ALong,
    size: int32
  ): Promise<ABuffer> {
    /* Override this method */
    return null;
  }

  /**
   * Write a file.
   */
  public async writeFile(
    fileName: string,
    fileContent: ABuffer
  ): Promise<void> {
    /* Override this method */
  }
}
