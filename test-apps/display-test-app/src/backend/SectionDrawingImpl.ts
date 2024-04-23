import {
  BriefcaseDb,
  CategorySelector,
  DisplayStyle3d,
  DocumentListModel,
  DrawingViewDefinition,
  ECSqlStatement,
  IpcHandler,
  ModelSelector,
  SectionDrawing,
  SpatialViewDefinition,
} from "@itwin/core-backend";
import { sectionDrawingChannel, SectionDrawingIpc } from "../common/SectionDrawingIpcInterface";
import { Range3d, Range3dProps, Transform, TransformProps } from "@itwin/core-geometry";
import { Code, CodeProps, DbResult, DisplayStyle3dProps, ElementProps, GeometricModel2dProps, IModelError, RelatedElementProps, SectionDrawingProps, SectionType, SpatialViewDefinitionProps, ViewDefinition2dProps } from "@itwin/core-common";
import { Id64, Id64String } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs, CreateSectionDrawingViewResult } from "../common/DtaIpcInterface";

export class SectionDrawingImpl extends IpcHandler implements SectionDrawingIpc {
  private _briefcaseDbKey: string = "";
  public get channelName(): string {
    return sectionDrawingChannel;
  }
  public async setup(briefcaseDbKey: string) {
    this._briefcaseDbKey = briefcaseDbKey;
    return;
  }

  /**
   * Insert a section drawing and model.
   * @param name Name of the section drawing
   * @param spatialViewDefinitionId Id of the spatial view definition shown in the section drawing.
   */
  public async insertSectionDrawing(name: string, spatialViewDefinitionId: string, transform?: TransformProps): Promise<string> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return "";

      // Get or make documentListModelId
      let documentListModelId: Id64String | undefined;
      activeDb.withPreparedStatement(
        "SELECT ECInstanceId FROM bis.DocumentPartition WHERE CodeValue = ?",
        (stmt: ECSqlStatement) => {
          stmt.bindString(1, "DrawingProductionDrawings");
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const row: any = stmt.getRow();
            documentListModelId = row.id;
          }
        },
      );

      // If not exists, make it.
      // See consternation regarding DocumentPartition element in createSheet comments
      if (documentListModelId === undefined) {
        await activeDb.locks.acquireLocks({
          shared: activeDb.elements.getRootSubject().id,
        });
        documentListModelId = DocumentListModel.insert(
          activeDb,
          activeDb.elements.getRootSubject().id,
          "DrawingProductionDrawings",
        );
      }

      const sectionDrawingProps: SectionDrawingProps = {
        classFullName: "BisCore:SectionDrawing",
        code: SectionDrawing.createCode(activeDb, documentListModelId, name),
        model: documentListModelId,
        spatialView: {
          id: spatialViewDefinitionId,
          relECClassId: "BisCore.SectionDrawingGeneratedFromSpatialView",
        } as RelatedElementProps,
        sectionType: SectionType.Detail,
        jsonProperties: {
          displaySpatialView: true,
          drawingToSpatialTransform: transform,
        },
      };

      await activeDb.locks.acquireLocks({ shared: documentListModelId });
      // The section drawing and section drawing model insert should eventually be replaced with SectionDrawing.insert() - a bug was just fixed with this function and I'm not sure when it was/will be released
      const sectionDrawingId = activeDb.elements.insertElement(sectionDrawingProps);
      activeDb.saveChanges();

      const sectionDrawingModelProps: GeometricModel2dProps = {
        classFullName: "BisCore:SectionDrawingModel",
        modeledElement: { id: sectionDrawingId, relECClassId: "BisCore.ModelModelsElement" } as RelatedElementProps,
        // Make sure the model has the same ID as the section drawing element
        id: sectionDrawingId,
      };
      activeDb.models.insertModel(sectionDrawingModelProps);
      activeDb.saveChanges();
      return sectionDrawingId ? sectionDrawingId : "Failed to create section drawing";
    } catch (error) {
      // TODO: Return user readable error messages
      return (error as IModelError).message;
    }
  }

  public async updateSectionDrawingTransform(sectionDrawingId: string, drawingToSpatial: TransformProps): Promise<boolean> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return false;

      const sectionDrawing = activeDb.elements.getElement<SectionDrawing>(sectionDrawingId);

      if (sectionDrawing) {
        const sectionDrawingProps = sectionDrawing.toJSON();
        const originalJsonProperties = sectionDrawing.jsonProperties;
        sectionDrawingProps.jsonProperties = {...originalJsonProperties, drawingToSpatialTransform: drawingToSpatial};
        activeDb.elements.updateElement(sectionDrawingProps);
        return true;
      }
      return false;
    } catch (error) {
      // TODO: Return user readable error messages
      return false;
    }
  }

  public async updateSpatialViewDefinition(sectionDrawingId: string, drawingToSpatial: TransformProps): Promise<boolean> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return false;

      const sectionDrawing = activeDb.elements.getElement<SectionDrawing>(sectionDrawingId);

      if (sectionDrawing) {
        const sectionDrawingProps = sectionDrawing.toJSON();
        const originalJsonProperties = sectionDrawing.jsonProperties;
        sectionDrawingProps.jsonProperties = {...originalJsonProperties, drawingToSpatialTransform: drawingToSpatial};
        activeDb.elements.updateElement(sectionDrawingProps);
        return true;
      }
      return false;
    } catch (error) {
      // TODO: Return user readable error messages
      return false;
    }
  }

  /**
     * Insert a drawing view definition viewing a section drawing.
     * @param drawingViewDefinition2dProps Props for creating a drawing view definition
     * @param name Name of the section drawing AND drawing view state
     */
  public async insertSectionDrawingViewState(
    drawingViewDefinition2dProps: ViewDefinition2dProps,
    name: string,
  ): Promise<string> {
    const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
    if (!activeDb)
      return "";
    // Get or make documentListModelId
    let documentListModelId: Id64String | undefined;
    activeDb.withPreparedStatement(
      "SELECT ECInstanceId FROM bis.DocumentPartition WHERE CodeValue = ?",
      (stmt: ECSqlStatement) => {
        stmt.bindString(1, "DrawingProductionDrawings");
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const row: any = stmt.getRow();
          documentListModelId = row.id;
        }
      },
    );

    // If not exists, make it.
    // See consternation regarding DocumentPartition element in createSheet comments
    if (documentListModelId === undefined) {
      await activeDb.locks.acquireLocks({
        shared: activeDb.elements.getRootSubject().id,
      });
      documentListModelId = DocumentListModel.insert(
        activeDb,
        activeDb.elements.getRootSubject().id,
        "DrawingProductionDrawings",
      );
    }

    await activeDb.locks.acquireLocks({ shared: BriefcaseDb.dictionaryId });
    const drawingViewDefinition = DrawingViewDefinition.fromJSON(drawingViewDefinition2dProps, activeDb);
    drawingViewDefinition.code = DrawingViewDefinition.createCode(activeDb, BriefcaseDb.dictionaryId, name);
    const drawingViewDefinitionId = drawingViewDefinition.insert();
    activeDb.saveChanges();

    return drawingViewDefinitionId;
  }

  /**
     * The section drawing view needs to account for both the extents of the underlying SectionDrawingModel and the extents of the referenced SpatialView.
     * @param spatialViewDefinitionId
     * @param sectionDrawingModelId
     * @returns The union of the SectionDrawingModel extents and the SpatialView extents as Range3dProps
     */
  public async calculateDrawingViewExtents(spatialViewDefinitionId: string, sectionDrawingModelId: string, drawingToSpatial: TransformProps | undefined): Promise<Range3dProps> {
    const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
    if (!activeDb)
      return Range3d.createNull();

    // Get spatial view
    const spatialView = activeDb.elements.getElement<SpatialViewDefinition>(spatialViewDefinitionId, SpatialViewDefinition);
    const spatialToDrawing = Transform.fromJSON(drawingToSpatial).inverse();
    const spatialOriginInDrawingSpace = spatialToDrawing?.multiplyPoint3d(spatialView.origin);
    const spatialRangeInDrawingSpace = spatialToDrawing?.multiplyVector(spatialView.extents);
    if (!spatialOriginInDrawingSpace || ! spatialRangeInDrawingSpace) {
      return Range3d.createNull();
    }
    const viewRange = Range3d.createXYZXYZ(
      spatialOriginInDrawingSpace.x,
      spatialOriginInDrawingSpace.y,
      spatialOriginInDrawingSpace.z,
      spatialOriginInDrawingSpace.x + spatialRangeInDrawingSpace.x,
      spatialOriginInDrawingSpace.y + spatialRangeInDrawingSpace.y,
      spatialOriginInDrawingSpace.z + spatialRangeInDrawingSpace.z,
    );

    const modelRange = await activeDb.models.queryRange(sectionDrawingModelId);

    const unionOfRanges = modelRange.union(viewRange);

    return unionOfRanges.toJSON();
  }

  public async spatialViewDefinitionCode(name: string): Promise<CodeProps> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return Code.createEmpty().toJSON();

      return SpatialViewDefinition.createCode(activeDb, BriefcaseDb.dictionaryId, name).toJSON();
    } catch (error) {
      // TODO: Return user readable error messages
      return Code.createEmpty().toJSON();
    }
  }

  /**
   * Insert any BIS element based on the props
   * @param props The props used to insert the BIS element. Determines which element class gets created
   * @param locks The ids of elements/models that need to be locked when creating the element
   * @returns The id of the created element
   */
  public async insertElement(props: ElementProps, locks: string[]): Promise<string> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return "";

      // acquire locks
      await activeDb.locks.acquireLocks({ shared: locks });

      // create element
      const element = activeDb.elements.insertElement(props);

      // save changes
      activeDb.saveChanges();
      return element ? element : "Failed to create element";
    } catch (error) {
      // TODO: Return user readable error messages
      return (error as IModelError).message;
    }
  }
}

async function getDrawingProductionListModel(db: BriefcaseDb): Promise<Id64String> {
  const documentListName = "DrawingProductionDrawings";
  let documentListModelId: Id64String | undefined;
  db.withPreparedStatement(
    "SELECT ECInstanceId FROM bis.DocumentPartition WHERE CodeValue = ?",
    (stmt) => {
      stmt.bindString(1, documentListName);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        documentListModelId = stmt.getRow().id;
      }
    },
  );

  if (undefined === documentListModelId) {
    const rootSubjectId = db.elements.getRootSubject().id;
    await db.locks.acquireLocks({ shared: [rootSubjectId] });
    documentListModelId = DocumentListModel.insert(db, rootSubjectId, documentListName);
  } else {
    await db.locks.acquireLocks({ shared: [documentListModelId] });
  }

  if (!Id64.isValidId64(documentListModelId)) {
    throw new Error("Failed to obtain document list model");
  }

  return documentListModelId;
}

async function insertSectionDrawing(db: BriefcaseDb, spatialViewId: Id64String, baseName: string, drawingToSpatialTransform: TransformProps): Promise<Id64String> {
  const documentListModelId = await getDrawingProductionListModel(db);
  const sectionDrawingProps: SectionDrawingProps = {
    classFullName: "BisCore:SectionDrawing",
    code: SectionDrawing.createCode(db, documentListModelId, baseName),
    model: documentListModelId,
    spatialView: {
      id: spatialViewId,
      relECClassId: "BisCore.SectionDrawingGeneratedFromSpatialView",
    } as RelatedElementProps,
    sectionType: SectionType.Detail,
    jsonProperties: {
      displaySpatialView: true,
      drawingToSpatialTransform,
    },
  };

  const sectionDrawingId = db.elements.insertElement(sectionDrawingProps);
  if (!Id64.isValidId64(sectionDrawingId)) {
    throw new Error("Failed to create SectionDrawing element");
  }

  const sectionDrawingModelProps: GeometricModel2dProps = {
    classFullName: "BisCore:SectionDrawingModel",
    modeledElement: { id: sectionDrawingId, relECClassId: "BisCore.ModelModelsElement" } as RelatedElementProps,
    // Make sure the model has the same ID as the section drawing element
    id: sectionDrawingId,
  };

  if (db.models.insertModel(sectionDrawingModelProps) !== sectionDrawingId) {
    throw new Error("Failed to create SectionDrawingModel");
  }

  return sectionDrawingId;
}

function insertSpatialView(db: BriefcaseDb, args: Pick<CreateSectionDrawingViewArgs, "baseName" | "spatialView" | "models" | "categories" | "displayStyle">): Id64String {
  const dictionary = BriefcaseDb.dictionaryId;
  const modelSelectorId = ModelSelector.insert(db, dictionary, args.baseName, args.models);
  const categorySelectorId = CategorySelector.insert(db, dictionary, args.baseName, args.categories);

  const styleProps: DisplayStyle3dProps = {
    ...args.displayStyle,
    classFullName: DisplayStyle3d.classFullName,
    id: Id64.invalid,
    code: DisplayStyle3d.createCode(db, dictionary, args.baseName).toJSON(),
    model: dictionary,
    federationGuid: "",
  };

  const displayStyleId = db.elements.insertElement(styleProps);

  const viewProps: SpatialViewDefinitionProps = {
    ...args.spatialView,
    id: Id64.invalid,
    code: SpatialViewDefinition.createCode(db, dictionary, `${args.baseName}:Spatial`),
    model: dictionary,
    displayStyleId,
    modelSelectorId,
    categorySelectorId,
    federationGuid: "",
  };

  return db.elements.insertElement(viewProps);
}

export async function createSectionDrawing(args: CreateSectionDrawingViewArgs): Promise<CreateSectionDrawingViewResult> {
  const db = BriefcaseDb.findByKey(args.iModelKey);

  try {
    await db.locks.acquireLocks({ shared: [ BriefcaseDb.dictionaryId ] });

    const spatialViewId = insertSpatialView(db, args);
    const sectionDrawingId = await insertSectionDrawing(db, spatialViewId, args.baseName, args.drawingToSpatialTransform);

    db.saveChanges(`Created section drawing '${args.baseName}'`);
    return { spatialViewId, sectionDrawingId };
  } catch (e) {
    db.abandonChanges();
    throw e;
  }
}
