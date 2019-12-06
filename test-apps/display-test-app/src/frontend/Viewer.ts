/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { Point2d } from "@bentley/geometry-core";
import {
  imageBufferToPngDataUrl,
  IModelApp,
  IModelConnection,
  NotifyMessageDetails,
  openImageDataUrlInNewWindow,
  OutputMessagePriority,
  ScreenViewport,
  Tool,
  Viewport,
  ViewState,
} from "@bentley/imodeljs-frontend";
import { MarkupApp } from "@bentley/imodeljs-markup";
import { AnimationPanel } from "./AnimationPanel";
import { CategoryPicker, ModelPicker } from "./IdPicker";
import { DebugPanel } from "./DebugPanel";
import { FeatureOverridesPanel } from "./FeatureOverrides";
import { StandardRotations } from "./StandardRotations";
import { createImageButton, createToolButton, ToolBar } from "./ToolBar";
import { ViewAttributesPanel } from "./ViewAttributes";
import { ViewList, ViewPicker } from "./ViewPicker";
import { SectionsPanel } from "./SectionTools";
import { SavedViewPicker } from "./SavedViews";
import { ClassificationsPanel } from "./ClassificationsPanel";
import { setTitle } from "./Title";
import { Window } from "./Window";
import { Surface } from "./Surface";

function saveImage(vp: Viewport) {
  const buffer = vp.readImage(undefined, new Point2d(768, 768), true); // flip vertically...
  if (undefined === buffer) {
    alert("Failed to read image");
    return;
  }

  const url = imageBufferToPngDataUrl(buffer, false);
  if (undefined === url) {
    alert("Failed to produce PNG");
    return;
  }

  openImageDataUrlInNewWindow(url, "Saved View");
}

async function zoomToSelectedElements(vp: Viewport) {
  const elems = vp.iModel.selectionSet.elements;
  if (0 < elems.size)
    await vp.zoomToElements(elems);
}

export class ZoomToSelectedElementsTool extends Tool {
  public static toolId = "ZoomToSelectedElements";
  public run(_args: any[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      zoomToSelectedElements(vp); // tslint:disable-line:no-floating-promises

    return true;
  }
}

export class SaveImageTool extends Tool {
  public static toolId = "SaveImage";
  public run(_args: any[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      saveImage(vp);

    return true;
  }
}

export class MarkupTool extends Tool {
  public static toolId = "Markup";
  public run(_args: any[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (MarkupApp.isActive) {
      // NOTE: Because we don't have separate START and STOP buttons in the test app, exit markup mode only when the Markup Select tool is active, otherwise start the Markup Select tool...
      const startMarkupSelect = IModelApp.toolAdmin.defaultToolId === MarkupApp.markupSelectToolId && (undefined === IModelApp.toolAdmin.activeTool || MarkupApp.markupSelectToolId !== IModelApp.toolAdmin.activeTool.toolId);
      if (startMarkupSelect) {
        IModelApp.toolAdmin.startDefaultTool();
        return true;
      }
      MarkupApp.props.result.maxWidth = 1500;
      MarkupApp.stop().then((markupData) => {
        if (undefined !== markupData.image)
          openImageDataUrlInNewWindow(markupData.image, "Markup");
      }).catch((_) => { });
    } else {
      MarkupApp.props.active.element.stroke = "white"; // as an example, set default color for elements
      MarkupApp.markupSelectToolId = "Markup.TestSelect"; // as an example override the default markup select tool to launch redline tools using key events
      MarkupApp.start(vp); // tslint:disable-line:no-floating-promises
    }

    return true;
  }
}

export interface ViewerProps {
  iModel: IModelConnection;
  defaultViewName?: string;
}

export class Viewer extends Window {
  public readonly views: ViewList;
  public readonly viewport: ScreenViewport;
  public readonly toolBar: ToolBar;
  private _imodel: IModelConnection;
  private readonly _viewPicker: ViewPicker;
  private readonly _3dOnly: HTMLElement[] = [];
  private _isSavedView = false;

  public static async create(surface: Surface, props: ViewerProps): Promise<Viewer> {
    const views = await ViewList.create(props.iModel, props.defaultViewName);
    const view = await views.getDefaultView(props.iModel);
    const viewer = new Viewer(surface, view, views, props);
    return viewer;
  }

  public clone(): Viewer {
    const view = this.viewport.view.clone();
    const viewer = new Viewer(Surface.instance, view, this.views, {
      iModel: view.iModel,
    });

    if (!this.isDocked) {
      // Match dimensions
      viewer.container.style.width = this.container.style.width;
      viewer.container.style.height = this.container.style.height;

      // Offset position from top-left corner
      const style = getComputedStyle(this.container, null);
      const pxToNum = (propName: string) => parseFloat(style.getPropertyValue(propName).replace("px", "")) + 40;
      viewer.container.style.top = pxToNum("top") + "px";
      viewer.container.style.left = pxToNum("left") + "px";
    }

    return viewer;
  }

  private constructor(surface: Surface, view: ViewState, views: ViewList, props: ViewerProps) {
    super(surface);
    surface.element.appendChild(this.container);

    this._imodel = props.iModel;
    this.viewport = ScreenViewport.create(this.contentDiv, view);
    this.views = views;

    this.toolBar = new ToolBar(IModelApp.makeHTMLElement("div", { className: "topdiv" }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue90c", // properties
      tooltip: "Debug info",
      createDropDown: async (container: HTMLElement) => Promise.resolve(new DebugPanel(this.viewport, container)),
    });

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue9cc",
      tooltip: "Open iModel from disk",
      click: () => {
        this.selectIModel(); // tslint:disable-line:no-floating-promises
      },
    }));

    this._viewPicker = new ViewPicker(this.toolBar.element, this.views);
    this._viewPicker.onSelectedViewChanged.addListener(async (id) => this.changeView(id));
    this._viewPicker.element.addEventListener("click", () => this.toolBar.close());

    this.toolBar.addDropDown({
      iconUnicode: "\ue90b", // "model"
      tooltip: "Models",
      only3d: true,
      createDropDown: async (container: HTMLElement) => {
        const picker = new ModelPicker(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addDropDown({
      iconUnicode: "\ue901", // "categories"
      tooltip: "Categories",
      createDropDown: async (container: HTMLElement) => {
        const picker = new CategoryPicker(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addDropDown({
      iconUnicode: "\ue90d", // "savedview"
      tooltip: "External saved views",
      createDropDown: async (container: HTMLElement) => {
        const picker = new SavedViewPicker(this.viewport, container, this);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addItem(createImageButton({
      src: "zoom.svg",
      click: () => IModelApp.tools.run("SVTSelect"),
      tooltip: "Element selection",
    }));

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ueb08",
      click: () => IModelApp.tools.run("Measure.Distance", IModelApp.viewManager.selectedView!),
      tooltip: "Measure distance",
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue90e",
      tooltip: "View settings",
      createDropDown: async (container: HTMLElement) => {
        const panel = new ViewAttributesPanel(this.viewport, container);
        await panel.populate();
        return panel;
      },
    });

    this.toolBar.addItem(createImageButton({
      src: "fit-to-view.svg",
      click: () => IModelApp.tools.run("View.Fit", this.viewport, true),
      tooltip: "Fit view",
    }));

    this.toolBar.addItem(createImageButton({
      src: "window-area.svg",
      click: () => IModelApp.tools.run("View.WindowArea", this.viewport),
      tooltip: "Window area",
    }));

    this.toolBar.addItem(createImageButton({
      src: "rotate-left.svg",
      click: () => IModelApp.tools.run("View.Rotate", this.viewport),
      tooltip: "Rotate",
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue909", // "gyroscope"
      createDropDown: async (container: HTMLElement) => Promise.resolve(new StandardRotations(container, this.viewport)),
      tooltip: "Standard rotations",
      only3d: true,
    });

    const walk = createImageButton({
      src: "walk.svg",
      click: () => IModelApp.tools.run("View.Walk", this.viewport),
      tooltip: "Walk",
    });
    this._3dOnly.push(walk);
    this.toolBar.addItem(walk);

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue982", // "undo"
      click: () => IModelApp.tools.run("View.Undo", this.viewport),
      tooltip: "View undo",
    }));

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue983", // "redo"
      click: () => IModelApp.tools.run("View.Redo", this.viewport),
      tooltip: "View redo",
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue931", // "animation"
      createDropDown: async (container: HTMLElement) => new AnimationPanel(this.viewport, container),
      tooltip: "Animation / solar time",
    });

    this.toolBar.addDropDown({
      iconUnicode: "\ue916", // "viewtop"
      tooltip: "Sectioning tools",
      createDropDown: async (container: HTMLElement) => new SectionsPanel(this.viewport, container),
    });

    this.toolBar.addDropDown({
      iconUnicode: "\ue9d8", // "property-data"
      tooltip: "Spatial Classification",
      only3d: true,
      createDropDown: async (container: HTMLElement) => {
        const panel = new ClassificationsPanel(this.viewport, container);
        await panel.populate();
        return panel;
      },
    });

    this.toolBar.addDropDown({
      iconUnicode: "\ue90a", // "isolate"
      createDropDown: async (container: HTMLElement) => new FeatureOverridesPanel(this.viewport, container),
      tooltip: "Override feature symbology",
    });

    this.updateTitle();
  }

  private updateTitle(): void {
    let viewName = this.viewport.view.code.value;
    if (undefined === viewName || 0 === viewName.length)
      viewName = "UNNAMED";

    const id = !this._isSavedView ? this.viewport.view.id : "Saved View";
    const dim = this.viewport.view.is2d() ? "2d" : "3d";
    this.title = "[ " + this.viewport.viewportId + " ] " + viewName + " <" + id + "> (" + dim + ")";
  }

  private async changeView(id: Id64String): Promise<void> {
    const view = await this.views.getView(id, this._imodel);
    await this.setView(view.clone());
    for (const control of this._3dOnly)
      control.style.display = this.viewport.view.is3d() ? "block" : "none";
  }

  public async setView(view: ViewState, isSavedView = false): Promise<void> {
    this._isSavedView = isSavedView;
    this.viewport.changeView(view);
    this.updateTitle();
    await this.toolBar.onViewChanged(this.viewport);
  }

  public async applySavedView(view: ViewState): Promise<void> {
    return this.setView(view, true);
  }

  private async openView(view: ViewState): Promise<void> {
    await this.setView(view);
    IModelApp.viewManager.addViewport(this.viewport);
  }

  private async clearViews(): Promise<void> {
    await this._imodel.closeSnapshot();
    this.views.clear();
  }

  private async buildViewList(): Promise<void> {
    await this.views.populate(this._imodel);
    this._viewPicker.populate(this.views);
  }

  private async resetIModel(filename: string): Promise<void> {
    let newIModel: IModelConnection;
    const sameFile = filename === this._imodel.iModelToken.key;
    if (!sameFile) {
      try {
        newIModel = await IModelConnection.openSnapshot(filename);
      } catch (err) {
        alert(err.toString());
        return;
      }
    }

    Surface.instance.onResetIModel(this);
    IModelApp.viewManager.dropViewport(this.viewport, false);

    await this.clearViews();

    if (sameFile)
      newIModel = await IModelConnection.openSnapshot(filename);

    this._imodel = newIModel!;
    await this.buildViewList();
    const view = await this.views.getDefaultView(this._imodel);
    await this.openView(view);

    this.updateTitle();
  }

  public async openFile(filename?: string): Promise<void> {
    return undefined !== filename ? this.openIModel(filename) : this.selectIModel();
  }

  private async selectIModel(): Promise<void> {
    const filename = await this.surface.selectFileName();
    return undefined !== filename ? this.openIModel(filename) : Promise.resolve();
  }

  private async openIModel(filename: string): Promise<void> {
    try {
      await this.resetIModel(filename);
      setTitle(filename);
    } catch (_) {
      alert("Error - could not open file.");
    }
  }

  public onFocus(): void {
    this._header.element.classList.add("viewport-header-focused");
    IModelApp.viewManager.setSelectedView(this.viewport);
  }

  public onLoseFocus(): void {
    this._header.element.classList.remove("viewport-header-focused");
  }

  public onSelected(): void {
    this._header.element.classList.add("viewport-header-selected");
    this.container.classList.add("viewport-selected");
  }

  public onDeselected(): void {
    this._header.element.classList.remove("viewport-header-selected");
    this.container.classList.remove("viewport-selected");
  }

  public get windowId(): string { return this.viewport.viewportId.toString(); }

  public onClosing(): void {
    IModelApp.viewManager.dropViewport(this.viewport, true);
  }

  public onClosed(): void {
    if (undefined === IModelApp.viewManager.selectedView) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Closing iModel..."));
      this._imodel.closeSnapshot().then(() => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "iModel closed."))); // tslint:disable-line:no-floating-promises
    }
  }
}
