import {
  BriefcaseDb,
  CategorySelector,
  DisplayStyle3d,
  DocumentListModel,
  ModelSelector,
  SectionDrawing,
  SpatialViewDefinition,
} from "@itwin/core-backend";
import { TransformProps } from "@itwin/core-geometry";
import { DbResult, DisplayStyle3dProps, GeometricModel2dProps, RelatedElementProps, SectionDrawingProps, SectionType, SpatialViewDefinitionProps } from "@itwin/core-common";
import { Id64, Id64String } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs, CreateSectionDrawingViewResult } from "../common/DtaIpcInterface";

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
