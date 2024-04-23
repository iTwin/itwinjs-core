/* eslint-disable no-console */
import { IModelApp, ScreenViewport, SpatialViewState, Tool } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";
import { createButton, createTextBox } from "@itwin/frontend-devtools";
import { SectionDrawingIpcInvoker } from "./SectionDrawingIpcInvoker";
import { SectionDrawingApi } from "./SectionDrawingApi";

export class ViewDrawingPanel extends ToolBarDropDown {
  private readonly _element: HTMLElement;
  private _name: string;

  public constructor(vp: ScreenViewport, parent: HTMLElement) {
    super();
    this._element = IModelApp.makeHTMLElement("div", { className: "toolMenu", parent });
    this._element.style.cssFloat = "left";
    this._element.style.display = "block";
    this._name = "section-drawing";

    createTextBox({
      id: "txt_sectionDrawing",
      label: "Section drawing name:",
      parent: this._element,
      tooltip: "Name of new section drawing to create",
      keypresshandler: async (_tb, ev): Promise<void> => {
        ev.stopPropagation();
        this._name = (ev.target as HTMLInputElement).value;
      },
    });

    createButton({
      value: "Create drawing",
      handler: async () => void IModelApp.tools.run(SectionDrawingTool.toolId, this._name, vp.view),
      parent: this._element,
      inline: true,
    });
  }

  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get isOpen(): boolean { return "block" === this._element.style.display; }
}

export class SectionDrawingTool extends Tool {
  public static override toolId = "SectionDrawingTool";

  /**
   *
   * @param args arg0 is section drawing name. arg1 is spatial view to attach. arg2 is a flip denoting transform method 1 or 2
   * @returns
   */
  public override async run(...args: any[]): Promise<boolean> {
    if (args.length !== 2 || typeof args[0] !== "string" || !(args[1] instanceof SpatialViewState))
      return false;
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (!iModelConnection) {
      return false;
    }
    if (!iModelConnection.isBriefcaseConnection()) {
      return false;
    }

    // TODO: Validate the spatial view state (camera off, skybox off, etc).

    await SectionDrawingIpcInvoker.getOrCreate().setup(iModelConnection.key);
    const spatialViewDefinitionId = await SectionDrawingApi.insertSpatialView(args[0], args[1]);
    await SectionDrawingApi.createAndViewSectionDrawing(iModelConnection, args[0], spatialViewDefinitionId, true);
    return true;
  }
}
