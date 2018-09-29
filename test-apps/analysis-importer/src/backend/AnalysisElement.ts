/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Element.subclass
import { SpatialLocationElement, IModelDb, SpatialCategory } from "@bentley/imodeljs-backend";
import { GeometryStreamBuilder, GeometryStreamProps, GeometryParams, Gradient, FillDisplay } from "@bentley/imodeljs-common";
import { Polyface, Range1d } from "@bentley/geometry-core";
import { Analysis } from "./AnalysisSchema";
import { AnalysisSchema } from "./AnalysisSchema";
import { Id64 } from "@bentley/bentleyjs-core";

export class AnalysisMeshElement extends SpatialLocationElement {

  // Note: Do not redefine the constructor. You must not interfere with the constructor that is
  // already defined by the base Element class.

  // You can provide handy methods for creating new nodes
  public static generateGeometry(polyface: Polyface, categoryId: Id64): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();  // I know what graphics represent a node.
    let scalarRange: Range1d | undefined;

    if (polyface.data.auxData !== undefined)
      for (const channel of polyface.data.auxData.channels)
        if (undefined !== (scalarRange = channel.scalarRange))
          break;
    if (undefined !== scalarRange) {
      const geomParams = new GeometryParams(categoryId);
      const thematicSettings = new Gradient.ThematicSettings();

      thematicSettings.range = scalarRange;
      geomParams.fillDisplay = FillDisplay.Always;
      geomParams.gradient = Gradient.Symb.createThematic(thematicSettings);

      builder.appendGeometryParamsChange(geomParams);
    }
    builder.appendGeometry(polyface);

    return builder.geometryStream;
  }

  public static getCategory(iModel: IModelDb): SpatialCategory {
    return AnalysisSchema.getCategory(iModel, Analysis.Class.Mesh);
  }
  // You can write methods to implement business logic that apps can call.
  public someBusinessLogic(): void {
    if ((this.testProperty === "something") && this.isPrivate) {
      // ... do something ...
    }
  }
}
// __PUBLISH_EXTRACT_END__
