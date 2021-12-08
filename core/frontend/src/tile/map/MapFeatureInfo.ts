/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { PropertyDescription, PropertyRecord, PropertyValue } from "@itwin/appui-abstract";
import { Cartographic } from "@itwin/core-common";

export class MapFeatureInfoRecord extends PropertyRecord {
  public constructor(value: PropertyValue, property: PropertyDescription) {
    super(value, property);
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
