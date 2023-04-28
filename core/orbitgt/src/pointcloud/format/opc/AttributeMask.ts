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

import { AList } from "../../../system/collection/AList";
import { PointAttribute } from "../../model/PointAttribute";
import { AttributeReader } from "./AttributeReader";
import { FileReader } from "./FileReader";

/**
 * Class AttributeMask defines a mask of attributes to read.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class AttributeMask {
  /** The definitions of the attributes */
  public attributes: Array<PointAttribute>;
  /** The readers of the attributes */
  public readers: AList<AttributeReader>;

  /**
   * Create a new mask.
   * @param readers the list of attribute readers (can be null).
   */
  public constructor(readers: AList<AttributeReader>) {
    /* Clear */
    this.attributes = null;
    this.readers = null;
    /* Do we have a list of readers? */
    if (readers != null) {
      this.attributes = new Array<PointAttribute>(readers.size());
      for (let i: number = 0; i < this.attributes.length; i++) this.attributes[i] = readers.get(i).getAttribute();
      this.readers = readers;
    }
  }

  /**
   * Read all embedded attributes of a file.
   * @param fileReader the file reader.
   * @return the mask.
   */
  public static readAllEmbedded(fileReader: FileReader): AttributeMask {
    let readers: AList<AttributeReader> = new AList<AttributeReader>();
    for (let reader of fileReader.getStaticAttributeReaders()) readers.add(reader);
    return new AttributeMask(readers);
  }
}
