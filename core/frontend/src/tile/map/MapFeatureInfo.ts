/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { PropertyDescription, PropertyRecord, PropertyValue } from "@itwin/appui-abstract";
import { Cartographic } from "@itwin/core-common";
import { GraphicPrimitive } from "../../render/GraphicPrimitive";
/** @alpha */
export class MapFeatureInfoRecord extends PropertyRecord {
  public constructor(value: PropertyValue, property: PropertyDescription) {
    super(value, property);
  }
}

/** @alpha */
export interface MapFeatureInfo {
  layerInfos?: MapLayerFeatureInfo[];
  hitPoint?: Cartographic;
}

/** @alpha */
export interface MapLayerFeatureInfo {
  layerName: string;
  subLayerInfos?: MapSubLayerFeatureInfo[] | HTMLElement;
}

/** @alpha */
export interface MapSubLayerFeatureInfo {
  subLayerName: string;
  displayFieldName?: string;
  graphics?: GraphicPrimitive[];
  records?: MapFeatureInfoRecord[];
}
