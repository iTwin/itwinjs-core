/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Angle, GeometryQuery, LineString3d, Loop, StandardViewIndex } from "@bentley/geometry-core";
import { Cartographic, Code, ColorDef, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, AxisAlignedBox3d, EcefLocation, ViewFlags } from "@bentley/imodeljs-common";
import { CategorySelector, DefinitionModel, DisplayStyle3d, IModelDb, ModelSelector, OrthographicViewDefinition, PhysicalModel, SpatialCategory, SpatialModel } from "@bentley/imodeljs-backend";
import { GeoJson } from "./GeoJson";

/** */
export class GeoJsonImporter {
  public iModelDb: IModelDb;
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
    this.iModelDb = IModelDb.createStandalone(iModelFileName, { rootSubject: { name: geoJson.title } });
    this._geoJson = geoJson;
  }

  /** Perform the import */
  public import(): void {
    this.definitionModelId = DefinitionModel.insert(this.iModelDb, IModelDb.rootSubjectId, "GeoJSON Definitions");
    this.physicalModelId = PhysicalModel.insert(this.iModelDb, IModelDb.rootSubjectId, "GeoJSON Features");
    this.featureCategoryId = SpatialCategory.insert(this.iModelDb, this.definitionModelId, "GeoJSON Feature", { color: ColorDef.green });

    /** To geo-locate the project, we need to first scan the GeoJSon and extract range. This would not be required
     * if the bounding box was directly available.
     */
    const featureMin = new Cartographic(), featureMax = new Cartographic();
    if (!this.getFeatureRange(featureMin, featureMax))
      return;
    const featureCenter = new Cartographic((featureMin.longitude + featureMax.longitude) / 2, (featureMin.latitude + featureMax.latitude) / 2);

    this.iModelDb.setEcefLocation(EcefLocation.createFromCartographicOrigin(featureCenter));
    this.convertFeatureCollection();

    const featureModel: SpatialModel = this.iModelDb.models.getModel(this.physicalModelId) as SpatialModel;
    const featureModelExtents: AxisAlignedBox3d = featureModel.queryExtents();

    this.insertSpatialView("Spatial View", featureModelExtents);
    this.iModelDb.updateProjectExtents(featureModelExtents);
    this.iModelDb.saveChanges();
  }
  /** Iterate through and accumulate the GeoJSON FeatureCollection range. */
  protected getFeatureRange(featureMin: Cartographic, featureMax: Cartographic) {
    featureMin.longitude = featureMin.latitude = Angle.pi2Radians;
    featureMax.longitude = featureMax.latitude = -Angle.pi2Radians;

    for (const feature of this._geoJson.data.features) {
      if (feature.geometry) {
        switch (feature.geometry.type) {
          case GeoJson.GeometryType.multiPolygon:
            for (const polygon of feature.geometry.coordinates)
              for (const loop of polygon) {
                for (const point of loop) {
                  const longitude = Angle.degreesToRadians(point[0]);
                  const latitude = Angle.degreesToRadians(point[1]);
                  featureMin.longitude = Math.min(longitude, featureMin.longitude);
                  featureMin.latitude = Math.min(latitude, featureMin.latitude);
                  featureMax.longitude = Math.max(longitude, featureMax.longitude);
                  featureMax.latitude = Math.max(latitude, featureMax.latitude);
                }
              }
            break;
          // TBD... Support other geometry types
        }
      }
    }
    return featureMin.longitude < featureMax.longitude && featureMin.latitude < featureMax.latitude;
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
      // TBD... Support other geometry types
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
        return undefined;   // TBD... Multi-loop Regions,
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
  protected insertSpatialView(viewName: string, range: AxisAlignedBox3d): Id64String {
    const modelSelectorId: Id64String = ModelSelector.insert(this.iModelDb, this.definitionModelId, viewName, [this.physicalModelId]);
    const categorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, this.definitionModelId, viewName, [this.featureCategoryId]);
    const viewFlags = new ViewFlags();
    viewFlags.backgroundMap = true;
    const displayStyleId: Id64String = DisplayStyle3d.insert(this.iModelDb, this.definitionModelId, viewName, viewFlags);
    return OrthographicViewDefinition.insert(this.iModelDb, this.definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, range, StandardViewIndex.Top);
  }
}
