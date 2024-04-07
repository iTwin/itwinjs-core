import {
  BriefcaseDb,
  DocumentListModel,
  DrawingViewDefinition,
  ECSqlStatement,
  IpcHandler,
  SectionDrawing,
  SpatialViewDefinition,
} from "@itwin/core-backend";
import { sectionDrawingChannel, SectionDrawingIpc } from "../common/SectionDrawingIpcInterface";
import { DbResult, ElementProps, GeometricModel2dProps, IModelError, RelatedElementProps, SectionDrawingProps, SectionType, SpatialViewDefinitionProps, ViewDefinition2dProps } from "@itwin/core-common";
import { Range3d, Range3dProps } from "@itwin/core-geometry";

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
  public async insertSectionDrawing(name: string, spatialViewDefinitionId: string): Promise<string> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return "";

      // Get or make documentListModelId
      let documentListModelId;
      activeDb.withPreparedStatement(
        "SELECT ECInstanceId FROM bis.DocumentPartition WHERE CodeValue = ?",
        (stmt: ECSqlStatement) => {
          stmt.bindString(1, "SectionDrawingDemo");
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const row: any = stmt.getRow();
            documentListModelId = row.id;
          }
        },
      );

      // If not exists, make it.
      if (documentListModelId === undefined) {

        await activeDb.locks.acquireLocks({
          shared: activeDb.elements.getRootSubject().id,
        });
        documentListModelId = DocumentListModel.insert(
          activeDb,
          activeDb.elements.getRootSubject().id,
          "SectionDrawingDemo",
        );
      }

      const sectionDrawingProps: SectionDrawingProps = {
        classFullName: "BisCore:SectionDrawing",
        code: SectionDrawing.createCode(activeDb, documentListModelId, name),
        model: documentListModelId,
        spatialView: {id: spatialViewDefinitionId, relECClassId:"BisCore.SectionDrawingGeneratedFromSpatialView"} as RelatedElementProps,
        sectionType: SectionType.Detail,
        jsonProperties: {
          displaySpatialView: true,
          drawingToSpatialTransform: undefined,
        },
      };

      await activeDb.locks.acquireLocks({ shared: documentListModelId });
      // The section drawing and section drawing model insert should eventually be replaced with SectionDrawing.insert() - a bug was just fixed with this function
      const sectionDrawingId = activeDb.elements.insertElement(sectionDrawingProps);
      activeDb.saveChanges();

      const sectionDrawingModelProps: GeometricModel2dProps = {
        classFullName: "BisCore:SectionDrawingModel",
        modeledElement: {id: sectionDrawingId, relECClassId:"BisCore.ModelModelsElement"} as RelatedElementProps,
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

  /**
     * Insert a drawing view definition viewing a section drawing.
     * @param drawingViewDefinition2dProps Props for creating a drawing view definition
     * @param name Name of the section drawing AND drawing view state
     */
  public async insertSectionDrawingViewState(drawingViewDefinition2dProps: ViewDefinition2dProps, name: string): Promise<string> {
    const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
    if (!activeDb)
      return "";

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
  public async calculateDrawingViewExtents(spatialViewDefinitionId: string, sectionDrawingModelId: string): Promise<Range3dProps> {
    const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
    if (!activeDb)
      return Range3d.createNull();

    // Get spatial view
    const spatialView = activeDb.elements.getElement<SpatialViewDefinition>(spatialViewDefinitionId, SpatialViewDefinition);
    const viewRange = Range3d.createXYZXYZ(0, 0, 0, spatialView.extents.x, spatialView.extents.y, spatialView.extents.z);

    const modelRange = await activeDb.models.queryRange(sectionDrawingModelId);

    const unionOfRanges = modelRange.union(viewRange);

    return unionOfRanges.toJSON();
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

  public async insertSpatialView(props: SpatialViewDefinitionProps, name: string): Promise<string> {
    try {
      const activeDb: BriefcaseDb | undefined = BriefcaseDb.tryFindByKey(this._briefcaseDbKey);
      // Should be an error
      if (!activeDb)
        return "";

      // create element
      props.code = SpatialViewDefinition.createCode(activeDb, BriefcaseDb.dictionaryId, name).toJSON();
      const spatialViewDef = SpatialViewDefinition.fromJSON(props, activeDb);
      const element = spatialViewDef.insert();
      const savedSpatialViewDef = activeDb.elements.getElement(element, SpatialViewDefinition);
      const spatialViewProps = activeDb.elements.getElementProps(element);
      // eslint-disable-next-line no-console
      console.log({savedSpatialViewDef, spatialViewProps});

      // save changes
      activeDb.saveChanges();
      return element ? element : "Failed to create element";
    } catch (error) {
      // TODO: Return user readable error messages
      return (error as IModelError).message;
    }
  }
}

