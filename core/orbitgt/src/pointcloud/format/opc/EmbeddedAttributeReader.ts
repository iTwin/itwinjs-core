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

import { ABuffer } from "../../../system/buffer/ABuffer";
import { LittleEndian } from "../../../system/buffer/LittleEndian";
import { ABufferInStream } from "../../../system/io/ABufferInStream";
import { InStream } from "../../../system/io/InStream";
import { ALong } from "../../../system/runtime/ALong";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { AttributeValue } from "../../model/AttributeValue";
import { CloudPoint } from "../../model/CloudPoint";
import { PointAttribute } from "../../model/PointAttribute";
import { ReadRequest } from "../../model/ReadRequest";
import { StandardAttributes } from "../../model/StandardAttributes";
import { TileIndex } from "../../model/TileIndex";
import { AttributeReader } from "./AttributeReader";
import { ContainerFile } from "./ContainerFile";
import { ContainerFilePart } from "./ContainerFilePart";
import { FileAccess } from "./FileAccess";
import { TileReadBuffer } from "./TileReadBuffer";

/**
 * Class EmbeddedAttributeReader reads attribute data.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class EmbeddedAttributeReader extends AttributeReader {
  /** The container */
  private _container: ContainerFile;
  /** The index */
  private _index: int32;
  /** The number of levels */
  private _levelCount: int32;

  /** The definition of the attribute */
  private _attribute: PointAttribute;
  /** The value range of the attribute */
  private _minValue: AttributeValue;
  private _maxValue: AttributeValue;
  /** Is this the legacy color attribute? */
  private _standardColor: boolean;
  /** Is this the legacy intensity attribute? */
  private _standardIntensity: boolean;

  /** The point-attribute data parts (one per level) */
  private _pointDataParts: Array<ContainerFilePart>;
  /** The block-attribute data parts (one per level) */
  private _blockDataParts: Array<ContainerFilePart>;
  /** The tile-attribute data parts (one per level) */
  private _tileDataParts: Array<ContainerFilePart>;

  /**
   * Create a new reader.
   * @param container the container.
   * @param index the index.
   * @param levelCount the number of levels.
   */
  public constructor(
    container: ContainerFile,
    index: int32,
    levelCount: int32
  ) {
    super();
    /* Store the parameters */
    this._container = container;
    this._index = index;
    this._levelCount = levelCount;
    /* Clear */
    this._attribute = null;
    this._minValue = null;
    this._maxValue = null;
    this._standardColor = false;
    this._standardIntensity = false;
    /* Find the data parts */
    this._pointDataParts = new Array<ContainerFilePart>(levelCount);
    this._blockDataParts = new Array<ContainerFilePart>(levelCount);
    this._tileDataParts = new Array<ContainerFilePart>(levelCount);
    for (let i: number = 0; i < levelCount; i++)
      this._pointDataParts[i] = container.getPart(
        "" + i + ".attribute." + this._index + ".pointdata"
      );
    for (let i: number = 0; i < levelCount; i++)
      this._blockDataParts[i] = container.getPart(
        "" + i + ".attribute." + this._index + ".blockdata"
      );
    for (let i: number = 0; i < levelCount; i++)
      this._tileDataParts[i] = container.getPart(
        "" + i + ".attribute." + this._index + ".tiledata"
      );
  }

  /**
   * Read the attribute information.
   * @param data the attribute data.
   */
  private readAttribute(data: ABuffer): void {
    /* Read the definition */
    this._minValue = new AttributeValue();
    this._maxValue = new AttributeValue();
    let input: ABufferInStream = new ABufferInStream(data, 0, data.size());
    this._attribute = EmbeddedAttributeReader.readDefinition(
      input,
      this._minValue,
      this._maxValue
    );
    input.close();
    /* Standard attribute? */
    this._standardColor = StandardAttributes.COLOR.hasName(
      this._attribute.getName()
    );
    if (this._standardColor) this._attribute.setStandardAttribute(true);
    this._standardIntensity = StandardAttributes.INTENSITY.hasName(
      this._attribute.getName()
    );
    if (this._standardIntensity) this._attribute.setStandardAttribute(true);
  }

  /**
   * Load the data.
   * @return the reader.
   */
  public loadData(fileContents: ContentLoader): EmbeddedAttributeReader {
    /* Get the part */
    let definitionPart: ContainerFilePart = this._container.getPart(
      "attribute." + this._index + ".definition"
    );
    let fileAccess: FileAccess = definitionPart.getFileAccess();
    /* Request the data? */
    if (fileContents.isAvailable() == false) {
      /* Add the range */
      fileContents.requestFilePart(
        definitionPart.getOffset(),
        definitionPart.getSize().toInt()
      );
      return null;
    }
    /* Get the data */
    let data: ABuffer = fileContents.getFilePart(
      definitionPart.getOffset(),
      definitionPart.getSize().toInt()
    );
    /* Read the attribute */
    this.readAttribute(data);
    /* Return the reader */
    return this;
  }

  /**
   * AttributeReader abstract method.
   * @see AttributeReader#close
   */
  public close(): void {}

  /**
   * Get the container.
   * @return the container.
   */
  public getContainer(): ContainerFile {
    return this._container;
  }

  /**
   * Get the index.
   * @return the index.
   */
  public getIndex(): int32 {
    return this._index;
  }

  /**
   * Read the definition of the attribute.
   */
  public static readDefinition(
    input: InStream,
    minValue: AttributeValue,
    maxValue: AttributeValue
  ): PointAttribute {
    /* Read the definition */
    let name: string = LittleEndian.readStreamString(input);
    let description: string = LittleEndian.readStreamString(input);
    let type: int32 = LittleEndian.readStreamInt(input);
    let defaultValue: AttributeValue = AttributeValue.readFromStream(
      input,
      type
    );
    let attribute: PointAttribute = new PointAttribute(
      name,
      description,
      type,
      defaultValue
    );
    /* Read the value range */
    let minValue2: AttributeValue = AttributeValue.readFromStream(input, type);
    minValue2.copyTo(minValue);
    let maxValue2: AttributeValue = AttributeValue.readFromStream(input, type);
    maxValue2.copyTo(maxValue);
    /* Return the attribute */
    return attribute;
  }

  /**
   * AttributeReader abstract method.
   * @see AttributeReader#getAttribute
   */
  public getAttribute(): PointAttribute {
    return this._attribute;
  }

  /**
   * AttributeReader abstract method.
   * @see AttributeReader#getMinimumValue
   */
  public getMinimumValue(): AttributeValue {
    return this._minValue;
  }

  /**
   * AttributeReader abstract method.
   * @see AttributeReader#getMaximumValue
   */
  public getMaximumValue(): AttributeValue {
    return this._maxValue;
  }

  /**
   * AttributeReader abstract method.
   * @see AttributeReader#readTileData2
   */
  public readTileData2(
    level: int32,
    tile: TileIndex,
    pointOffset: ALong,
    pointCount: int32,
    tileBuffer: TileReadBuffer,
    bufferIndex: int32,
    readRequest: ReadRequest,
    fileContents: ContentLoader
  ): void {
    /* Get the right part */
    let pointDataPart: ContainerFilePart = this._pointDataParts[level];
    /* Get the file extent */
    let fileName: string = pointDataPart.getFileAccess().getFileName();
    let fileSize: ALong = this._container.getFileLength();
    let offset: ALong = pointDataPart
      .getOffset()
      .add(
        this._attribute.getTypeByteSizeForLongCount(
          tile.pointIndex.add(pointOffset)
        )
      );
    let size: int32 = this._attribute.getTypeByteSizeForCount(pointCount);
    pointDataPart.rangeCheck(offset, ALong.fromInt(size));
    /* Request the data? */
    if (fileContents.isAvailable() == false) {
      /* Add the range */
      fileContents.requestFilePart(offset, size);
      return;
    }
    /* Add the statistics */
    readRequest.addDataSize(size);
    /* Read the content */
    let data: ABuffer = fileContents.getFilePart(offset, size);
    tileBuffer.setAttributeBuffer(bufferIndex, data);
  }

  /**
   * AttributeReader abstract method.
   * @see AttributeReader#getPointData
   */
  public getPointData(
    level: int32,
    tile: TileIndex,
    tileBuffer: TileReadBuffer,
    bufferIndex: int32,
    pointIndex: int32,
    cloudPoint: CloudPoint
  ): void {
    /* Get the buffer */
    let buffer: ABuffer = tileBuffer.getAttributeBuffer(bufferIndex);
    let offset: int32 = this._attribute.getTypeByteSizeForCount(pointIndex);
    /* Read the value */
    let attribute: PointAttribute = cloudPoint.getAttribute(bufferIndex);
    let value: AttributeValue = cloudPoint.getAttributeValue(bufferIndex);
    AttributeValue.readFromBufferTo(buffer, offset, attribute.getType(), value);
    /* Standard attribute? */
    if (this._standardColor) cloudPoint.setColor(value.getColor());
    if (this._standardIntensity) cloudPoint.setIntensity(value.getInt2());
  }
}
