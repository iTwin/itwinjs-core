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

import { AList } from "../../system/collection/AList";
import { ALong } from "../../system/runtime/ALong";
import { ASystem } from "../../system/runtime/ASystem";
import { Strings } from "../../system/runtime/Strings";
import { AttributeTypes } from "./AttributeTypes";
import { AttributeValue } from "./AttributeValue";

/**
 * Class PointAttribute defines an attribute of a point.
 *
 * @version 1.0 August 2013
 */
/** @internal */
export class PointAttribute {
  /** The name of the attribute */
  private _name: string;
  /** The description of the attribute */
  private _description: string;
  /** The type of the attribute */
  private _type: int32;
  /** The default value of the attribute */
  private _defaultValue: AttributeValue;
  /** The optional minimum value of the attribute */
  private _minValue: AttributeValue;
  /** The optional maximum value of the attribute */
  private _maxValue: AttributeValue;

  /** Is this a standard attribute? (color/intensity/weight)? */
  private _standardAttribute: boolean;

  /**
   * Create a new point attribute.
   * @param name the name of the attribute.
   * @param description the description of the attribute.
   * @param type the type of the attribute.
   * @param default value the default value of the attribute (use null to create a default value).
   */
  public constructor(
    name: string,
    description: string,
    type: int32,
    defaultValue: AttributeValue
  ) {
    if (defaultValue == null) defaultValue = AttributeValue.createDefault(type);
    ASystem.assert0(
      defaultValue.getType() == type,
      "Default value " + defaultValue + " does not match attribute type " + type
    );
    this._name = name;
    this._description = description;
    this._type = type;
    this._defaultValue = defaultValue;
    this._minValue = null;
    this._maxValue = null;
    this._standardAttribute = false;
  }

  /**
   * Get the name.
   * @return the name.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Set the name.
   * @param name the new name.
   */
  public setName(name: string): void {
    this._name = name;
  }

  /**
   * Check the name.
   * @param name the name to check.
   * @return true if equal.
   */
  public hasName(name: string): boolean {
    if (name == null) return false;
    if (Strings.equalsIgnoreCase(name, this._name)) return true;
    return false;
  }

  /**
   * Get the description.
   * @return the description.
   */
  public getDescription(): string {
    return this._description;
  }

  /**
   * Get the type.
   * @return the type.
   */
  public getType(): int32 {
    return this._type;
  }

  /**
   * Get the byte-size of the type.
   * @return the byte-size of the type.
   */
  public getTypeByteSize(): int32 {
    return PointAttribute.getByteSize(this._type, 1);
  }

  /**
   * Get the byte-size of a number of values.
   * @param attributeCount the number of values.
   * @return the byte-size.
   */
  public getTypeByteSizeForCount(attributeCount: int32): int32 {
    return PointAttribute.getByteSize(this._type, attributeCount);
  }

  /**
   * Get the byte-size of a number of values.
   * @param attributeCount the number of values.
   * @return the byte-size.
   */
  public getTypeByteSizeForLongCount(attributeCount: ALong): ALong {
    return PointAttribute.getByteSizeForCount(this._type, attributeCount);
  }

  /**
   * Get the default value.
   * @return the default value.
   */
  public getDefaultValue(): AttributeValue {
    return this._defaultValue;
  }

  /**
   * Get the optional minimum value.
   * @return the optional minimum value.
   */
  public getMinValue(): AttributeValue {
    return this._minValue;
  }

  /**
   * Set the optional minimum value.
   * @param value the optional minimum value.
   */
  public setMinValue(value: AttributeValue): void {
    this._minValue = value;
  }

  /**
   * Get the optional maximum value.
   * @return the optional maximum value.
   */
  public getMaxValue(): AttributeValue {
    return this._maxValue;
  }

  /**
   * Set the optional maximum value.
   * @param value the optional maximum value.
   */
  public setMaxValue(value: AttributeValue): void {
    this._maxValue = value;
  }

  /**
   * Set the description of a copy.
   * @param description the new description.
   * @return the copy.
   */
  public setDescription(description: string): PointAttribute {
    return new PointAttribute(
      this._name,
      description,
      this._type,
      this._defaultValue
    );
  }

  /**
   * Is this a standard attribute (like color/intensity/weight)?
   * @return true for a standard attribute.
   */
  public isStandardAttribute(): boolean {
    return this._standardAttribute;
  }

  /**
   * Make this a standard attribute (like color/intensity/weight).
   * @param standard true if this is a standard attribute.
   * @return this attribute for convenience.
   */
  public setStandardAttribute(standard: boolean): PointAttribute {
    this._standardAttribute = standard;
    return this;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[PointAttribute:name='" +
      this._name +
      "',type=" +
      PointAttribute.getTypeName(this._type) +
      ",default=" +
      this._defaultValue +
      "]"
    );
  }

  /**
   * Get the name of a type.
   * @param attributeType the type of attributes.
   * @return the name.
   */
  public static getTypeName(attributeType: int32): string {
    if (attributeType <= 0) return "none";
    if (attributeType == AttributeTypes.TYPE_BOOLEAN) return "boolean";
    if (attributeType == AttributeTypes.TYPE_INT1) return "int1";
    if (attributeType == AttributeTypes.TYPE_INT2) return "int2";
    if (attributeType == AttributeTypes.TYPE_INT4) return "int4";
    if (attributeType == AttributeTypes.TYPE_INT8) return "int8";
    if (attributeType == AttributeTypes.TYPE_FLOAT4) return "float4";
    if (attributeType == AttributeTypes.TYPE_FLOAT8) return "float8";
    if (attributeType == AttributeTypes.TYPE_COLOR) return "color";
    return "" + attributeType;
  }

  /**
   * Get the bit size for a type.
   * @param attributeType the type of attributes.
   * @return the number of bits.
   */
  public static getBitSize(attributeType: int32): int32 {
    if (attributeType == AttributeTypes.TYPE_BOOLEAN) return 1;
    if (attributeType == AttributeTypes.TYPE_INT1) return 8;
    if (attributeType == AttributeTypes.TYPE_INT2) return 16;
    if (attributeType == AttributeTypes.TYPE_INT4) return 32;
    if (attributeType == AttributeTypes.TYPE_INT8) return 64;
    if (attributeType == AttributeTypes.TYPE_FLOAT4) return 32;
    if (attributeType == AttributeTypes.TYPE_FLOAT8) return 64;
    if (attributeType == AttributeTypes.TYPE_COLOR) return 24;
    return 0;
  }

  /**
   * Get the byte size for a number of attributes.
   * @param attributeType the type of attributes.
   * @param attributeCount the number of attributes.
   */
  public static getByteSize(
    attributeType: int32,
    attributeCount: int32
  ): int32 {
    if (attributeCount <= 0) return 0;
    if (attributeType == AttributeTypes.TYPE_BOOLEAN)
      return ((attributeCount - 1) >> 3) + 1;
    if (attributeType == AttributeTypes.TYPE_INT1) return attributeCount;
    if (attributeType == AttributeTypes.TYPE_INT2) return attributeCount << 1;
    if (attributeType == AttributeTypes.TYPE_INT4) return attributeCount << 2;
    if (attributeType == AttributeTypes.TYPE_INT8) return attributeCount << 3;
    if (attributeType == AttributeTypes.TYPE_FLOAT4) return attributeCount << 2;
    if (attributeType == AttributeTypes.TYPE_FLOAT8) return attributeCount << 3;
    if (attributeType == AttributeTypes.TYPE_COLOR) return attributeCount * 3;
    return 0;
  }

  /**
   * Get the byte size for a number of attributes.
   * @param attributeType the type of attributes.
   * @param attributeCount the number of attributes.
   */
  public static getByteSizeForCount(
    attributeType: int32,
    attributeCount: ALong
  ): ALong {
    if (attributeCount.isPositive() == false) return ALong.ZERO;
    if (attributeType == AttributeTypes.TYPE_BOOLEAN)
      return attributeCount.subInt(1).divInt(8).addInt(1);
    if (attributeType == AttributeTypes.TYPE_INT1)
      return attributeCount.mulInt(1);
    if (attributeType == AttributeTypes.TYPE_INT2)
      return attributeCount.mulInt(2);
    if (attributeType == AttributeTypes.TYPE_INT4)
      return attributeCount.mulInt(4);
    if (attributeType == AttributeTypes.TYPE_INT8)
      return attributeCount.mulInt(8);
    if (attributeType == AttributeTypes.TYPE_FLOAT4)
      return attributeCount.mulInt(4);
    if (attributeType == AttributeTypes.TYPE_FLOAT8)
      return attributeCount.mulInt(8);
    if (attributeType == AttributeTypes.TYPE_COLOR)
      return attributeCount.mulInt(3);
    return ALong.ZERO;
  }

  /**
   * Find the index of an attribute.
   * @param attributes the list of attributes.
   * @param attributeName the name of an attribute.
   * @return the index (negative if not found).
   */
  public static indexOfName(
    attributes: Array<PointAttribute>,
    attributeName: string
  ): int32 {
    if (attributes == null) return -1;
    if (attributeName == null) return -1;
    for (let i: number = 0; i < attributes.length; i++)
      if (attributes[i].hasName(attributeName)) return i;
    return -1;
  }

  /**
   * Find the index of an attribute.
   * @param attributes the list of attributes.
   * @param attribute the definition of an attribute.
   * @return the index (negative if not found).
   */
  public static indexOf(
    attributes: Array<PointAttribute>,
    attribute: PointAttribute
  ): int32 {
    if (attributes == null) return -1;
    if (attribute == null) return -1;
    for (let i: number = 0; i < attributes.length; i++)
      if (attributes[i].hasName(attribute.getName())) return i;
    return -1;
  }

  /**
   * Check if an attribute exists.
   * @param attributes the list of attributes.
   * @param attributeName the name of an attribute.
   * @return true if found.
   */
  public static hasAttributeName(
    attributes: Array<PointAttribute>,
    attributeName: string
  ): boolean {
    return PointAttribute.indexOfName(attributes, attributeName) >= 0;
  }

  /**
   * Check if an attribute exists.
   * @param attributes the list of attributes.
   * @param attribute the definition of an attribute.
   * @return true if found.
   */
  public static hasAttribute(
    attributes: Array<PointAttribute>,
    attribute: PointAttribute
  ): boolean {
    return PointAttribute.indexOf(attributes, attribute) >= 0;
  }

  /**
   * Find the index of an attribute.
   * @param attributes the list of attributes.
   * @param attributeName the name of an attribute.
   * @return the index (negative if not found).
   */
  public static listIndexOfName(
    attributes: AList<PointAttribute>,
    attributeName: string
  ): int32 {
    if (attributes == null) return -1;
    if (attributeName == null) return -1;
    for (let i: number = 0; i < attributes.size(); i++)
      if (attributes.get(i).hasName(attributeName)) return i;
    return -1;
  }

  /**
   * Find the index of an attribute.
   * @param attributes the list of attributes.
   * @param attribute the definition of an attribute.
   * @return the index (negative if not found).
   */
  public static listIndexOf(
    attributes: AList<PointAttribute>,
    attribute: PointAttribute
  ): int32 {
    if (attributes == null) return -1;
    if (attribute == null) return -1;
    for (let i: number = 0; i < attributes.size(); i++)
      if (attributes.get(i).hasName(attribute.getName())) return i;
    return -1;
  }

  /**
   * Check if an attribute exists.
   * @param attributes the list of attributes.
   * @param attributeName the name of an attribute.
   * @return true if found.
   */
  public static listHasAttributeName(
    attributes: AList<PointAttribute>,
    attributeName: string
  ): boolean {
    return PointAttribute.listIndexOfName(attributes, attributeName) >= 0;
  }

  /**
   * Check if an attribute exists.
   * @param attributes the list of attributes.
   * @param attribute the definition of an attribute.
   * @return true if found.
   */
  public static listHasAttribute(
    attributes: AList<PointAttribute>,
    attribute: PointAttribute
  ): boolean {
    return PointAttribute.listIndexOf(attributes, attribute) >= 0;
  }
}
