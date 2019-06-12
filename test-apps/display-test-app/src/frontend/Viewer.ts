/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";
import { imageBufferToPngDataUrl, IModelApp, IModelConnection, PluginAdmin, ScreenViewport, Viewport, ViewState } from "@bentley/imodeljs-frontend";
import { MarkupApp } from "@bentley/imodeljs-markup";
import { AnimationPanel } from "./AnimationPanel";
import { CategoryPicker, ModelPicker } from "./IdPicker";
import { DebugPanel } from "./DebugPanel";
import { emphasizeSelectedElements, FeatureOverridesPanel } from "./FeatureOverrides";
import { IncidentMarkerDemo } from "./IncidentMarkerDemo";
import { toggleProjectExtents } from "./ProjectExtents";
import { RealityModelPicker } from "./RealityModelPicker";
import { addSnapModes } from "./SnapModes";
import { StandardRotations } from "./StandardRotations";
import { TileLoadIndicator } from "./TileLoadIndicator";
import { createImageButton, createToolButton, ToolBar, ToolBarDropDown } from "./ToolBar";
import { ViewAttributesPanel } from "./ViewAttributes";
import { ViewList, ViewPicker } from "./ViewPicker";
import { SectionsPanel } from "./SectionTools";
import { SavedViewPicker } from "./SavedViews";

// ###TODO: I think the picker populates correctly, but I have no way to test - and if no reality models are available,
// the button doesn't disappear until you click on it. Revisit when Alain has something useful for us.
const wantRealityModels = false;

function saveImage(vp: Viewport) {
  const buffer = vp.readImage(undefined, undefined, true); // flip vertically...
  if (undefined === buffer) {
    alert("Failed to read image");
    return;
  }

  const url = imageBufferToPngDataUrl(buffer);
  if (undefined === url) {
    alert("Failed to produce PNG");
    return;
  }

  window.open(url, "Saved View");
}

async function zoomToSelectedElements(vp: Viewport) {
  const elems = vp.iModel.selectionSet.elements;
  if (0 < elems.size)
    await vp.zoomToElements(elems);
}

class DebugTools extends ToolBarDropDown {
  private readonly _element: HTMLElement;

  public constructor(parent: HTMLElement) {
    super();

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "flex";
    this._element.style.cssFloat = "left";
    this._element.style.width = "440px";

    this._element.appendChild(createImageButton({
      src: "Warning_sign.svg",
      click: () => IncidentMarkerDemo.toggle(IModelApp.viewManager.selectedView!.iModel.projectExtents),
      tooltip: "Test incident markers",
    }));

    this._element.appendChild(createImageButton({
      src: "cold.svg",
      click: () => IModelApp.tools.run("Plugin", ["wmsPlugin.js"]),
      tooltip: "Test WMS Weather Maps",
    }));

    this._element.appendChild(createToolButton({
      className: "bim-icon-viewbottom",
      click: () => toggleProjectExtents(IModelApp.viewManager.selectedView!.iModel),
      tooltip: "Toggle project extents",
    }));

    this._element.appendChild(createToolButton({
      className: "bim-icon-savedview",
      click: () => saveImage(IModelApp.viewManager.selectedView!),
      tooltip: "Save view as image",
    }));

    this._element.appendChild(createToolButton({
      className: "bim-icon-measure-tool",
      click: () => IModelApp.tools.run("DrawingAidTest.Points", IModelApp.viewManager.selectedView!),
      tooltip: "Test drawing aid tools",
    }));

    const wantEmphasize = false;
    if (wantEmphasize) {
      this._element.appendChild(createToolButton({
        className: "bim-icon-cancel",
        click: () => emphasizeSelectedElements(IModelApp.viewManager.selectedView!),
        tooltip: "Emphasize selected elements",
      }));
    } else {
      this._element.appendChild(createToolButton({
        className: "bim-icon-cancel",
        click: () => zoomToSelectedElements(IModelApp.viewManager.selectedView!),
        tooltip: "Zoom to selected elements",
      }));
    }

    this._element.appendChild(createImageButton({
      src: "Markup.svg",
      click: async () => this.doMarkup(),
      tooltip: "Create Markup for View",
    }));
    this._element.appendChild(createToolButton({
      className: "bim-icon-work",
      click: async () => PluginAdmin.loadPlugin("startWebWorkerPlugin.js"),
      tooltip: "Start Web Worker Test",
    }));
    parent.appendChild(this._element);
  }

  private async doMarkup() {
    if (MarkupApp.isActive) {
      // NOTE: Because we don't have separate START and STOP buttons in the test app, exit markup mode only when the Markup Select tool is active, otherwise start the Markup Select tool...
      const startMarkupSelect = IModelApp.toolAdmin.defaultToolId === MarkupApp.markupSelectToolId && (undefined === IModelApp.toolAdmin.activeTool || MarkupApp.markupSelectToolId !== IModelApp.toolAdmin.activeTool.toolId);
      if (startMarkupSelect) {
        IModelApp.toolAdmin.startDefaultTool();
        return;
      }
      MarkupApp.props.result.maxWidth = 1500;
      const markupData = await MarkupApp.stop();
      // tslint:disable:no-console
      window.open(markupData.image, "Markup");
    } else {
      MarkupApp.props.active.element.stroke = "white"; // as an example, set default color for elements
      MarkupApp.markupSelectToolId = "Markup.TestSelect"; // as an example override the default markup select tool to launch redline tools using key events
      await MarkupApp.start(IModelApp.viewManager.selectedView!);
    }
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  protected _open(): void { this._element.style.display = "flex"; }
  protected _close(): void { this._element.style.display = "none"; }
}

// Only want the following imports if we are using electron and not a browser -----
// tslint:disable-next-line:variable-name
let remote: any;
if (ElectronRpcConfiguration.isElectron) {
  // tslint:disable-next-line:no-var-requires
  remote = require("electron").remote;
}

export interface ViewerProps {
  iModel: IModelConnection;
  fileDirectoryPath?: string;
  defaultViewName?: string;
}

export class Viewer {
  public readonly views: ViewList;
  public readonly viewport: ScreenViewport;
  public readonly toolBar: ToolBar;
  private _imodel: IModelConnection;
  private readonly _fileDirectoryPath?: string;
  private readonly _spinner: HTMLElement;
  private readonly _viewPicker: ViewPicker;
  private readonly _3dOnly: HTMLElement[] = [];

  public static async create(props: ViewerProps): Promise<Viewer> {
    const views = await ViewList.create(props.iModel, props.defaultViewName);
    const vpDiv = document.getElementById("imodel-viewport") as HTMLDivElement;
    const view = await views.getDefaultView(props.iModel);
    const viewport = ScreenViewport.create(vpDiv, view);
    const viewer = new Viewer(viewport, views, props);
    return viewer;
  }

  private constructor(viewport: ScreenViewport, views: ViewList, props: ViewerProps) {
    this._imodel = props.iModel;
    this.viewport = viewport;
    this.views = views;
    this._fileDirectoryPath = props.fileDirectoryPath;

    this._spinner = document.getElementById("spinner") as HTMLDivElement;

    new TileLoadIndicator(document.getElementById("tileLoadIndicatorContainer") as HTMLDivElement, this.viewport);
    addSnapModes(document.getElementById("snapModesContainer")!);

    this.toolBar = new ToolBar(document.getElementById("toolBar")!);

    this.toolBar.addDropDown({
      className: "bim-icon-properties",
      tooltip: "Debug info",
      createDropDown: async (container: HTMLElement) => Promise.resolve(new DebugPanel(this.viewport, container)),
    });

    this.toolBar.addItem(createToolButton({
      className: "bim-icon-briefcases",
      tooltip: "Open iModel from disk",
      click: () => { this.selectIModel(); }, // tslint:disable-line:no-floating-promises
    }));

    this._viewPicker = new ViewPicker(this.toolBar.element, this.views);
    this._viewPicker.onSelectedViewChanged.addListener(async (id) => this.changeView(id));
    this._viewPicker.element.addEventListener("click", () => this.toolBar.close());

    this.toolBar.addDropDown({
      className: "bim-icon-model",
      tooltip: "Models",
      createDropDown: async (container: HTMLElement) => {
        const picker = new ModelPicker(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    if (wantRealityModels) {
      this.toolBar.addDropDown({
        className: "bim-icon-model",
        tooltip: "Reality models",
        createDropDown: async (container: HTMLElement) => {
          const picker = new RealityModelPicker(this.viewport, container);
          await picker.populate();
          return picker;
        },
      });
    }

    this.toolBar.addDropDown({
      className: "bim-icon-categories",
      tooltip: "Categories",
      createDropDown: async (container: HTMLElement) => {
        const picker = new CategoryPicker(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addDropDown({
      className: "bim-icon-savedview",
      tooltip: "External saved views",
      createDropDown: async (container: HTMLElement) => {
        const picker = new SavedViewPicker(this.viewport, container, this);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addItem(createImageButton({
      src: "zoom.svg",
      click: () => IModelApp.tools.run("Select"),
      tooltip: "Element selection",
    }));

    this.toolBar.addDropDown({
      className: "bim-icon-settings",
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

    const walk = createImageButton({
      src: "walk.svg",
      click: () => IModelApp.tools.run("View.Walk", this.viewport),
      tooltip: "Walk",
    });
    this._3dOnly.push(walk);
    this.toolBar.addItem(walk);

    this.toolBar.addItem(createImageButton({
      src: "rotate-left.svg",
      click: () => IModelApp.tools.run("View.Rotate", this.viewport),
      tooltip: "Rotate",
    }));

    this.toolBar.addDropDown({
      className: "bim-icon-gyroscope",
      createDropDown: async (container: HTMLElement) => Promise.resolve(new StandardRotations(container, this.viewport)),
      tooltip: "Standard rotations",
    });

    this.toolBar.addItem(createToolButton({
      className: "bim-icon-undo",
      click: () => IModelApp.tools.run("View.Undo", this.viewport),
      tooltip: "View redo",
    }));

    this.toolBar.addItem(createToolButton({
      className: "bim-icon-redo",
      click: () => IModelApp.tools.run("View.Redo", this.viewport),
      tooltip: "View undo",
    }));

    this.toolBar.addItem(createToolButton({
      className: "rd-icon-measure-distance",
      click: () => IModelApp.tools.run("Measure.Distance", IModelApp.viewManager.selectedView!),
      tooltip: "Measure distance",
    }));

    this.toolBar.addDropDown({
      className: "bim-icon-animation",
      createDropDown: async (container: HTMLElement) => new AnimationPanel(this.viewport, container),
      tooltip: "Animation / solar time",
    });

    this.toolBar.addDropDown({
      className: "bim-icon-isolate",
      createDropDown: async (container: HTMLElement) => new FeatureOverridesPanel(this.viewport, container),
      tooltip: "Override feature symbology",
    });

    this.toolBar.addDropDown({
      className: "bim-icon-viewtop",
      tooltip: "Sectioning tools",
      createDropDown: async (container: HTMLElement) => new SectionsPanel(this.viewport, container),
    });

    this.toolBar.addDropDown({
      className: "bim-icon-appicon",
      createDropDown: async (container: HTMLElement) => new DebugTools(container),
      tooltip: "Debug tools",
    });

    const fileSelector = document.getElementById("browserFileSelector") as HTMLInputElement;
    fileSelector.onchange = async () => {
      const files = fileSelector.files;
      if (files && files.length > 0) {
        try {
          await this.resetIModel(this._fileDirectoryPath! + "/" + files[0].name);
        } catch {
          alert("Error Opening iModel - Make sure you are selecting files from the following directory: " + this._fileDirectoryPath!);
          this.hideSpinner();
        }
      }
    };

    IModelApp.viewManager.addViewport(this.viewport);
  }

  private async changeView(id: Id64String): Promise<void> {
    await this.withSpinner(async () => {
      const view = await this.views.getView(id, this._imodel);
      await this.setView(view.clone());
      for (const control of this._3dOnly)
        control.style.display = this.viewport.view.is3d() ? "block" : "none";
    });
  }

  public async setView(view: ViewState): Promise<void> {
    this.viewport.changeView(view);
    await this.toolBar.onViewChanged();
  }

  private async openView(view: ViewState): Promise<void> {
    await this.setView(view);
    IModelApp.viewManager.addViewport(this.viewport);
  }

  private async clearViews(): Promise<void> {
    await this._imodel.closeSnapshot();
    this.views.clear();
  }

  private async openIModel(filename: string): Promise<void> {
    this._imodel = await IModelConnection.openSnapshot(filename);
  }

  private async buildViewList(): Promise<void> {
    await this.views.populate(this._imodel);
    this._viewPicker.populate(this.views);
  }

  private async resetIModel(filename: string): Promise<void> {
    await this.withSpinner(async () => {
      IModelApp.viewManager.dropViewport(this.viewport, false);
      await this.clearViews();
      await this.openIModel(filename);
      await this.buildViewList();
      const view = await this.views.getDefaultView(this._imodel);
      await this.openView(view);
    });
  }

  private async selectIModel(): Promise<void> {
    if (ElectronRpcConfiguration.isElectron) {  // Electron
      const options = {
        properties: ["openFile"],
        filters: [{ name: "IModels", extensions: ["ibim", "bim"] }],
      };
      remote.dialog.showOpenDialog(options, async (filePaths?: string[]) => {
        if (undefined !== filePaths)
          await this.resetIModel(filePaths[0]);
      });
    } else {  // Browser
      if (undefined === this._fileDirectoryPath || !document.createEvent) { // Do not have standalone path for files or support for document.createEvent... request full file path
        const filePath = prompt("Enter the full local path of the iModel you wish to open:");
        if (filePath !== null) {
          try {
            await this.resetIModel(filePath);
          } catch {
            alert("Error - The file path given is invalid.");
            this.hideSpinner();
          }
        }
      } else {  // Was given a base path for all standalone files. Let them select file using file selector
        const selector = document.getElementById("browserFileSelector");
        const evt = document.createEvent("MouseEvents");
        evt.initEvent("click", true, false);
        selector!.dispatchEvent(evt);
      }
    }
  }

  private showSpinner() { this._spinner.style.display = "block"; }
  private hideSpinner() { this._spinner.style.display = "none"; }
  private async withSpinner(func: () => Promise<void>): Promise<void> {
    this.showSpinner();
    await func();
    this.hideSpinner();
  }
}
