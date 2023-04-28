/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.format.opc;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ALong } from "../../../system/runtime/ALong";
import { FileStorage } from "../../../system/storage/FileStorage";

/**
 * Class FileAccess provides thread-safe random-access to a file.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class FileAccess {
  /** The storage of the file */
  private _fileStorage: FileStorage;
  /** The name of the file */
  private _fileName: string;
  /** The length of the file */
  private _fileLength: ALong;

  /**
   * Create a new file access.
   * @param fileName the name of the file.
   * @param fileLength the length of the file.
   */
  public constructor(fileStorage: FileStorage, fileName: string, fileLength: ALong) {
    this._fileStorage = fileStorage;
    this._fileName = fileName;
    this._fileLength = fileLength;
  }

  /**
   * Close the file access.
   */
  public close(): void {}

  /**
   * Get the name of the file.
   * @return the name of the file.
   */
  public getFileName(): string {
    return this._fileName;
  }

  /**
   * Get the length of the file.
   * @return the length of the file.
   */
  public getFileLength(): ALong {
    return this._fileLength;
  }
}
