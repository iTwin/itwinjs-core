/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Vector3d } from "@itwin/core-geometry";
import { ModelClipGroup, ModelClipGroups } from "@itwin/core-common";
import {
  IModelApp, IModelConnection, MarginOptions, MarginPercent, NotifyMessageDetails, openImageDataUrlInNewWindow, OutputMessagePriority,
  PaddingPercent, ScreenViewport, Tool, Viewport, ViewState,
} from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";
import { MarkupApp, MarkupData } from "@itwin/core-markup";
import { ClassificationsPanel } from "./ClassificationsPanel";
import { DebugWindow } from "./DebugWindow";
import { FeatureOverridesPanel } from "./FeatureOverrides";
import { CategoryPicker, ModelPicker } from "./IdPicker";
import { SavedViewPicker } from "./SavedViews";
import { CameraPathsMenu } from "./CameraPaths";
import { SectionsPanel } from "./SectionTools";
import { StandardRotations } from "./StandardRotations";
import { Surface } from "./Surface";
import { createTimeline } from "./Timeline";
import { setTitle } from "./Title";
import { createImageButton, createToolButton, ToolBar } from "./ToolBar";
import { ViewAttributesPanel } from "./ViewAttributes";
import { ViewList, ViewPicker } from "./ViewPicker";
import { Window } from "./Window";
import { openIModel, OpenIModelProps } from "./openIModel";
import { HubPicker } from "./HubPicker";

// cspell:ignore savedata topdiv savedview viewtop

async function zoomToSelectedElements(vp: Viewport, options?: MarginOptions) {
  const elems = vp.iModel.selectionSet.elements;
  if (0 < elems.size)
    await vp.zoomToElements(elems, { animateFrustumChange: true, ...options });
}

export class ZoomToSelectedElementsTool extends Tool {
  private _margin?: MarginPercent;
  private _padding?: PaddingPercent | number;

  public static override toolId = "ZoomToSelectedElements";
  public static override get maxArgs() { return 4; }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      await zoomToSelectedElements(vp, {
        marginPercent: this._margin,
        paddingPercent: this._padding,
      });
    }

    return true;
  }

  public override async parseAndRun(...input: string[]): Promise<boolean> {
    const args = parseArgs(input);
    const padding = args.getFloat("p");
    if (undefined !== padding) {
      if (args.getBoolean("m"))
        this._margin = { left: padding, right: padding, top: padding, bottom: padding };
      else
        this._padding = padding;
    } else {
      const left = args.getFloat("l") ?? 0;
      const right = args.getFloat("r") ?? 0;
      const top = args.getFloat("t") ?? 0;
      const bottom = args.getFloat("b") ?? 0;
      if (undefined !== left || undefined !== right || undefined !== top || undefined !== bottom) {
        if (args.getBoolean("m"))
          this._margin = { left, right, top, bottom };
        else
          this._padding = { left, right, top, bottom };
      }
    }

    return this.run();
  }
}

export class ModelClipTool extends Tool {
  public static override toolId = "ModelClip";
  public override async run(_args: any[]): Promise<boolean> {
    const view = IModelApp.viewManager.selectedView?.view;
    if (!view || !view.isSpatialView() || view.modelSelector.models.size < 2)
      return true;

    const createClip = (vector: Vector3d) => {
      const plane = ClipPlane.createNormalAndPoint(vector, view.iModel.projectExtents.center)!;
      const planes = ConvexClipPlaneSet.createPlanes([plane]);
      const primitive = ClipPrimitive.createCapture(planes);
      return ClipVector.createCapture([primitive]);
    };

    const leftModels: string[] = [];
    const rightModels: string[] = [];
    let left = true;
    view.modelSelector.models.forEach((model) => {
      (left ? leftModels : rightModels).push(model);
      left = !left;
    });

    view.details.modelClipGroups = new ModelClipGroups([
      ModelClipGroup.create(createClip(Vector3d.unitX().negate()), rightModels),
      ModelClipGroup.create(createClip(Vector3d.unitZ().negate()), leftModels),
    ]);

    IModelApp.viewManager.selectedView!.invalidateScene();
    return true;
  }
}

export class MarkupTool extends Tool {
  public static override toolId = "Markup";
  public static savedData?: MarkupData;
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(wantSavedData: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (MarkupApp.isActive) {
      // NOTE: Because we don't have separate START and STOP buttons in the test app, exit markup mode only when the Markup Select tool is active, otherwise start the Markup Select tool...
      const startMarkupSelect = IModelApp.toolAdmin.defaultToolId === MarkupApp.markupSelectToolId && (undefined === IModelApp.toolAdmin.activeTool || MarkupApp.markupSelectToolId !== IModelApp.toolAdmin.activeTool.toolId);
      if (startMarkupSelect) {
        await IModelApp.toolAdmin.startDefaultTool();
        return true;
      }
      MarkupApp.props.result.maxWidth = 1500;
      MarkupApp.stop().then((markupData) => {
        if (wantSavedData)
          MarkupTool.savedData = markupData;
        if (undefined !== markupData.image)
          openImageDataUrlInNewWindow(markupData.image, "Markup");
      }).catch((_) => { });
    } else {
      MarkupApp.props.active.element.stroke = "white"; // as an example, set default color for elements
      MarkupApp.markupSelectToolId = "Markup.TestSelect"; // as an example override the default markup select tool to launch redline tools using key events
      await MarkupApp.start(vp, wantSavedData ? MarkupTool.savedData : undefined);
    }

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const wantSavedData = "savedata" === args[0]?.toLowerCase();
    return this.run(wantSavedData);
  }
}

export interface ViewerProps {
  iModel: IModelConnection;
  defaultViewName?: string;
  disableEdges?: boolean;
}

export class Viewer extends Window {
  public readonly views: ViewList;
  public readonly viewport: ScreenViewport;
  public readonly toolBar: ToolBar;
  public readonly disableEdges: boolean;
  private _imodel: IModelConnection;
  private readonly _viewPicker: ViewPicker;
  private readonly _3dOnly: HTMLElement[] = [];
  private _isSavedView = false;
  private _debugWindow?: DebugWindow;

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
      disableEdges: this.disableEdges,
    });

    if (!this.isDocked) {
      // Match dimensions
      viewer.container.style.width = this.container.style.width;
      viewer.container.style.height = this.container.style.height;

      // Offset position from top-left corner
      const style = getComputedStyle(this.container, null);
      const pxToNum = (propName: string) => parseFloat(style.getPropertyValue(propName).replace("px", "")) + 40;
      viewer.container.style.top = `${pxToNum("top")}px`;
      viewer.container.style.left = `${pxToNum("left")}px`;
    }

    return viewer;
  }

  private _maybeDisableEdges() {
    if (this.disableEdges && (this.viewport.viewFlags.visibleEdges || this.viewport.viewFlags.hiddenEdges)) {
      this.viewport.viewFlags = this.viewport.viewFlags.copy({ visibleEdges: false, hiddenEdges: false });
    }
  }

  private constructor(surface: Surface, view: ViewState, views: ViewList, props: ViewerProps) {
    super(surface, { scrollbars: true });

    // Allow HTMLElements beneath viewport to be visible if background color has transparency.
    this.contentDiv.style.backgroundColor = "transparent";
    this.container.style.backgroundColor = "transparent";
    surface.element.appendChild(this.container);

    this.disableEdges = true === props.disableEdges;
    this._imodel = props.iModel;
    this.viewport = ScreenViewport.create(this.contentDiv, view);
    this.views = views;

    this._maybeDisableEdges();

    this.toolBar = new ToolBar(IModelApp.makeHTMLElement("div", { className: "topdiv" }));

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue90c", // properties
      tooltip: "Debug info",
      click: () => this.toggleDebugWindow(),
    }));

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue9cc",
      tooltip: "Open iModel from disk",
      click: async () => {
        await this.selectIModel();
      },
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue9e0", // cloud-download
      tooltip: "Open iModel from hub",
      createDropDown: async (container: HTMLElement) => {
        const picker = new HubPicker(container, async (iModelId, iTwinId) => {
          alert(`About to download and open hub iModel. Note that this could take quite some time without any feedback.`);
          await this.openIModel({
            iModelId,
            iTwinId,
            writable: this.surface.openReadWrite,
          });
          picker.close();
        });
        await picker.populate();
        return picker;
      },
    });

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

    this.toolBar.addDropDown({
      iconUnicode: "\ue932",
      tooltip: "Saved camera paths",
      createDropDown: async (container: HTMLElement) => {
        const picker = new CameraPathsMenu(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addItem(createImageButton({
      src: "zoom.svg",
      click: async () => IModelApp.tools.run("SVTSelect"),
      tooltip: "Element selection",
    }));

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ueb08",
      click: async () => IModelApp.tools.run("Measure.Distance", IModelApp.viewManager.selectedView!),
      tooltip: "Measure distance",
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue90e",
      tooltip: "View settings",
      createDropDown: async (container: HTMLElement) => {
        const panel = new ViewAttributesPanel(this.viewport, container, this.disableEdges);
        await panel.populate();
        return panel;
      },
    });

    this.toolBar.addItem(createImageButton({
      src: "fit-to-view.svg",
      click: async () => IModelApp.tools.run("View.Fit", this.viewport, true),
      tooltip: "Fit view",
    }));

    this.toolBar.addItem(createImageButton({
      src: "window-area.svg",
      click: async () => IModelApp.tools.run("View.WindowArea", this.viewport),
      tooltip: "Window area",
    }));

    this.toolBar.addItem(createImageButton({
      src: "rotate-left.svg",
      click: async () => IModelApp.tools.run("View.Rotate", this.viewport),
      tooltip: "Rotate",
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue909", // "gyroscope"
      createDropDown: async (container: HTMLElement) => new StandardRotations(container, this.viewport),
      tooltip: "Standard rotations",
      only3d: true,
    });

    const walk = createImageButton({
      src: "walk.svg",
      click: async () => IModelApp.tools.run("View.LookAndMove", this.viewport),
      tooltip: "Walk",
    });
    this._3dOnly.push(walk);
    this.toolBar.addItem(walk);

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue982", // "undo"
      click: async () => IModelApp.tools.run("View.Undo", this.viewport),
      tooltip: "View undo",
    }));

    this.toolBar.addItem(createToolButton({
      iconUnicode: "\ue983", // "redo"
      click: async () => IModelApp.tools.run("View.Redo", this.viewport),
      tooltip: "View redo",
    }));

    this.toolBar.addDropDown({
      iconUnicode: "\ue931", // "animation"
      createDropDown: async (container: HTMLElement) => createTimeline(this.viewport, container, 10),
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
    this.updateActiveSettings();
  }

  private updateTitle(): void {
    let viewName = this.viewport.view.code.value;
    if (undefined === viewName || 0 === viewName.length)
      viewName = "UNNAMED";

    const id = !this._isSavedView ? this.viewport.view.id : "Saved View";
    const dim = this.viewport.view.is2d() ? "2d" : "3d";
    this.title = `[ ${this.viewport.viewportId} ] ${viewName} <${id}> (${dim})`;
  }

  private updateActiveSettings(): void {
    // NOTE: First category/model is fine for testing purposes...
    const view = this.viewport.view;
    if (!view.iModel.isBriefcaseConnection())
      return;

    const settings = view.iModel.editorToolSettings;
    if (undefined === settings.category || !view.viewsCategory(settings.category)) {
      settings.category = undefined;
      for (const catId of view.categorySelector.categories) {
        settings.category = catId;
        break;
      }
    }

    if (undefined === settings.model || !view.viewsModel(settings.model)) {
      settings.model = undefined;
      if (view.is2d()) {
        settings.model = view.baseModelId;
      } else if (view.isSpatialView()) {
        settings.model = undefined;
        for (const modId of view.modelSelector.models) {
          settings.model = modId;
          break;
        }
      }
    }
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
    this._maybeDisableEdges();
    this.updateTitle();
    this.updateActiveSettings();
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
    await this.closeIModel();
    this.views.clear();
  }

  private async buildViewList(): Promise<void> {
    await this.views.populate(this._imodel);
    this._viewPicker.populate(this.views);
  }

  private async resetIModel(props: OpenIModelProps): Promise<void> {
    const { fileName, iModelId } = props;
    let newIModel: IModelConnection;
    const sameFile = (fileName !== undefined && fileName === this._imodel.key) || (iModelId !== undefined && iModelId === this._imodel.iModelId);
    if (!sameFile) {
      try {
        newIModel = await openIModel({ ...props, writable: this.surface.openReadWrite });
      } catch (err: any) {
        alert(err.toString());
        return;
      }
    }

    Surface.instance.onResetIModel(this);
    IModelApp.viewManager.dropViewport(this.viewport, false);

    await this.clearViews();

    if (sameFile)
      newIModel = await openIModel({ ...props, writable: this.surface.openReadWrite });

    this._imodel = newIModel!;
    await this.buildViewList();
    const view = await this.views.getDefaultView(this._imodel);
    await this.openView(view);
  }

  public async openFile(fileName?: string): Promise<void> {
    return undefined !== fileName ? this.openIModel({ fileName, writable: this.surface.openReadWrite }) : this.selectIModel();
  }

  private async selectIModel(): Promise<void> {
    const fileName = await this.surface.selectFileName();
    return undefined !== fileName ? this.openIModel({ fileName, writable: this.surface.openReadWrite }) : Promise.resolve();
  }

  private async openIModel(props: OpenIModelProps): Promise<void> {
    try {
      await this.resetIModel(props);
      setTitle(this._imodel);
    } catch {
      alert("Error - could not open file.");
    }
  }

  private async closeIModel(): Promise<void> {
    return this._imodel.close();
  }

  public override onFocus(): void {
    this._header.element.classList.add("viewport-header-focused");
    void IModelApp.viewManager.setSelectedView(this.viewport);
  }

  public override onLoseFocus(): void {
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

  public override onClosing(): void {
    this.toolBar.dispose();
    if (this._debugWindow) {
      this._debugWindow.dispose();
      this._debugWindow = undefined;
    }

    IModelApp.viewManager.dropViewport(this.viewport, true);
  }

  public override onClosed(): void {
    if (undefined === IModelApp.viewManager.selectedView) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Closing iModel..."));

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.closeIModel().then(() => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "iModel closed.")));
    }
  }

  public toggleDebugWindow(): void {
    if (!this._debugWindow)
      this._debugWindow = new DebugWindow(this.viewport);

    this._debugWindow.toggle();
  }
}
