/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Element.subclass
import { SpatialLocationElement, IModelDb, SpatialCategory } from "@bentley/imodeljs-backend";
import { GeometryStreamBuilder, GeometryStreamProps } from "@bentley/imodeljs-common";
import { Polyface } from "@bentley/geometry-core";
import { Analysis } from "./AnalysisSchema";
import { AnalysisSchema } from "./AnalysisSchema";

export class AnalysisMeshElement extends SpatialLocationElement {
  //  Define the properties added by this subclass

  // Note: Do not redefine the constructor. You must not interfere with the constructor that is
  // already defined by the base Element class.

  // You can provide handy methods for creating new nodes
  public static generateGeometry(polyface: Polyface): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();  // I know what graphics represent a node.
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
