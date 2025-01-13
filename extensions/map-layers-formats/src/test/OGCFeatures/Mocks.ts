/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FeatureAttributeDrivenSymbology, FeatureGeometryRenderer, FeatureSymbolizedRenderer, FeatureSymbologyRenderer, GraphicsGeometryRenderer } from "@itwin/core-frontend";
import { Transform } from "@itwin/core-geometry";

export class MockGeometryRenderer implements FeatureGeometryRenderer {
  public transform: Transform | undefined;
  public attributeSymbology?: FeatureAttributeDrivenSymbology;
  public hasSymbologyRenderer(): this is FeatureSymbolizedRenderer {return false;}
  public async renderPath(_geometryLengths: number[], _geometryCoords: number[], _fill: boolean, _stride: number, _relativeCoords: boolean) {

  }
  public async renderPoint(_geometryLengths: number[], _geometryCoords: number[], _stride: number, _relativeCoords: boolean) {

  }
}

export class MockGraphicsRenderer extends MockGeometryRenderer implements GraphicsGeometryRenderer {
  public moveGraphics() {return [];}
}

export class MockFeatureSymbologyRenderer implements FeatureSymbologyRenderer, FeatureAttributeDrivenSymbology {
  public isAttributeDriven(): this is FeatureAttributeDrivenSymbology {return true;}
  public activeGeometryType = "";
  public activeFeatureAttributes:  {[key: string]: any} = {};
  public rendererFields: string[] = [];
  public setActiveFeatureAttributes(attributes: { [key: string]: any }) {
    this.activeFeatureAttributes = attributes;
  }
}

export class FakeSymbGeomRenderer extends MockGeometryRenderer implements FeatureSymbolizedRenderer {

  public override hasSymbologyRenderer(): this is FeatureSymbolizedRenderer {return true;}

  private _symbolRend = new MockFeatureSymbologyRenderer();
  public  get symbolRenderer(): FeatureSymbologyRenderer {
    return this._symbolRend;
  }
}
