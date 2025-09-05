/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
// import { LineString3d, Path } from "@itwin/core-geometry";

/**
 * Professional decorator to create iTwin.js decorations for Cesium conversion
 */
class CesiumDecorator implements Decorator {
  private _iModel?: IModelConnection;

  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  public decorate(context: DecorateContext): void {
    if (!this._iModel || !context.viewport.view.isSpatialView()) {
      return;
    }
    
    try {
      // Method 1: Try decoration - individual points
      this.createPointDecorations(context);
      
    } catch (error) {
      console.error('Point decoration failed:', error);
      
      try {
        // Method 2: Try alternative simple decoration
        this.createMinimalDecoration(context);
        
      } catch (error2) {
        console.error('Minimal decoration also failed:', error2);
      }
    }
  }

  private createPointDecorations(context: DecorateContext): void {
    const center = this._iModel!.projectExtents.center;
    
    // Create individual point decorations - simplest possible approach
    const points = [
      new Point3d(center.x - 25, center.y, center.z + 10),
      new Point3d(center.x, center.y, center.z + 10),
      new Point3d(center.x + 25, center.y, center.z + 10),
    ];
    
    points.forEach((point, index) => {
      const builder = context.createGraphic({ type: GraphicType.WorldDecoration });
      builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
      builder.addPointString([point]);  // Use addPointString for individual points
      
      context.addDecorationFromBuilder(builder);
    });
  }

  private createMinimalDecoration(context: DecorateContext): void {
    const center = this._iModel!.projectExtents.center;
    
    // Try the absolute minimum - single point
    const point = new Point3d(center.x, center.y, center.z + 15);
    
    const builder = context.createGraphic({ type: GraphicType.WorldDecoration });
    builder.setSymbology(ColorDef.green, ColorDef.green, 1);
    builder.addPointString([point]);
    
    context.addDecorationFromBuilder(builder);
  }

  public static start(iModel: IModelConnection): CesiumDecorator {
    const decorator = new CesiumDecorator(iModel);
    IModelApp.viewManager.addDecorator(decorator);
    return decorator;
  }

  public stop(): void {
    IModelApp.viewManager.dropDecorator(this);
    console.log('CesiumDecorator stopped');
  }
}

export { CesiumDecorator };