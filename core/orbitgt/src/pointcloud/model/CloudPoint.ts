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

import { Coordinate } from "../../spatial/geom/Coordinate";
import { ALong } from "../../system/runtime/ALong";
import { Message } from "../../system/runtime/Message";
import { Numbers } from "../../system/runtime/Numbers";
import { AttributeValue } from "./AttributeValue";
import { PointAttribute } from "./PointAttribute";

/**
 * Class CloudPoint defines a point in the point cloud.
 *
 * @version 1.0 November 2011
 */
/** @internal */
export class CloudPoint {
  /** The name of this module */
  private static readonly MODULE: string = "CloudPoint";

  /** The index */
  private _index: ALong;
  /** The x position */
  private _x: float64;
  /** The y position */
  private _y: float64;
  /** The z position */
  private _z: float64;
  /** The ARGB color */
  private _color: int32;
  /** The intensity */
  private _intensity: int32;
  /** The weight */
  private _weight: int32;
  /** Has the point been selected? */
  private _selected: boolean;

  /** The definitions of the extra attributes */
  private _attributes: Array<PointAttribute>;
  /** The values of the extra attributes */
  private _values: Array<AttributeValue>;

  /**
   * Create a new point.
   */
  public constructor() {
    this._index = ALong.ZERO;
    this._x = 0.0;
    this._y = 0.0;
    this._z = 0.0;
    this._color = 0;
    this._intensity = 0;
    this._weight = 0;
    this._selected = false;
    this._attributes = null;
    this._values = null;
  }

  /**
   * Create a new point.
   * @param index the index of the point.
   * @param x the x position.
   * @param y the y position.
   * @param z the z position.
   * @param color the ARGB color.
   * @param intensity the intensity.
   * @return the new point.
   */
  public static create(
    index: ALong,
    x: float64,
    y: float64,
    z: float64,
    color: int32,
    intensity: int32
  ): CloudPoint {
    let point: CloudPoint = new CloudPoint();
    point._index = index;
    point._x = x;
    point._y = y;
    point._z = z;
    point._color = color;
    point._intensity = intensity;
    return point;
  }

  /**
   * Create a new point.
   * @param attributes the definitions of the attributes.
   * @return the new point.
   */
  public static createWithAttributes(
    attributes: Array<PointAttribute>
  ): CloudPoint {
    let point: CloudPoint = new CloudPoint();
    point._attributes = attributes;
    if (attributes != null) {
      point._values = new Array<AttributeValue>(attributes.length);
      for (let i: number = 0; i < attributes.length; i++)
        point._values[i] = new AttributeValue();
    }
    return point;
  }

  /**
   * Clear the point.
   */
  public clear(): void {
    this._index = ALong.ZERO;
    this._x = 0.0;
    this._y = 0.0;
    this._z = 0.0;
    this._color = 0;
    this._intensity = 0;
    this._weight = 0;
    this._selected = false;
  }

  /**
   * Get the index.
   * @return the index.
   */
  public getIndex(): ALong {
    return this._index;
  }

  /**
   * Set the index.
   * @param index the index.
   */
  public setIndex(index: ALong): void {
    this._index = index;
  }

  /**
   * Get the x position.
   * @return the x position.
   */
  public getX(): float64 {
    return this._x;
  }

  /**
   * Set the x position.
   * @param x the new x position.
   */
  public setX(x: float64): void {
    this._x = x;
  }

  /**
   * Get the y position.
   * @return the y position.
   */
  public getY(): float64 {
    return this._y;
  }

  /**
   * Set the y position.
   * @param y the new y position.
   */
  public setY(y: float64): void {
    this._y = y;
  }

  /**
   * Get the z position.
   * @return the z position.
   */
  public getZ(): float64 {
    return this._z;
  }

  /**
   * Set the z position.
   * @param z the new z position.
   */
  public setZ(z: float64): void {
    this._z = z;
  }

  /**
   * Get the ARGB color.
   * @return the color.
   */
  public getColor(): int32 {
    return this._color;
  }

  /**
   * Set the color.
   * @param color the new color.
   */
  public setColor(color: int32): void {
    this._color = color;
  }

  /**
   * Get the intensity.
   * @return the intensity.
   */
  public getIntensity(): int32 {
    return this._intensity;
  }

  /**
   * Set the intensity.
   * @param intensity the new intensity.
   */
  public setIntensity(intensity: int32): void {
    this._intensity = intensity;
  }

  /**
   * Get the weight.
   * @return the weight.
   */
  public getWeight(): int32 {
    return this._weight;
  }

  /**
   * Set the weight.
   * @param weight the weight.
   */
  public setWeight(weight: int32): void {
    this._weight = weight;
  }

  /**
   * Has the point been selected?
   * @return true if selected.
   */
  public isSelected(): boolean {
    return this._selected;
  }

  /**
   * Select the point.
   * @param selected true if the point has been selected.
   */
  public setSelected(selected: boolean): void {
    this._selected = selected;
  }

  /**
   * Get the attribute definitions.
   * @return the attribute definitions.
   */
  public getAttributes(): Array<PointAttribute> {
    return this._attributes;
  }

  /**
   * Get an attribute definitions.
   * @param index the index of the attribute.
   * @return an attribute definitions.
   */
  public getAttribute(index: int32): PointAttribute {
    return this._attributes[index];
  }

  /**
   * Get the attribute values.
   * @return the attribute values.
   */
  public getAttributeValues(): Array<AttributeValue> {
    return this._values;
  }

  /**
   * Get an attribute value.
   * @param index the index of the value.
   * @return the value.
   */
  public getAttributeValue(index: int32): AttributeValue {
    return this._values[index];
  }

  /**
   * Get an attribute value.
   * @param attributeName the name of the attribute.
   * @return the value.
   */
  public getNamedAttributeValue(attributeName: string): AttributeValue {
    let index: int32 = PointAttribute.indexOfName(
      this._attributes,
      attributeName
    );
    return index < 0 ? null : this._values[index];
  }

  /**
   * Set the attributes.
   * @param attributes the definitions of the attributes.
   * @param values the values of the attributes.
   */
  public setAttributes(
    attributes: Array<PointAttribute>,
    values: Array<AttributeValue>
  ): void {
    this._attributes = attributes;
    this._values = values;
  }

  /**
   * Copy the values to another point.
   * @param other the other point.
   */
  public copyTo(other: CloudPoint): void {
    other._index = this._index;
    other._x = this._x;
    other._y = this._y;
    other._z = this._z;
    other._color = this._color;
    other._intensity = this._intensity;
    other._weight = this._weight;
    other._selected = this._selected;
    other._attributes = this._attributes;
    other._values = AttributeValue.copyList(this._values);
  }

  /**
   * Make a copy.
   * @return a copy.
   */
  public copy(): CloudPoint {
    let copy: CloudPoint = new CloudPoint();
    this.copyTo(copy);
    return copy;
  }

  /**
   * Get the distance to another point.
   * @param other the other point.
   * @return the distance.
   */
  public getDistance(other: CloudPoint): float64 {
    let dx: float64 = other._x - this._x;
    let dy: float64 = other._y - this._y;
    let dz: float64 = other._z - this._z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get the square distance to another point.
   * @param other the other point.
   * @return the square distance.
   */
  public getSquareDistance(other: CloudPoint): float64 {
    let dx: float64 = other._x - this._x;
    let dy: float64 = other._y - this._y;
    let dz: float64 = other._z - this._z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Get a coordinate.
   * @return a coordinate.
   */
  public getCoordinate(): Coordinate {
    return new Coordinate(this._x, this._y, this._z);
  }

  /**
   * Print the point.
   */
  public print(): void {
    Message.print(CloudPoint.MODULE, "Index: " + this._index);
    Message.print(
      CloudPoint.MODULE,
      "Position: " + this._x + "," + this._y + "," + this._z
    );
    Message.print(
      CloudPoint.MODULE,
      "Color: " + Numbers.rgbToString(this._color)
    );
    Message.print(CloudPoint.MODULE, "Intensity: " + this._intensity);
    Message.print(CloudPoint.MODULE, "Weight: " + this._weight);
    Message.print(CloudPoint.MODULE, "Selected? " + this._selected);
    if (this._attributes != null)
      for (let i: number = 0; i < this._attributes.length; i++)
        Message.print(
          CloudPoint.MODULE,
          "Attribute '" +
            this._attributes[i].getName() +
            "': " +
            this._values[i]
        );
  }
}
