/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.model;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "../../spatial/geom/Bounds";
import { AList } from "../../system/collection/AList";
import { ALong } from "../../system/runtime/ALong";
import { Strings } from "../../system/runtime/Strings";

/**
 * Class ReadRequest allows selective reading of information from a point cloud file.
 *
 * @version 1.0 December 2011
 */
/** @internal */
export class ReadRequest {
  /** The request to only read the geometry */
  public static readonly READ_GEOMETRY: ReadRequest = ReadRequest.getGeometry();
  /** The request to only read the geometry and color */
  public static readonly READ_GEOMETRY_AND_COLOR: ReadRequest =
    ReadRequest.getGeometryAndColor();
  /** The request to read geometry and attributes */
  public static readonly READ_ALL: ReadRequest =
    ReadRequest.getGeometryAndAttributes();

  /** Should the geometry be read? */
  private _readGeometryAttribute: boolean;
  /** Should the color be read? */
  private _readColorAttribute: boolean;
  /** Should the intensity be read? */
  private _readIntensityAttribute: boolean;
  /** Should the weight be read? */
  private _readWeightAttribute: boolean;
  /** Should thinning be used? */
  private _thinning: int32;
  /** The list of extra attributes that should be read */
  private _extraAttributes: AList<string>;
  /** Should the deleted points be read as well? */
  private _readDeletedAttribute: boolean;

  /** An optional 2D area to filter */
  private _areaFilter: Bounds;

  /** The number read transactions */
  private _dataTransactions: int32;
  /** The number of bytes read for this request */
  private _dataSize: ALong;
  /** The number of nanoseconds spent reading data */
  private _dataReadTime: ALong;

  /**
   * Create a new request to read all data (geometry and attributes) (except deleted points).
   */
  public constructor() {
    /* Read the geometry */
    this._readGeometryAttribute = true;
    /* Read all standard attributes */
    this._readColorAttribute = true;
    this._readIntensityAttribute = true;
    this._readWeightAttribute = true;
    this._thinning = 0;
    /* Read all extra attributes */
    this._extraAttributes = new AList<string>();
    this._extraAttributes.add("*");
    /* Default to not reading deleted points */
    this._readDeletedAttribute = false;
    /* Clear */
    this._areaFilter = null;
    this._dataTransactions = 0;
    this._dataSize = ALong.ZERO;
    this._dataReadTime = ALong.ZERO;
  }

  /**
   * Create a new request.
   * @param readColor should the color be read?
   * @param readIntensity should the intensity be read?
   * @param readWeight should the weight be read?
   * @param thinning should thinning be used?
   */
  public static create(
    readColor: boolean,
    readIntensity: boolean,
    readWeight: boolean,
    thinning: int32
  ): ReadRequest {
    let request: ReadRequest = new ReadRequest();
    request._readColorAttribute = readColor;
    request._readIntensityAttribute = readIntensity;
    request._readWeightAttribute = readWeight;
    request._thinning = thinning;
    request._extraAttributes.clear();
    return request;
  }

  /**
   * Create the request to only read the geometry.
   * @return the request.
   */
  public static getGeometry(): ReadRequest {
    return ReadRequest.create(
      false /*color*/,
      false /*intensity*/,
      false /*weight*/,
      0 /*thinning*/
    );
  }

  /**
   * Create the request to only read the geometry and colot.
   * @return the request.
   */
  public static getGeometryAndColor(): ReadRequest {
    return ReadRequest.create(
      true /*color*/,
      false /*intensity*/,
      false /*weight*/,
      0 /*thinning*/
    );
  }

  /**
   * Create the request to read the full geometry and all attributes.
   * @return the request.
   */
  public static getGeometryAndAttributes(): ReadRequest {
    return new ReadRequest();
  }

  /**
   * Should the geometry be read?
   * @return true if it should be read.
   */
  public readGeometry(): boolean {
    return this._readGeometryAttribute;
  }

  /**
   * Should the geometry be read?
   * @param read true if it should be read.
   */
  public setReadGeometry(read: boolean): void {
    this._readGeometryAttribute = read;
  }

  /**
   * Should the color be read?
   * @return true if it should be read.
   */
  public readColor(): boolean {
    return this._readColorAttribute;
  }

  /**
   * Should the intensity be read?
   * @return true if it should be read.
   */
  public readIntensity(): boolean {
    return this._readIntensityAttribute;
  }

  /**
   * Should the weight be read?
   * @return true if it should be read.
   */
  public readWeight(): boolean {
    return this._readWeightAttribute;
  }

  /**
   * Should thinning be used?
   * @return the thinning factor.
   */
  public getThinning(): int32 {
    return this._thinning;
  }

  /**
   * Should the deleted points be read?
   * @return true if they should be read.
   */
  public readDeleted(): boolean {
    return this._readDeletedAttribute;
  }

  /**
   * Should the deleted points be read?
   * @param read true if they should be read.
   */
  public setReadDeleted(read: boolean): void {
    this._readDeletedAttribute = read;
  }

  /**
   * Should all extra attributes be read?
   * @return true if all extra attribute should be read.
   */
  public readAllExtraAttributes(): boolean {
    if (this._extraAttributes.size() != 1) return false;
    let extraAttribute: string = this._extraAttributes.get(0);
    return Strings.equals(extraAttribute, "*");
  }

  /**
   * Get the list of extra attributes to read.
   * @return the list of extra attributes to read.
   */
  public getExtraAttributes(): AList<string> {
    return this._extraAttributes;
  }

  /**
   * Set the list of extra attributes to read.
   * @param list the list of extra attributes to read.
   */
  public setExtraAttributes(list: AList<string>): void {
    this._extraAttributes = list;
  }

  /**
   * Add the name of an extra attribute to read.
   * @param attributeName the name of the attribute to read.
   * @return this request for convenient chaining.
   */
  public addExtraAttribute(attributeName: string): ReadRequest {
    this._extraAttributes.add(attributeName);
    return this;
  }

  /**
   * Get the area filter.
   * @return the area filter.
   */
  public getAreaFilter(): Bounds {
    return this._areaFilter;
  }

  /**
   * Set the area filter.
   * @param filter the new area filter.
   */
  public setAreaFilter(filter: Bounds): void {
    this._areaFilter = filter;
  }

  /**
   * Add a number of bytes to the data size.
   * @param size the number of bytes.
   */
  public addDataSize(size: int32): void {
    this._dataSize = this._dataSize.addInt(size);
    this._dataTransactions++;
  }

  /**
   * Get the data size of the request.
   * @return the number of bytes.
   */
  public getDataSize(): ALong {
    return this._dataSize;
  }

  /**
   * Clear the data size of the request.
   */
  public clearDataSize(): void {
    this._dataSize = ALong.ZERO;
    this._dataTransactions = 0;
  }

  /**
   * Get the number of data transactions.
   * @return the number of data transactions.
   */
  public getDataTransactions(): int32 {
    return this._dataTransactions;
  }

  /**
   * Add a number of nanoseconds to the data read time.
   * @param time the number of nanoseconds.
   */
  public addDataReadTime(time: ALong): void {
    this._dataReadTime = this._dataReadTime.add(time);
  }

  /**
   * Get the data read time of the request.
   * @return the number of nanoseconds.
   */
  public getDataReadTime(): ALong {
    return this._dataReadTime;
  }

  /**
   * Clear the data read time of the request.
   */
  public clearDataReadTime(): void {
    this._dataReadTime = ALong.ZERO;
  }
}
