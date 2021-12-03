/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Cartographic } from "./geometry/Cartographic";

export enum FeatureInfoPropertyValueFormat {
  Primitive,
  // todo: Array,Struct,
}
export interface FeatureInfoBasePropertyValue {
  valueFormat: FeatureInfoPropertyValueFormat;
}
export interface FeatureInfoPrimitiveValue extends FeatureInfoBasePropertyValue {
  valueFormat: FeatureInfoPropertyValueFormat.Primitive;
  rawValue?: any;
  stringValue?: string;
}

export interface FeatureInfoPropertyDescription {
  name: string;
  displayLabel: string;
  typename: string;
}

export type FeatureInfoPropertyValue = FeatureInfoPrimitiveValue; // todo: struct, array

export class MapFeatureInfoRecord {
  public readonly value: FeatureInfoPropertyValue;
  public readonly property: FeatureInfoPropertyDescription;

  /** Constructs a PropertyRecord instance */
  public constructor(value: FeatureInfoPropertyValue, property: FeatureInfoPropertyDescription) {
    this.value = value;
    this.property = property;
  }
}

export interface MapFeatureInfo {
  layerInfo?: MapLayerFeatureInfo[];
  hitPoint?: Cartographic;
}

export interface MapLayerFeatureInfo {
  layerName: string;
  info?: MapSubLayerFeatureInfo[] | HTMLElement;
}

export interface MapSubLayerFeatureInfo {
  subLayerName: string;
  displayFieldName?: string;
  records?: MapFeatureInfoRecord[];
}
