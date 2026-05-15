import {
  BriefcaseDb,
  CategorySelector,
  DisplayStyle3d,
  DocumentListModel,
  EditTxn,
  ModelSelector,
  SectionDrawing,
  SpatialViewDefinition,
  withEditTxn,
} from "@itwin/core-backend";
import { TransformProps } from "@itwin/core-geometry";
import { DisplayStyle3dProps, GeometricModel2dProps, RelatedElementProps, SectionDrawingProps, SectionType, SpatialViewDefinitionProps } from "@itwin/core-common";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs, CreateSectionDrawingViewResult } from "../common/DtaIpcInterface";

/** Find or create a document partition named" DrawingProductionDrawing" to contain all our section drawings. */
async function getDrawingProductionListModel(db: BriefcaseDb, txn: EditTxn): Promise<Id64String> {
  const documentListName = "DrawingProductionDrawings";
  let documentListModelId: Id64String | undefined;

  // Find it if it already exists.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
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
    // Doesn't exist yet - create it.
    const rootSubjectId = db.elements.getRootSubject().id;
    await db.locks.acquireLocks({ shared: [rootSubjectId] });
    documentListModelId = DocumentListModel.insert(txn, rootSubjectId, documentListName);
  } else {
    await db.locks.acquireLocks({ shared: [documentListModelId] });
  }

  if (!Id64.isValidId64(documentListModelId)) {
    throw new Error("Failed to obtain document list model");
  }

  return documentListModelId;
}

/** Insert a new SectionDrawing and drawing model. */
async function insertSectionDrawing(txn: EditTxn, db: BriefcaseDb, spatialViewId: Id64String, baseName: string, drawingToSpatialTransform: TransformProps): Promise<Id64String> {
  const documentListModelId = await getDrawingProductionListModel(db, txn);
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

  const sectionDrawingId = txn.insertElement(sectionDrawingProps);
  if (!Id64.isValidId64(sectionDrawingId)) {
    throw new Error("Failed to create SectionDrawing element");
  }

  const sectionDrawingModelProps: GeometricModel2dProps = {
    classFullName: "BisCore:SectionDrawingModel",
    modeledElement: { id: sectionDrawingId, relECClassId: "BisCore.ModelModelsElement" } as RelatedElementProps,
    // Make sure the model has the same ID as the section drawing element
    id: sectionDrawingId,
  };

  if (txn.insertModel(sectionDrawingModelProps) !== sectionDrawingId) {
    throw new Error("Failed to create SectionDrawingModel");
  }

  return sectionDrawingId;
}

/** Insert the spatial view and its related model+category selectors and display style. */
function insertSpatialView(txn: EditTxn, db: BriefcaseDb, args: Pick<CreateSectionDrawingViewArgs, "baseName" | "spatialView" | "models" | "categories" | "displayStyle">): Id64String {
  const dictionary = BriefcaseDb.dictionaryId;
  const modelSelectorId = ModelSelector.insert(txn, dictionary, args.baseName, args.models);
  const categorySelectorId = CategorySelector.insert(txn, dictionary, args.baseName, args.categories);

  const styleProps: DisplayStyle3dProps = {
    ...args.displayStyle,
    classFullName: DisplayStyle3d.classFullName,
    id: Id64.invalid,
    code: DisplayStyle3d.createCode(db, dictionary, args.baseName).toJSON(),
    model: dictionary,
    federationGuid: "",
  };

  const displayStyleId = txn.insertElement(styleProps);

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

  return txn.insertElement(viewProps);
}

export async function createSectionDrawing(args: CreateSectionDrawingViewArgs): Promise<CreateSectionDrawingViewResult> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  // Our definition elements will all be inserted into the briefcase's dictionary model, so we must obtain a shared lock on it.
  await db.locks.acquireLocks({ shared: [BriefcaseDb.dictionaryId] });

  return withEditTxn(db, `Created section drawing '${args.baseName}'`, async (txn) => {
    const spatialViewId = insertSpatialView(txn, db, args);
    const sectionDrawingId = await insertSectionDrawing(txn, db, spatialViewId, args.baseName, args.drawingToSpatialTransform);
    return { spatialViewId, sectionDrawingId };
  });
}
