/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FeatureAttributeDrivenSymbology } from "../../../../tile/internal";

/** Renderer responsible of applying the feature symbology
 */
export interface FeatureSymbologyRenderer {
  isAttributeDriven(): this is FeatureAttributeDrivenSymbology;
  activeGeometryType: string;
}

/** Enables symbology rendering on a Feature renderer
 */
export interface FeatureSymbolizedRenderer {
  symbolRenderer: FeatureSymbologyRenderer;
}

