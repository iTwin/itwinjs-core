/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
  OpenMode,
} from "@bentley/bentleyjs-core";
import {
  ElectronRpcConfiguration,
  MobileRpcConfiguration,
} from "@bentley/imodeljs-common";
import {
  imageBufferToPngDataUrl,
  IModelApp,
  IModelConnection,
  ScreenViewport,
  Viewport,
  ViewState,
} from "@bentley/imodeljs-frontend";
import { ViewList, ViewPicker } from "./ViewPicker";
import { ToolBar, ToolBarDropDown, createImageButton, createToolButton } from "./ToolBar";
import { DebugPanel } from "./DebugPanel";
import { ModelPicker } from "./ModelPicker";
import { RealityModelPicker } from "./RealityModelPicker";
import { CategoryPicker } from "./CategoryPicker";
import { ViewAttributesPanel } from "./ViewAttributes";
import { StandardRotations } from "./StandardRotations";
import { TileLoadIndicator } from "./TileLoadIndicator";
import { addSnapModes } from "./SnapModes";
import { createComboBox } from "./ComboBox";
import { toggleIncidentMarkers } from "./IncidentMarkerDemo";
import { toggleProjectExtents } from "./ProjectExtents";
import { AnimationPanel } from "./AnimationPanel";
import { emphasizeSelectedElements } from "./FeatureOverrides";

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

class DebugTools extends ToolBarDropDown {
  private readonly _element: HTMLElement;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "flex";
    this._element.style.cssFloat = "left";

    this._element.appendChild(createImageButton({
      src: "Warning_sign.svg",
      click: () => toggleIncidentMarkers(vp.iModel.projectExtents),
    }));

    this._element.appendChild(createToolButton({
      className: "bim-icon-viewbottom",
      click: () => toggleProjectExtents(vp.iModel),
    }));

    this._element.appendChild(createToolButton({
      className: "bim-icon-savedview",
      click: () => saveImage(vp),
    }));

    this._element.appendChild(createToolButton({
      className: "rd-icon-measure-distance",
      click: () => IModelApp.tools.run("DrawingAidTest.Points", vp), // ###TODO Fix the drop-down...
    }));

    this._element.appendChild(createToolButton({
      className: "bim-icon-cancel",
      click: () => emphasizeSelectedElements(vp),
      tooltip: "Emphasize selected elements",
    }));

    parent.appendChild(this._element);
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
    return new Viewer(viewport, views, props);
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
      createDropDown: async (container: HTMLElement) => Promise.resolve(new DebugPanel(this.viewport, container)),
    });

    // iOS uses a combo box of predetermined iModels instead of a file picker.
    if (MobileRpcConfiguration.isMobileFrontend) {
      const cbx = createComboBox({
        id: "imodelList",
        entries: [
          { name: "04_Plant.i.ibim'", value: "04_Plant" },
          { name: "almostopaque.ibim'", value: "almostopaque" },
          { name: "mesh_widget_piece.ibim'", value: "mesh_widget_piece" },
          { name: "PhotoRealisticRendering.ibim'", value: "PhotoRealisticRendering" },
          { name: "PSolidNewTransparent.ibim'", value: "PSolidNewTransparent" },
          { name: "rectangle.ibim'", value: "rectangle" },
          { name: "scattergories.ibim'", value: "scattergories" },
          { name: "SketchOnSurface.ibim'", value: "SketchOnSurface" },
          { name: "slabs.ibim'", value: "slabs" },
          { name: "small_building_2.ibim'", value: "small_building_2" },
          { name: "tr_blk.ibim'", value: "tr_blk" },
        ],
      });

      cbx.select.onchange = async (ev: any) => {
        const iModelName = ev.target.selectedOptions["0"].value;
        await this.resetIModel("sample_documents/" + iModelName);
      };

      this.toolBar.addItem(cbx.div);
    } else {
      this.toolBar.addItem(createToolButton({
        className: "bim-icon-briefcases",
        click: () => { this.selectIModel(); }, // tslint:disable-line:no-floating-promises
      }));
    }

    this._viewPicker = new ViewPicker(this.toolBar.element, this.views);
    this._viewPicker.onSelectedViewChanged.addListener(async (id) => this.changeView(id));
    this._viewPicker.element.addEventListener("click", () => this.toolBar.close());

    this.toolBar.addDropDown({
      className: "bim-icon-model",
      createDropDown: async (container: HTMLElement) => {
        const picker = new ModelPicker(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    if (wantRealityModels) {
      this.toolBar.addDropDown({
        className: "bim-icon-model",
        createDropDown: async (container: HTMLElement) => {
          const picker = new RealityModelPicker(this.viewport, container);
          await picker.populate();
          return picker;
        },
      });
    }

    this.toolBar.addDropDown({
      className: "bim-icon-categories",
      createDropDown: async (container: HTMLElement) => {
        const picker = new CategoryPicker(this.viewport, container);
        await picker.populate();
        return picker;
      },
    });

    this.toolBar.addItem(createImageButton({
      src: "zoom.svg",
      click: () => IModelApp.tools.run("Select"),
    }));

    this.toolBar.addDropDown({
      className: "bim-icon-settings",
      createDropDown: async (container: HTMLElement) => Promise.resolve(new ViewAttributesPanel(this.viewport, container)),
    });

    const toggleCamera = createImageButton({
      src: "toggle-camera.svg",
      click: () => IModelApp.tools.run("View.ToggleCamera", this.viewport),
    });
    this._3dOnly.push(toggleCamera);
    this.toolBar.addItem(toggleCamera);

    this.toolBar.addItem(createImageButton({
      src: "fit-to-view.svg",
      click: () => IModelApp.tools.run("View.Fit", this.viewport, true),
    }));

    this.toolBar.addItem(createImageButton({
      src: "window-area.svg",
      click: () => IModelApp.tools.run("View.WindowArea", this.viewport),
    }));

    const walk = createImageButton({
      src: "walk.svg",
      click: () => IModelApp.tools.run("View.Walk", this.viewport),
    });
    this._3dOnly.push(walk);
    this.toolBar.addItem(walk);

    this.toolBar.addItem(createImageButton({
      src: "rotate-left.svg",
      click: () => IModelApp.tools.run("View.Rotate", this.viewport),
    }));

    this.toolBar.addDropDown({
      className: "bim-icon-gyroscope",
      createDropDown: async (container: HTMLElement) => Promise.resolve(new StandardRotations(this.viewport, container)),
    });

    this.toolBar.addItem(createToolButton({
      className: "bim-icon-undo",
      click: () => IModelApp.tools.run("View.Undo", this.viewport),
    }));

    this.toolBar.addItem(createToolButton({
      className: "bim-icon-redo",
      click: () => IModelApp.tools.run("View.Redo", this.viewport),
    }));

    this.toolBar.addDropDown({
      className: "bim-icon-animation",
      createDropDown: async (container: HTMLElement) => new AnimationPanel(this.viewport, container),
    });

    this.toolBar.addDropDown({
      className: "bim-icon-appicon",
      createDropDown: async (container: HTMLElement) => new DebugTools(this.viewport, container),
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
      await this._changeView(view.clone());
      for (const control of this._3dOnly)
        control.style.display = this.viewport.view.is3d() ? "block" : "none";
    });
  }

  private async _changeView(view: ViewState): Promise<void> {
    this.viewport.changeView(view);
    await this.toolBar.onViewChanged();
  }

  private async openView(view: ViewState): Promise<void> {
    await this._changeView(view);
    IModelApp.viewManager.addViewport(this.viewport);
  }

  private async clearViews(): Promise<void> {
    await this._imodel.closeStandalone();

    this.views.clear();
  }

  private async openIModel(filename: string): Promise<void> {
    this._imodel = await IModelConnection.openStandalone(filename, OpenMode.Readonly);
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
