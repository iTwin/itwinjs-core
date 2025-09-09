/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { GraphicList, IModelConnection, Decorations } from "@itwin/core-frontend";
import { CesiumScene } from "./Scene";

/** Base class for converting iTwin.js decorations to Cesium primitives */
export abstract class PrimitiveConverter {
  public abstract convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void;
  public abstract clearDecorations(scene: CesiumScene): void;

  /** Get depth test distance based on decoration type */
  protected getDepthTestDistance(type: string): number {
    if (type === 'worldOverlay' || type === 'viewOverlay') {
      return Number.POSITIVE_INFINITY;
    }
    return 0.0;
  }

  
  //###TODO: viewOverlay should not use world coordinate converter， and need to handel
  /** Convert all decoration types using the specific converter */
  public convertAllDecorationTypes(decorations: Decorations, scene: CesiumScene, iModel?: IModelConnection): void {
    if (decorations.world) {
      this.convertDecorations(decorations.world, 'world', scene, iModel);
    }
    
    if (decorations.normal) {
      this.convertDecorations(decorations.normal, 'normal', scene, iModel);
    }
    
    if (decorations.worldOverlay) {
      this.convertDecorations(decorations.worldOverlay, 'worldOverlay', scene, iModel);
    }
    
    if (decorations.viewOverlay) {
      this.convertDecorations(decorations.viewOverlay, 'viewOverlay', scene, iModel);
    }
    
    if (decorations.viewBackground) {
      this.convertDecorations([decorations.viewBackground], 'viewBackground', scene, iModel);
    }
  }
}