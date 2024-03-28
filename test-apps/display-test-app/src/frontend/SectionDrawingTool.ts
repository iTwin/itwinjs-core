/* eslint-disable no-console */
import { IModelApp, ScreenViewport, Tool } from "@itwin/core-frontend";
import { SectionDrawingIpcInvoker } from "./SectionDrawingIpcInvoker";
import { SectionDrawingApi } from "./SectionDrawingApi";
import { ToolBarDropDown } from "./ToolBar";
import {createTextBox } from "@itwin/frontend-devtools";

export class SectionDrawingPanel extends ToolBarDropDown {
  private readonly _vp: ScreenViewport;
  private readonly _element: HTMLElement;
  private _toolName = SectionDrawingTool.toolId;

  public constructor(vp: ScreenViewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._element = IModelApp.makeHTMLElement("div", { className: "toolMenu", parent });
    this._element.style.cssFloat = "left";
    this._element.style.display = "block";

    createTextBox({
      id: "txt_sectionDrawing",
      label: "Section drawing name:",
      parent: this._element,
      tooltip: "Name of new section drawing to create",
      keypresshandler: async (_tb, ev): Promise<void> => {
        ev.stopPropagation();
        if ("Enter" === ev.key) {
          await IModelApp.tools.run(this._toolName, (ev.target as HTMLInputElement).value);
        }
      },
    });
  }

  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get isOpen(): boolean { return "block" === this._element.style.display; }
}

export class SectionDrawingTool extends Tool {
  public static override toolId = "SectionDrawingTool";

  public override async run(...args: any[]): Promise<boolean> {
    if (args.length !== 1 || typeof args[0] !== "string")
      return false;
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (!iModelConnection) {
      return false;
    }
    if (!iModelConnection.isBriefcaseConnection()) {
      return false;
    }

    const name = args[0];

    await SectionDrawingIpcInvoker.getOrCreate().setup(iModelConnection.key);
    const spatialViewDefinitionId = await SectionDrawingApi.insertTestSpatialView(name);
    await SectionDrawingApi.createAndViewSectionDrawing(name, spatialViewDefinitionId);

    return true;
  }
}
