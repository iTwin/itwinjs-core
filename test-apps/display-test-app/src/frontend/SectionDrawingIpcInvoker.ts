import { IpcApp } from "@itwin/core-frontend";
import { sectionDrawingChannel, SectionDrawingIpc } from "../common/SectionDrawingIpcInterface";
import { Range3dProps } from "@itwin/core-geometry";
import { ElementProps, SpatialViewDefinitionProps, ViewDefinition2dProps } from "@itwin/core-common";

export class SectionDrawingIpcInvoker implements SectionDrawingIpc {
  private static _instance: SectionDrawingIpcInvoker | undefined;
  private _ipc = IpcApp.makeIpcProxy<SectionDrawingIpcInvoker>(
    sectionDrawingChannel,
  );

  public static getOrCreate(): SectionDrawingIpcInvoker {
    if (!this._instance)
      this._instance = new SectionDrawingIpcInvoker();
    return this._instance;
  }

  public async setup(briefcaseDbKey: string): Promise<void> {
    await this._ipc.setup(briefcaseDbKey);
    return;
  }

  /**
   * Insert a section drawing and model.
   * @param name Name of the section drawing
   * @param spatialViewDefinitionId Id of the spatial view definition shown in the section drawing.
   */
  public async insertSectionDrawing(name: string, spatialViewDefinitionId: string): Promise<string> {
    return this._ipc.insertSectionDrawing(name, spatialViewDefinitionId);
  }

  /**
   * Insert a drawing view definition viewing a section drawing.
   * @param drawingViewDefinition2dProps Props for creating a drawing view definition
   * @param name Name of the section drawing AND drawing view state
   */
  public async insertSectionDrawingViewState(drawingViewDefinition2dProps: ViewDefinition2dProps, name: string): Promise<string> {
    return this._ipc.insertSectionDrawingViewState(drawingViewDefinition2dProps, name);
  }

  /**
   * The section drawing view needs to account for both the extents of the underlying SectionDrawingModel and the extents of the referenced SpatialView.
   * @param spatialViewDefinitionId
   * @param sectionDrawingModelId
   * @returns The union of the SectionDrawingModel extents and the SpatialView extents as Range3dProps
   */
  public async calculateDrawingViewExtents(spatialViewDefinitionId: string, sectionDrawingModelId: string): Promise<Range3dProps> {
    return this._ipc.calculateDrawingViewExtents(spatialViewDefinitionId, sectionDrawingModelId);
  }

  /**
   * Insert any BIS element based on the props
   * @param props The props used to insert the BIS element. Determines which element class gets created
   * @param locks The ids of elements/models that need to be locked when creating the element
   * @returns The id of the created element
   */
  public async insertElement(props: ElementProps, locks: string[]): Promise<string> {
    return this._ipc.insertElement(props, locks);
  }

  public async insertSpatialView(props: SpatialViewDefinitionProps, name: string): Promise<string> {
    return this._ipc.insertSpatialView(props, name);
  }
}
