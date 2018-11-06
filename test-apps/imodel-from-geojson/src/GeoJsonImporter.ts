/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Angle, GeometryQuery, LineString3d, Loop, Point3d } from "@bentley/geometry-core";
import { Cartographic, Code, ColorDef, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, SpatialViewDefinitionProps, AxisAlignedBox3d } from "@bentley/imodeljs-common";
import { IModelDb, IModelImporter, OrthographicViewDefinition, SpatialModel } from "@bentley/imodeljs-backend";
import { GeoJson } from "./GeoJson";

/** */
export class GeoJsonImporter extends IModelImporter {
  public definitionModelId: Id64String = Id64.invalid;
  public physicalModelId: Id64String = Id64.invalid;
  public featureCategoryId: Id64String = Id64.invalid;
  public featureClassFullName = "Generic:SpatialLocation";
  private readonly _geoJson: GeoJson;

  /**
   * Construct a new GeoJsonImporter
   * @param iModelFileName the output iModel file name
   * @param geoJson the input GeoJson data
   */
  public constructor(iModelFileName: string, geoJson: GeoJson) {
    super(iModelFileName, { rootSubject: { name: geoJson.title } });
    this._geoJson = geoJson;
  }

  /** Perform the import */
  public import(): void {
    this.definitionModelId = super.insertDefinitionModel(IModelDb.rootSubjectId, "GeoJSON Definitions");
    this.physicalModelId = super.insertPhysicalModel(IModelDb.rootSubjectId, "GeoJSON Features");
    this.featureCategoryId = super.insertSpatialCategory(this.definitionModelId, "GeoJSON Feature", ColorDef.green);
    this.iModelDb.updateProjectExtents(new AxisAlignedBox3d(new Point3d(-100000, -100000, -100000), new Point3d(100000, 100000, 100000))); // WIP
    this.iModelDb.setEcefLocation({ origin: [1253504, -4731150, 4075980], orientation: {} }); // WIP
    this.convertFeatureCollection();
    this.insertSpatialView(this.definitionModelId, "Spatial View");
    this.iModelDb.saveChanges();
  }

  /** Iterate through the GeoJSON FeatureCollection converting each Feature in the collection. */
  protected convertFeatureCollection(): void {
    const featureProps: GeometricElement3dProps = {
      model: this.physicalModelId,
      code: Code.createEmpty(),
      classFullName: this.featureClassFullName,
      category: this.featureCategoryId,
    };

    for (const featureJson of this._geoJson.data.features) {
      featureProps.geom = this.convertFeatureGeometry(featureJson.geometry);
      featureProps.userLabel = featureJson.properties ? featureJson.properties.mapname : undefined;
      this.iModelDb.elements.insertElement(featureProps);
    }
  }

  /** Convert GeoJSON feature geometry into an iModel GeometryStream. */
  private convertFeatureGeometry(inGeometry: GeoJson.Geometry): GeometryStreamProps | undefined {
    if (!inGeometry)
      return undefined;

    const builder = new GeometryStreamBuilder();
    switch (inGeometry.type) {
      case GeoJson.GeometryType.multiPolygon:
        for (const polygon of inGeometry.coordinates) {
          const outGeometry = this.convertPolygon(polygon);
          if (outGeometry)
            builder.appendGeometry(outGeometry);
        }
        break;
    }
    return builder.geometryStream;
  }

  /** Convert a GeoJSON polygon into geometry that can be appended to an iModel GeometryStream. */
  private convertPolygon(inPolygon: GeoJson.Polygon): GeometryQuery | undefined {
    if (!Array.isArray(inPolygon))
      return undefined;

    const outLoops = [];
    for (const inLoop of inPolygon) {
      const outLoop = this.convertLoop(inLoop);
      if (outLoop)
        outLoops.push(outLoop);
    }
    switch (outLoops.length) {
      case 0:
        return undefined;
      case 1:
        return outLoops[0];
      default:
        return undefined;   // TBD... Multiloop Regions,
    }
  }

  /** Convert a GeoJSON LineString into an @bentley/geometry-core Loop */
  private convertLoop(inLoop: GeoJson.LineString): Loop | undefined {
    if (!Array.isArray(inLoop))
      return undefined;

    const outPoints = [];
    const cartographic = new Cartographic();
    for (const inPoint of inLoop) {
      cartographic.longitude = Angle.degreesToRadians(inPoint[0]);
      cartographic.latitude = Angle.degreesToRadians(inPoint[1]);
      outPoints.push(this.iModelDb.cartographicToSpatial(cartographic));
    }
    return Loop.create(LineString3d.createPoints(outPoints));
  }

  /** Insert a SpatialView configured to display the GeoJSON data that was converted/imported. */
  protected insertSpatialView(definitionModelId: Id64String, viewName: string): Id64String {
    const modelSelectorId: Id64String = super.insertModelSelector(definitionModelId, viewName, [this.physicalModelId]);
    const categorySelectorId: Id64String = super.insertCategorySelector(definitionModelId, viewName, [this.featureCategoryId]);
    const displayStyleId: Id64String = super.insertDisplayStyle3d(definitionModelId, viewName);
    // Insert ViewDefinition
    const featureModel: SpatialModel = this.iModelDb.models.getModel(this.physicalModelId) as SpatialModel;
    const featureModelExtents: AxisAlignedBox3d = featureModel.queryExtents();
    const viewDefinitionProps: SpatialViewDefinitionProps = {
      classFullName: OrthographicViewDefinition.classFullName,
      model: definitionModelId,
      code: OrthographicViewDefinition.createCode(this.iModelDb, definitionModelId, viewName),
      modelSelectorId,
      categorySelectorId,
      displayStyleId,
      origin: featureModelExtents.low,
      extents: [featureModelExtents.xLength(), featureModelExtents.yLength(), featureModelExtents.zLength()],
      cameraOn: false,
      camera: { eye: [0, 0, 0], lens: 0, focusDist: 0 }, // not used when cameraOn === false
    };
    return this.iModelDb.elements.insertElement(viewDefinitionProps);
  }
}
