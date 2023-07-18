/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

/** @internal */
export interface ArcGisAttributeDrivenSymbology {
  rendererFields?: string[];
  setActiveFeatureAttributes: (attributes: { [key: string]: any }) => void;
}
