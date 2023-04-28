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
import { ASystem } from "../../../system/runtime/ASystem";
import { FileAccess } from "./FileAccess";

/**
 * Class ContainerFilePart defines a part in a container file.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class ContainerFilePart {
  /** The name */
  private _name: string;
  /** The file access */
  private _fileAccess: FileAccess;
  /** The offset */
  private _offset: ALong;
  /** The size */
  private _size: ALong;

  /**
   * Create a new part.
   * @param name the name of the part.
   * @param fileAccess the file access.
   * @param offset the offset of the part.
   * @param size the size of the part.
   */
  public constructor(
    name: string,
    fileAccess: FileAccess,
    offset: ALong,
    size: ALong
  ) {
    this._fileAccess = fileAccess;
    this._offset = offset;
    this._size = size;
    this._name = name;
  }

  /**
   * Get the name of the part.
   * @return the name of the part.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Get the file access.
   * @return the file access.
   */
  public getFileAccess(): FileAccess {
    return this._fileAccess;
  }

  /**
   * Get the offset of the part.
   * @return the offset of the part.
   */
  public getOffset(): ALong {
    return this._offset;
  }

  /**
   * Get the size of the part.
   * @return the size of the part.
   */
  public getSize(): ALong {
    return this._size;
  }

  /**
   * Do a range check for this part.
   * @param checkOffset the offset of the range we want to touch.
   * @param checkSize the size of the range we want to touch.
   */
  public rangeCheck(checkOffset: ALong, checkSize: ALong): void {
    let checkExtent: ALong = checkOffset.add(checkSize);
    let extent: ALong = this._offset.add(this._size);
    ASystem.assertNot(
      checkOffset.sub(this._offset).isNegative(),
      "Range offset " +
        checkOffset.toString() +
        " falls before part " +
        this._offset.toString() +
        ".." +
        extent.toString()
    );
    ASystem.assertNot(
      extent.sub(checkOffset).isNegative(),
      "Range offset " +
        checkOffset.toString() +
        " falls after part " +
        this._offset.toString() +
        ".." +
        extent.toString()
    );
    ASystem.assertNot(
      checkSize.isNegative(),
      "Range size " + checkSize.toString() + " is negative"
    );
    ASystem.assertNot(
      extent.sub(checkExtent).isNegative(),
      "Range extent " +
        checkExtent.toString() +
        " falls after part " +
        this._offset.toString() +
        ".." +
        extent.toString()
    );
  }
}

//ContainerFilePart.java
