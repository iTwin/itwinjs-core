/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64String, OpenMode } from "@itwin/core-bentley";
import { Angle, Arc3d, GeometryQuery, LineString3d, Loop, Range3d, StandardViewIndex } from "@itwin/core-geometry";
import {
  CategorySelector, DefinitionModel, DisplayStyle3d, IModelDb, ModelSelector, OrthographicViewDefinition, PhysicalModel, SnapshotDb, SpatialCategory,
  SpatialModel, StandaloneDb, ViewDefinition,
} from "@itwin/core-backend";
import {
  AxisAlignedBox3d, BackgroundMapType, Cartographic, Code, ColorByName, ColorDef, EcefLocation, GeometricElement3dProps,
  GeometryParams, GeometryStreamBuilder, GeometryStreamProps, IModel, PersistentBackgroundMapProps, RenderMode, ViewFlags,
} from "@itwin/core-common";
import { insertClassifiedRealityModel } from "./ClassifyRealityModel";
import { GeoJson } from "./GeoJson";

/** */
export class GeoJsonImporter {
  public iModelDb: IModelDb;
  public definitionModelId: Id64String = Id64.invalid;
  public physicalModelId: Id64String = Id64.invalid;
  public featureCategoryId: Id64String = Id64.invalid;
  public featureClassFullName = "Generic:SpatialLocation";
  private readonly _geoJson: GeoJson;
  private readonly _appendToExisting: boolean;
  private readonly _modelName?: string;
  private readonly _forceZeroHeight = true;
  private readonly _labelProperty?: string;
  private readonly _pointRadius: number;
  private _colorIndex?: number;
  private readonly _viewFlags: ViewFlags;
  private readonly _backgroundMap: PersistentBackgroundMapProps | undefined;

  /** Construct a new GeoJsonImporter
   * @param iModelFileName the output iModel file name
   * @param geoJson the input GeoJson data
   */
  public constructor(iModelFileName: string, geoJson: GeoJson, appendToExisting: boolean, modelName?: string, labelProperty?: string, pointRadius?: number, pseudoColor?: boolean, mapTypeString?: string, mapGroundBias?: number,
    private _classifiedURL?: string, private _classifiedName?: string, private _classifiedOutside?: string, private _classifiedInside?: string) {
    this.iModelDb = appendToExisting ? StandaloneDb.openFile(iModelFileName, OpenMode.ReadWrite) : SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: geoJson.title } });
    this._geoJson = geoJson;
    this._appendToExisting = appendToExisting;
    this._modelName = modelName;
    this._labelProperty = labelProperty;
    this._pointRadius = pointRadius === undefined ? .25 : pointRadius;
    this._colorIndex = pseudoColor ? 0 : undefined;

    let mapType;
    switch (mapTypeString) {
      case "streets": mapType = BackgroundMapType.Street; break;
      case "aerial": mapType = BackgroundMapType.Aerial; break;
      case "hybrid": mapType = BackgroundMapType.Hybrid; break;
    }

    this._viewFlags = new ViewFlags({ renderMode: RenderMode.SmoothShade, backgroundMap: undefined !== mapType });
    if (undefined !== mapType)
      this._backgroundMap = { providerName: "BingProvider", groundBias: mapGroundBias, providerData: { mapType } };
  }

  /** Perform the import */
  public async import(): Promise<void> {
    const categoryName = this._modelName ? this._modelName : "GeoJson Category";
    const modelName = this._modelName ? this._modelName : "GeoJson Model";

    let featureModelExtents: AxisAlignedBox3d;
    if (this._appendToExisting) {
      this.physicalModelId = PhysicalModel.insert(this.iModelDb, IModelDb.rootSubjectId, modelName);
      const foundCategoryId = SpatialCategory.queryCategoryIdByName(this.iModelDb, IModel.dictionaryId, categoryName);
      this.featureCategoryId = (foundCategoryId !== undefined) ? foundCategoryId : this.addCategoryToExistingDb(categoryName);
      this.convertFeatureCollection();
      const featureModel: SpatialModel = this.iModelDb.models.getModel<SpatialModel>(this.physicalModelId);
      featureModelExtents = featureModel.queryExtents();
      const projectExtents = Range3d.createFrom(this.iModelDb.projectExtents);
      projectExtents.extendRange(featureModelExtents);
      this.iModelDb.updateProjectExtents(projectExtents);
    } else {
      this.definitionModelId = DefinitionModel.insert(this.iModelDb, IModelDb.rootSubjectId, "GeoJSON Definitions");
      this.physicalModelId = PhysicalModel.insert(this.iModelDb, IModelDb.rootSubjectId, modelName);
      this.featureCategoryId = SpatialCategory.insert(this.iModelDb, this.definitionModelId, categoryName, { color: ColorDef.white.tbgr });
      /** To geo-locate the project, we need to first scan the GeoJSon and extract range. This would not be required
       * if the bounding box was directly available.
       */
      const featureMin = Cartographic.createZero(), featureMax = Cartographic.createZero();
      if (!this.getFeatureRange(featureMin, featureMax))
        return;
      const featureCenter = Cartographic.fromRadians({ longitude: (featureMin.longitude + featureMax.longitude) / 2, latitude: (featureMin.latitude + featureMax.latitude) / 2 });

      this.iModelDb.setEcefLocation(EcefLocation.createFromCartographicOrigin(featureCenter));
      this.convertFeatureCollection();

      const featureModel: SpatialModel = this.iModelDb.models.getModel<SpatialModel>(this.physicalModelId);
      featureModelExtents = featureModel.queryExtents();
      if (!this._classifiedURL)
        this.insertSpatialView("Spatial View", featureModelExtents);
      this.iModelDb.updateProjectExtents(featureModelExtents);
    }

    if (this._classifiedURL) {
      const isPlanar = (featureModelExtents.high.z - featureModelExtents.low.z) < 1.0E-2;
      await insertClassifiedRealityModel(this._classifiedURL, this.physicalModelId, this.featureCategoryId, this.iModelDb, this._viewFlags, isPlanar, this._backgroundMap, this._classifiedName ? this._classifiedName : this._modelName, this._classifiedInside, this._classifiedOutside);
    }

    this.iModelDb.saveChanges();
  }
  private addCategoryToExistingDb(categoryName: string) {
    const categoryId = SpatialCategory.insert(this.iModelDb, IModel.dictionaryId, categoryName, { color: ColorDef.white.tbgr });
    this.iModelDb.views.iterateViews({ from: "BisCore.SpatialViewDefinition" }, ((view: ViewDefinition) => {
      const categorySelector = this.iModelDb.elements.getElement<CategorySelector>(view.categorySelectorId);
      categorySelector.categories.push(categoryId);
      this.iModelDb.elements.updateElement(categorySelector);

      return true;
    }));

    return categoryId;
  }
  /** Iterate through and accumulate the GeoJSON FeatureCollection range. */
  protected getFeatureRange(featureMin: Cartographic, featureMax: Cartographic) {
    featureMin.longitude = featureMin.latitude = Angle.pi2Radians;
    featureMax.longitude = featureMax.latitude = -Angle.pi2Radians;

    for (const feature of this._geoJson.data.features) {
      if (feature.geometry) {
        switch (feature.geometry.type) {
          case GeoJson.GeometryType.polygon:
            for (const loop of feature.geometry.coordinates)
              this.extendRangeForCoordinates(featureMin, featureMax, loop);
            break;

          case GeoJson.GeometryType.linestring:
            this.extendRangeForCoordinates(featureMin, featureMax, feature.geometry.coordinates);
            break;

          case GeoJson.GeometryType.point:
            this.extendRangeForCoordinate(featureMin, featureMax, feature.geometry.coordinates);
            break;

          case GeoJson.GeometryType.multiPolygon:
            for (const polygon of feature.geometry.coordinates)
              for (const loop of polygon)
                this.extendRangeForCoordinates(featureMin, featureMax, loop);
            break;
        }
      }
    }
    return featureMin.longitude < featureMax.longitude && featureMin.latitude < featureMax.latitude;
  }
  private extendRangeForCoordinate(featureMin: Cartographic, featureMax: Cartographic, point: GeoJson.Point) {
    const longitude = Angle.degreesToRadians(point[0]);
    const latitude = Angle.degreesToRadians(point[1]);
    featureMin.longitude = Math.min(longitude, featureMin.longitude);
    featureMin.latitude = Math.min(latitude, featureMin.latitude);
    featureMax.longitude = Math.max(longitude, featureMax.longitude);
    featureMax.latitude = Math.max(latitude, featureMax.latitude);
  }
  private extendRangeForCoordinates(featureMin: Cartographic, featureMax: Cartographic, lineString: GeoJson.LineString) {
    for (const point of lineString) {
      this.extendRangeForCoordinate(featureMin, featureMax, point);
    }
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
      if (featureJson.properties) {
        if (this._labelProperty !== undefined && featureJson.properties[this._labelProperty] !== undefined)
          featureProps.userLabel = featureJson.properties[this._labelProperty];
        else
          featureProps.userLabel = featureJson.properties.mapname;
      }
      this.iModelDb.elements.insertElement(featureProps);
    }
  }

  /** Convert GeoJSON feature geometry into an iModel GeometryStream. */
  private convertFeatureGeometry(inGeometry: GeoJson.Geometry): GeometryStreamProps | undefined {
    if (!inGeometry)
      return undefined;

    const builder = new GeometryStreamBuilder();
    if (this._colorIndex !== undefined) {
      const colorValues = [ColorByName.blue, ColorByName.red, ColorByName.green, ColorByName.yellow, ColorByName.cyan, ColorByName.magenta, ColorByName.cornSilk, ColorByName.blueViolet, ColorByName.deepSkyBlue, ColorByName.indigo, ColorByName.fuchsia];
      const geomParams = new GeometryParams(this.featureCategoryId);
      geomParams.lineColor = ColorDef.create(colorValues[this._colorIndex++ % colorValues.length]);
      builder.appendGeometryParamsChange(geomParams);
    }

    switch (inGeometry.type) {
      case GeoJson.GeometryType.point:
        const pointGeometry = this.convertPoint(inGeometry.coordinates);
        if (pointGeometry)
          builder.appendGeometry(pointGeometry);
        break;

      case GeoJson.GeometryType.linestring:
        const linestringGeometry = this.convertLinestring(inGeometry.coordinates);
        if (linestringGeometry)
          builder.appendGeometry(linestringGeometry);
        break;

      case GeoJson.GeometryType.polygon:
        const polyGeometry = this.convertPolygon(inGeometry.coordinates);
        if (polyGeometry)
          builder.appendGeometry(polyGeometry);
        break;

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

  private pointFromCoordinate(coordinates: number[]) {
    GeoJsonImporter._scratchCartographic.longitude = Angle.degreesToRadians(coordinates[0]);
    GeoJsonImporter._scratchCartographic.latitude = Angle.degreesToRadians(coordinates[1]);

    const point = this.iModelDb.cartographicToSpatialFromEcef(GeoJsonImporter._scratchCartographic);
    /** the ecef Transform (particularly if it appending) may introduce some deviation from 0 x-y plane. */
    if (this._forceZeroHeight)
      point.z = 0.0;

    return point;
  }
  private convertPoint(inPoint: GeoJson.Point): Loop {
    return Loop.create(Arc3d.createXY(this.pointFromCoordinate(inPoint), this._pointRadius));

  }

  /** Convert a GeoJSON LineString into an @itwin/core-geometry lineString */
  private convertLinestring(inLinestring: GeoJson.LineString): LineString3d | undefined {
    if (!Array.isArray(inLinestring))
      return undefined;

    const outPoints = [];
    for (const inPoint of inLinestring) {
      outPoints.push(this.pointFromCoordinate(inPoint));
    }

    return LineString3d.createPoints(outPoints);
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
  private static _scratchCartographic = Cartographic.createZero();

  /** Convert a GeoJSON LineString into an @itwin/core-geometry Loop */
  private convertLoop(inLoop: GeoJson.LineString): Loop | undefined {
    const lineString = this.convertLinestring(inLoop);
    return lineString ? Loop.create(lineString) : undefined;
  }

  /** Insert a SpatialView configured to display the GeoJSON data that was converted/imported. */
  protected insertSpatialView(viewName: string, range: AxisAlignedBox3d): Id64String {
    const modelSelectorId: Id64String = ModelSelector.insert(this.iModelDb, this.definitionModelId, viewName, [this.physicalModelId]);
    const categorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, this.definitionModelId, viewName, [this.featureCategoryId]);
    const displayStyleId: Id64String = DisplayStyle3d.insert(this.iModelDb, this.definitionModelId, viewName, { viewFlags: this._viewFlags, backgroundMap: this._backgroundMap });
    return OrthographicViewDefinition.insert(this.iModelDb, this.definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, range, StandardViewIndex.Top);
  }
}
