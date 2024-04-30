import { BriefcaseDb, CategorySelector, DisplayStyle2d, Drawing, DrawingViewDefinition } from "@itwin/core-backend";
import { CreateDrawingArgs, CreateDrawingViewArgs } from "../common/DtaIpcInterface";
import { Id64, Id64String } from "@itwin/core-bentley";
import { getDrawingProductionListModel } from "./SectionDrawingImpl";
import { DisplayStyleProps, ViewDefinition2dProps } from "@itwin/core-common";
import { Range2d } from "@itwin/core-geometry";

/** Insert a new drawing and drawing model. */
async function insertDrawing(db: BriefcaseDb, baseName: string): Promise<Id64String> {
  const documentListModelId = await getDrawingProductionListModel(db);
  const drawingId = Drawing.insert(db, documentListModelId, baseName);

  if (!Id64.isValidId64(drawingId)) {
    throw new Error("Failed to create Drawing element/model");
  }

  return drawingId;
}

/** Insert a DrawingViewDefinition */
export async function insertDrawingView(args: CreateDrawingViewArgs): Promise<any> {
  const db = BriefcaseDb.findByKey(args.iModelKey);
  const dictionary = BriefcaseDb.dictionaryId;
  const categorySelectorId = CategorySelector.insert(db, dictionary, args.baseName, args.categories);

  const styleProps: DisplayStyleProps = {
    ...args.displayStyle,
    classFullName: DisplayStyle2d.classFullName,
    id: Id64.invalid,
    code: DisplayStyle2d.createCode(db, dictionary, args.baseName).toJSON(),
    model: dictionary,
    federationGuid: "",
  };

  const displayStyleId = db.elements.insertElement(styleProps);

  const arbitraryDefaultRange = Range2d.createXYXY(0, 0, 200, 200);

  const viewProps: ViewDefinition2dProps = {
    id: Id64.invalid,
    code: DrawingViewDefinition.createCode(db, dictionary, args.baseName),
    model: dictionary,
    displayStyleId,
    categorySelectorId,
    federationGuid: "",
    baseModelId: args.drawingView.baseModelId,
    classFullName: "BisCore:DrawingViewDefinition",
    origin: { x: arbitraryDefaultRange.low.x, y: arbitraryDefaultRange.low.y },
    delta: { x: arbitraryDefaultRange.xLength(), y: arbitraryDefaultRange.yLength() },
    angle: { radians: 0 },
  };

  return db.elements.insertElement(viewProps);
}

/** Insert a drawing element/model */
export async function createDrawing(args: CreateDrawingArgs): Promise<string> {
  const db = BriefcaseDb.findByKey(args.iModelKey);

  try {
    await db.locks.acquireLocks({ shared: [ BriefcaseDb.dictionaryId ] });

    const drawingId = await insertDrawing(db, args.baseName);

    db.saveChanges(`Created drawing '${args.baseName}'`);
    return drawingId;
  } catch (e) {
    db.abandonChanges();
    throw e;
  }
}
