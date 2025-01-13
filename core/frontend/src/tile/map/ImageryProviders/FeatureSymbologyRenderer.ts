/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FeatureAttributeDrivenSymbology } from "../../internal";

/** Renderer responsible of applying the feature symbology
 * @internal
 */
export interface FeatureSymbologyRenderer {
  isAttributeDriven(): this is FeatureAttributeDrivenSymbology;
  activeGeometryType: string;
}

/** Enables symbology rendering on a Feature renderer
 * @internal
 */
export interface FeatureSymbolizedRenderer {
  symbolRenderer: FeatureSymbologyRenderer;
}

