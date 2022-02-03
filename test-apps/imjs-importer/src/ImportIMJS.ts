/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import type { Id64String } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import { GeometryQuery, IModelJson, Point3d, Range3d, StandardViewIndex, Transform } from "@itwin/core-geometry";
import type { SpatialModel} from "@itwin/core-backend";
import {
  CategorySelector, DefinitionModel, DisplayStyle3d, IModelDb, ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalObject, SnapshotDb,
  SpatialCategory,
} from "@itwin/core-backend";
import type { AxisAlignedBox3d, PhysicalElementProps} from "@itwin/core-common";
import { Code, ColorDef, RenderMode, ViewFlags } from "@itwin/core-common";
/* eslint-disable no-console */
function collectRange(g: any, rangeToExtend: Range3d) {
  if (g instanceof GeometryQuery) {
    g.extendRange(rangeToExtend);
  } else if (Array.isArray(g)) {
    for (const g1 of g) {
      collectRange(g1, rangeToExtend);
    }
  }
}
function transformInPlace(transform: Transform, g: any, rangeToExtend: Range3d) {
  if (g instanceof GeometryQuery) {
    g.tryTransformInPlace(transform);
    g.extendRange(rangeToExtend);
  } else if (Array.isArray(g)) {
    for (const g1 of g) {
      transformInPlace(transform, g1, rangeToExtend);
    }
  }
}
export class ImportDirectoryStatus {
  public numFile: number = 0;
  public numWithGeometry: number = 0;
  public numHugeGeometry: number = 0;
}
export class ModelIdGroup {
  public maxSize: number;
  public modelNames: string[];
  public range: Range3d;
  public groupName: string;
  public constructor(groupName: string, maxSize: number) {
    this.groupName = groupName;
    this.maxSize = maxSize;
    this.modelNames = [];
    this.range = Range3d.createNull();
  }
  /**
   * place a new model in the first acceptable model group in an array
   * @param modelGroups
   * @param name
   * @param selectionSize size to use for array search. (possibly different from range)
   * @param range actual range as saved
   *
   * @return true if the range fit in some group.
   */
  public static announceModel(modelGroups: ModelIdGroup[], name: string, selectionSize: number, range: Range3d): boolean {
    for (const group of modelGroups) {
      if (selectionSize < group.maxSize) {
        group.modelNames.push(name);
        group.range.extendRange(range);
        return true;
      }
    }
    return false;
  }
}
export class ImportIMJS {

  public iModelDb: IModelDb;
  public definitionModelId: Id64String = Id64.invalid;
  public featureCategoryId: Id64String = Id64.invalid;
  private readonly _viewFlags: ViewFlags;

  public constructor(db: IModelDb) {
    this.iModelDb = db;
    this._viewFlags = new ViewFlags({ renderMode: RenderMode.SmoothShade, lighting: true });
  }
  public static create(databasePath: string, rootSubject: string): ImportIMJS | undefined {
    fs.unlink(databasePath, (_err) => { });
    const db = SnapshotDb.createEmpty(databasePath, { rootSubject: { name: rootSubject } });
    if (db)
      return new ImportIMJS(db);
    return undefined;
  }
  private _aroundTheWorld = 40.0e6;
  private _usualUorPerMeter = 10000.0;
  public importFilesFromDirectory(directoryPath: string): ModelIdGroup[] {
    const stats = new ImportDirectoryStatus();
    this.definitionModelId = DefinitionModel.insert(this.iModelDb, IModelDb.rootSubjectId, "definition");
    this.featureCategoryId = SpatialCategory.insert(this.iModelDb, this.definitionModelId, "testCategory", {});
    const modelGroups = [];

    const fileList = fs.readdirSync(directoryPath);
    if (fileList) {
      modelGroups.push(new ModelIdGroup("group100", 100));
      modelGroups.push(new ModelIdGroup("group1000", 1.0e3));
      modelGroups.push(new ModelIdGroup("groupMega", 1.0e6));
      modelGroups.push(new ModelIdGroup("groupGiga", 1.0e9));
      const globalRange = Range3d.createNull();
      for (const fileName of fileList) {
        const fullPath = directoryPath + fileName;
        console.log("File: ", fullPath);
        const fileString = fs.readFileSync(fullPath, "utf8");
        stats.numFile++;
        const json = JSON.parse(fileString);
        const g = IModelJson.Reader.parse(json);
        // numTotal++;
        if (Array.isArray(g) && g.length === 0) {
          // skip this one?
        } else if (g) {
          // numGeometry++;
          const range = Range3d.createNull();
          // skip files with large footprint
          collectRange(g, range);
          const baseSize = range.maxAbs();
          if (baseSize < this._aroundTheWorld)
            globalRange.extendRange(range);
          else if (baseSize < this._usualUorPerMeter * this._aroundTheWorld) {
            const transform = Transform.createScaleAboutPoint(Point3d.create(0, 0, 0), 1.0 / this._usualUorPerMeter);
            range.setNull();
            transformInPlace(transform, g, range);
          }
          if (range.maxAbs() < this._aroundTheWorld) {
            stats.numWithGeometry++;
            const physicalModelId = PhysicalModel.insert(this.iModelDb, IModelDb.rootSubjectId, `model${fileName}`);
            const featureProps: PhysicalElementProps = {
              classFullName: PhysicalObject.classFullName,
              model: physicalModelId,
              code: Code.createEmpty(),
              category: this.featureCategoryId,
            };
            const g1 = IModelJson.Writer.toIModelJson(g);
            featureProps.geom = Array.isArray(g1) ? g1 : [g1];
            // console.log(g1);
            this.iModelDb.elements.insertElement(featureProps);
            const featureModel: SpatialModel = this.iModelDb.models.getModel(physicalModelId);
            const featureModelExtents = featureModel.queryExtents();
            this.insertSpatialViewOneModel(`Spatial View${fileName}`, range, physicalModelId);
            this.iModelDb.updateProjectExtents(featureModelExtents);

            ModelIdGroup.announceModel(modelGroups, physicalModelId, baseSize, range);
          } else {
            stats.numHugeGeometry++;
          }
        }
      }
      for (const group of modelGroups) {
        if (group.modelNames.length > 0)
          this.insertSpatialView(group.groupName, group.range, group.modelNames);

      }
      this.iModelDb.updateProjectExtents(globalRange);
    }

    this.iModelDb.saveChanges();
    return modelGroups;
  }

  protected insertSpatialView(viewName: string, range: AxisAlignedBox3d, models: string[]): Id64String {
    const modelSelectorId: Id64String = ModelSelector.insert(this.iModelDb, this.definitionModelId, viewName, models);
    const categorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, this.definitionModelId, viewName, [this.featureCategoryId]);
    const displayStyleId: Id64String = DisplayStyle3d.insert(this.iModelDb, this.definitionModelId, viewName, { viewFlags: this._viewFlags, backgroundColor: ColorDef.blue });
    return OrthographicViewDefinition.insert(this.iModelDb, this.definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, range, StandardViewIndex.Top);
  }
  protected insertSpatialViewOneModel(viewName: string, range: AxisAlignedBox3d, physicalModelId: string): Id64String {
    const modelSelectorId: Id64String = ModelSelector.insert(this.iModelDb, this.definitionModelId, viewName, [physicalModelId]);
    const categorySelectorId: Id64String = CategorySelector.insert(this.iModelDb, this.definitionModelId, viewName, [this.featureCategoryId]);
    const displayStyleId: Id64String = DisplayStyle3d.insert(this.iModelDb, this.definitionModelId, viewName, { viewFlags: this._viewFlags, backgroundColor: ColorDef.blue });
    return OrthographicViewDefinition.insert(this.iModelDb, this.definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, range, StandardViewIndex.Top);
  }
}
