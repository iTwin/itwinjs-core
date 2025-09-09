/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { CesiumScene } from "./Scene";

/** Base class for converting iTwin.js decorations to Cesium primitives */
export abstract class PrimitiveConverter {
  public abstract convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void;
  public abstract clearDecorations(scene: CesiumScene): void;
}