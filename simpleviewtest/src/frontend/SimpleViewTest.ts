/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelApp, IModelConnection, ViewState, Viewport, StandardViewId, ViewState3d, SpatialViewState, SpatialModelState, AccuDraw, PrimitiveTool, SnapMode, AccuSnap, NotificationManager, ToolTipOptions, NotifyMessageDetails } from "@bentley/imodeljs-frontend";
import { Target } from "@bentley/imodeljs-frontend/lib/rendering";
import { Config, DeploymentEnv } from "@bentley/imodeljs-clients/lib";
import {
  ElectronRpcManager,
  ElectronRpcConfiguration,
  StandaloneIModelRpcInterface,
  IModelTileRpcInterface,
  IModelReadRpcInterface,
  ViewQueryParams,
  ModelProps,
  ModelQueryParams,
  RenderMode,
  RpcConfiguration,
  BentleyCloudRpcManager,
  RpcOperation,
  IModelToken,
} from "@bentley/imodeljs-common/lib/common";
import { Transform, Point3d, XAndY } from "@bentley/geometry-core";
import { showStatus, showError } from "./Utils";
import { SimpleViewState } from "./SimpleViewState";
import { ProjectAbstraction } from "./ProjectAbstraction";
import { ConnectProject } from "./ConnectProject";
import { NonConnectProject } from "./NonConnectProject";
import * as ttjs from "tooltip.js";

type Tooltip = ttjs.default;

// Only want the following imports if we are using electron and not a browser -----
// tslint:disable-next-line:variable-name
let remote: any;
if (ElectronRpcConfiguration.isElectron) {
  // tslint:disable-next-line:no-var-requires
  remote = require("electron").remote;
}

// tslint:disable:no-console

interface RenderModeOptions {
  flags: Map<string, boolean>;
  mode: RenderMode;
}

const renderModeOptions: RenderModeOptions = {
  flags: new Map<string, boolean>(),
  mode: RenderMode.SmoothShade,
};

let activeViewState: SimpleViewState = new SimpleViewState();
const viewMap = new Map<string, ViewState | IModelConnection.ViewSpec>();
let theViewport: Viewport | undefined;
let curModelProps: ModelProps[] = [];
let curModelPropIndices: number[] = [];
let curNumModels = 0;
const curCategories: Set<string> = new Set<string>();
const configuration = {} as SVTConfiguration;
let curFPSIntervalId: NodeJS.Timer;

/** Parameters for starting SimpleViewTest with a specified initial configuration */
interface SVTConfiguration {
  useIModelBank: boolean;
  viewName?: string;
  environment?: DeploymentEnv;
  // standalone-specific config:
  standalone?: boolean;
  iModelName?: string;
  filename?: string;
  standalonePath?: string;    // Used when run in the browser - a common base path for all standalone imodels
}

// Retrieves the configuration for starting SVT from configuration.json file located in the built public folder
function retrieveConfiguration(): Promise<void> {
  return new Promise((resolve, _reject) => {
    const request: XMLHttpRequest = new XMLHttpRequest();
    request.open("GET", "configuration.json", false);
    request.setRequestHeader("Cache-Control", "no-cache");
    request.onreadystatechange = ((_event: Event) => {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          const newConfigurationInfo: any = JSON.parse(request.responseText);
          Object.assign(configuration, newConfigurationInfo);
          resolve();
        }
        // Everything is good, the response was received.
      } else {
        // Not ready yet.
      }
    });
    request.send();
  });
}

// opens the configured iModel from disk
async function openStandaloneIModel(state: SimpleViewState, filename: string) {
  configuration.standalone = true;
  state.iModelConnection = await IModelConnection.openStandalone(filename);
  configuration.iModelName = state.iModelConnection.name;
}

// selects the configured view.
async function buildViewList(state: SimpleViewState, configurations?: { viewName?: string }) {
  const config = undefined !== configurations ? configurations : {};
  const viewList = document.getElementById("viewList") as HTMLSelectElement;
  const viewQueryParams: ViewQueryParams = { wantPrivate: false };
  const viewSpecs: IModelConnection.ViewSpec[] = await state.iModelConnection!.views.getViewList(viewQueryParams);
  for (const viewSpec of viewSpecs) {
    const option = document.createElement("option");
    option.text = viewSpec.name;
    viewList.add(option);
    viewMap.set(viewSpec.name, viewSpec);
    if (undefined === config.viewName)
      config.viewName = viewSpec.name;
    if (viewSpec.name === config.viewName) {
      viewList!.value = viewSpec.name;
      const viewState = await state.iModelConnection!.views.load(viewSpec.id);
      viewMap.set(viewSpec.name, viewState);
      state.viewState = viewState;
    }
  }
}

// open up the model toggle menu
function startToggleModel(_event: any) {
  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

// open up the category selection model
function startCategorySelection(_event: any) {
  const menu = document.getElementById("categorySelectionMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

// build list of models; enables those defined in model selector
async function buildModelMenu(state: SimpleViewState) {
  const modelMenu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  const modelButton = document.getElementById("startToggleModel")!;
  const spatialView = undefined !== state.viewState && state.viewState instanceof SpatialViewState ? state.viewState as SpatialViewState : undefined;
  if (undefined === spatialView) {
    modelMenu.style.display = modelButton.style.display = "none";
    return;
  }

  modelButton.style.display = "inline";
  const modelQueryParams: ModelQueryParams = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
  curModelProps = await state.iModelConnection!.models.queryProps(modelQueryParams);
  curModelPropIndices = [];
  modelMenu.innerHTML = "";

  // ###TODO: Load models on demand when they are enabled in the dialog - not all up front like this...super-inefficient...
  let i = 0;
  for (const modelProp of curModelProps) {
    const model = spatialView.iModel.models.getLoaded(modelProp.id!.toString());
    if (undefined === model)
      await spatialView.iModel.models.load(modelProp.id!.toString());

    modelMenu.innerHTML += '<input id="cbxModel' + i + '" type="checkbox"> ' + modelProp.name + "\n<br>\n";
    curModelPropIndices.push(i);
    i++;
  }

  curNumModels = i;
  for (let c = 0; c < curNumModels; c++) {
    const cbxName = "cbxModel" + c;
    const enabled = spatialView.modelSelector.has(curModelProps[c].id!.toString());
    updateCheckboxToggleState(cbxName, enabled);
    addModelToggleHandler(cbxName);
  }

  applyModelToggleChange("cbxModel0"); // force view to update based on all being enabled
}

// build list of categories; enable those defined in category selector
async function buildCategoryMenu(state: SimpleViewState) {
  curCategories.clear();
  let html = '<input id="cbxCatToggleAll" type="checkbox"> Toggle All\n<br>\n';

  const view = state.viewState!;
  const ecsql = "SELECT ECInstanceId as id, CodeValue as code, UserLabel as label FROM " + (view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory");
  const rows = await view.iModel.executeQuery(ecsql);

  for (const row of rows) {
    let label = row.label as string;
    if (undefined === label)
      label = row.code;

    const id = row.id as string;
    curCategories.add(id);
    html += '<input id="cbxCat' + id + '" type="checkbox"> ' + label + "\n<br>\n";
  }

  const categoryMenu = document.getElementById("categorySelectionMenu") as HTMLDivElement;
  categoryMenu.innerHTML = html;

  updateCheckboxToggleState("cbxCatToggleAll", curCategories.size === view.categorySelector.categories.size);
  addCategoryToggleAllHandler();

  for (const cat of curCategories) {
    const cbxName = "cbxCat" + cat;
    updateCheckboxToggleState(cbxName, view.categorySelector.has(cat));
    addCategoryToggleHandler(cbxName);
  }
}

// set checkbox state to checked or unchecked
function updateCheckboxToggleState(id: string, enabled: boolean) {
  (document.getElementById(id)! as HTMLInputElement).checked = enabled;
}

// query checkbox state (checked or unchecked)
function getCheckboxToggleState(id: string): boolean {
  return (document.getElementById(id)! as HTMLInputElement).checked;
}

// apply a model checkbox state being changed (actually change list of viewed models)
function applyModelToggleChange(_cbxModel: string) {
  if (!(theViewport!.view instanceof SpatialViewState))
    return;
  const view = theViewport!.view as SpatialViewState;

  view.clearViewedModels();

  for (let c = 0; c < curNumModels; c++) {
    const cbxName = "cbxModel" + c;
    const isChecked = getCheckboxToggleState(cbxName);
    if (isChecked)
      view.addViewedModel(curModelProps[curModelPropIndices[c]].id!);
  }

  theViewport!.sync.invalidateScene();

  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
}

function toggleCategoryState(invis: boolean, catId: string, view: ViewState) {
  view.changeCategoryDisplay(catId, !invis);
}

// apply a category checkbox state being changed
function applyCategoryToggleChange(_cbxCategory: string) {
  const view = theViewport!.view;

  let allToggledOn = true;
  for (const cat of curCategories) {
    const cbxName = "cbxCat" + cat;
    const isChecked = getCheckboxToggleState(cbxName);
    const invis = isChecked ? false : true;
    toggleCategoryState(invis, cat, view);
    if (invis)
      allToggledOn = false;
  }

  updateCheckboxToggleState("cbxCatToggleAll", allToggledOn);

  const menu = document.getElementById("categorySelectionMenu") as HTMLDivElement;
  menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
}

// toggle all checkboxes being toggled
function applyCategoryToggleAllChange() {
  const view = theViewport!.view;
  const isChecked = getCheckboxToggleState("cbxCatToggleAll");

  for (const cat of curCategories) {
    const cbxName = "cbxCat" + cat;
    updateCheckboxToggleState(cbxName, isChecked);

    const invis = isChecked ? false : true;
    toggleCategoryState(invis, cat, view);
  }

  const menu = document.getElementById("categorySelectionMenu") as HTMLDivElement;
  menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
}

// add a click handler to model checkbox
function addModelToggleHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyModelToggleChange(id));
}

// add a click handler to category checkbox
function addCategoryToggleHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyCategoryToggleChange(id));
}

// add a click handler to the category 'toggle all' checkbox
function addCategoryToggleAllHandler() {
  document.getElementById("cbxCatToggleAll")!.addEventListener("click", () => applyCategoryToggleAllChange());
}

function toggleStandardViewMenu(_event: any) {
  const menu = document.getElementById("standardRotationMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function toggleRenderModeMenu(_event: any) {
  const menu = document.getElementById("changeRenderModeMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function toggleSnapModeMenu(_event: any) {
  const menu = document.getElementById("changeSnapModeMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function applyStandardViewRotation(rotationId: StandardViewId, label: string) {
  if (undefined === theViewport)
    return;

  const startFrustum = theViewport.getFrustum();
  const newFrustum = startFrustum.clone();
  const rotatePoint = theViewport.determineDefaultRotatePoint();
  const rMatrix = AccuDraw.getStandardRotation(rotationId, theViewport, theViewport.isContextRotationRequired());
  const viewTransform = Transform.createFixedPointAndMatrix(rotatePoint, theViewport.rotMatrix);
  newFrustum.multiply(viewTransform);

  let rotateTransform: Transform | undefined = Transform.createFixedPointAndMatrix(rotatePoint, rMatrix);
  rotateTransform = rotateTransform.inverse();
  if (!rotateTransform)
    return;

  newFrustum.multiply(rotateTransform);

  theViewport.animateFrustumChange(startFrustum, newFrustum);
  theViewport.synchWithView(true);
  showStatus(label, "view");
}

function applyRenderModeChange(mode: string) {
  const menuDialog = document.getElementById("changeRenderModeMenu");
  const newValue = (document.getElementById(mode)! as HTMLInputElement).checked;
  renderModeOptions.flags.set(mode, newValue);
  IModelApp.tools.run("View.ChangeRenderMode", theViewport!, renderModeOptions.flags, menuDialog, renderModeOptions.mode);
}

function stringToRenderMode(name: string): RenderMode {
  switch (name) {
    case "Smooth Shade": return RenderMode.SmoothShade;
    case "Solid Fill": return RenderMode.SolidFill;
    case "Hidden Line": return RenderMode.HiddenLine;
    default: return RenderMode.Wireframe;
  }
}

function renderModeToString(mode: RenderMode): string {
  switch (mode) {
    case RenderMode.SmoothShade: return "Smooth Shade";
    case RenderMode.SolidFill: return "Solid Fill";
    case RenderMode.HiddenLine: return "Hidden Line";
    default: return "Wireframe";
  }
}

function changeRenderMode(): void {
  const select = (document.getElementById("renderModeList") as HTMLSelectElement)!;
  renderModeOptions.mode = stringToRenderMode(select.value);
  IModelApp.tools.run("View.ChangeRenderMode", theViewport!, renderModeOptions.flags, document.getElementById("changeRenderModeMenu"), renderModeOptions.mode);
}

function updateRenderModeOption(id: string, enabled: boolean, options: Map<string, boolean>) {
  (document.getElementById(id)! as HTMLInputElement).checked = enabled;
  options.set(id, enabled);
}

// updates the checkboxes and the map for turning off and on rendering options to match what the current view is showing
function updateRenderModeOptionsMap() {
  let skybox = false;
  let groundplane = false;
  if (theViewport!.view.is3d()) {
    const view = theViewport!.view as ViewState3d;
    const env = view.getDisplayStyle3d().getEnvironment();
    skybox = env.sky.display;
    groundplane = env.ground.display;
  }

  const viewflags = theViewport!.view.viewFlags;
  const lights = viewflags.showSourceLights() || viewflags.showSolarLight() || viewflags.showCameraLights();

  updateRenderModeOption("skybox", skybox, renderModeOptions.flags);
  updateRenderModeOption("groundplane", groundplane, renderModeOptions.flags);
  updateRenderModeOption("ACSTriad", viewflags.showAcsTriad(), renderModeOptions.flags);
  updateRenderModeOption("fill", viewflags.showFill(), renderModeOptions.flags);
  updateRenderModeOption("grid", viewflags.showGrid(), renderModeOptions.flags);
  updateRenderModeOption("textures", viewflags.showTextures(), renderModeOptions.flags);
  updateRenderModeOption("visibleEdges", viewflags.showVisibleEdges(), renderModeOptions.flags);
  updateRenderModeOption("hiddenEdges", viewflags.showHiddenEdges(), renderModeOptions.flags);
  updateRenderModeOption("materials", viewflags.showMaterials(), renderModeOptions.flags);
  updateRenderModeOption("lights", lights, renderModeOptions.flags);
  updateRenderModeOption("monochrome", viewflags.isMonochrome(), renderModeOptions.flags);
  updateRenderModeOption("constructions", viewflags.showConstructions(), renderModeOptions.flags);
  updateRenderModeOption("weights", viewflags.showWeights(), renderModeOptions.flags);
  updateRenderModeOption("styles", viewflags.showStyles(), renderModeOptions.flags);
  updateRenderModeOption("transparency", viewflags.showTransparency(), renderModeOptions.flags);

  renderModeOptions.mode = viewflags.getRenderMode();
  (document.getElementById("renderModeList") as HTMLSelectElement)!.value = renderModeToString(viewflags.getRenderMode());
}

// opens the view and connects it to the HTML canvas element.
async function openView(state: SimpleViewState) {
  // find the canvas.
  const htmlCanvas: HTMLCanvasElement = document.getElementById("imodelview") as HTMLCanvasElement;
  if (htmlCanvas) {
    theViewport = new Viewport(htmlCanvas, state.viewState!);
    await _changeView(state.viewState!);
    theViewport.continuousRendering = (document.getElementById("continuousRendering")! as HTMLInputElement).checked;
    IModelApp.viewManager.addViewport(theViewport);
  }
}

async function _changeView(view: ViewState) {
  await theViewport!.changeView(view);
  activeViewState.viewState = view;
  await buildModelMenu(activeViewState);
  await buildCategoryMenu(activeViewState);
  updateRenderModeOptionsMap();
}

export class MeasurePointsTool extends PrimitiveTool {
  public static toolId = "Measure.Points";
  public readonly points: Point3d[] = [];

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); IModelApp.accuSnap.enableSnap(true); }

  public onRestartTool(): void {
    this.exitTool();
  }
}

// starts Mesure between points tool
function startMeasurePoints(_event: any) {
  IModelApp.tools.run("Measure.Points", theViewport!);
}

// functions that start viewing commands, associated with icons in wireIconsToFunctions
function startToggleCamera(_event: any) {
  IModelApp.tools.run("View.ToggleCamera", theViewport!);
}

function startFit(_event: any) {
  IModelApp.tools.run("View.Fit", theViewport!, true);
}

// starts Window Area
function startWindowArea(_event: any) {
  IModelApp.tools.run("View.WindowArea", theViewport!);
}

// starts element selection tool
function startSelect(_event: any) {
  IModelApp.tools.run("Select");
}

// starts walk command
function startWalk(_event: any) {
  IModelApp.tools.run("View.Walk", theViewport!);
}

// start rotate view.
function startRotateView(_event: any) {
  IModelApp.tools.run("View.Rotate", theViewport!);
}

// change active view.
async function changeView(event: any) {
  const spinner = document.getElementById("spinner") as HTMLDivElement;
  spinner.style.display = "block";
  const viewName = event.target.selectedOptions["0"].label;
  let view = viewMap.get(viewName);
  if (!(view instanceof ViewState)) {
    view = await activeViewState.iModelConnection!.views.load((view as IModelConnection.ViewSpec).id);
    viewMap.set(viewName, view);
  }
  await _changeView(view.clone());
  spinner.style.display = "none";
}

async function clearViews() {
  if (activeViewState.iModelConnection !== undefined)
    if (configuration.standalone)
      await activeViewState.iModelConnection.closeStandalone();
    else
      await activeViewState.iModelConnection!.close(activeViewState.accessToken!);
  activeViewState = new SimpleViewState();
  viewMap.clear();
  document.getElementById("viewList")!.innerHTML = "";
}

async function resetStandaloneIModel(filename: string) {
  const spinner = document.getElementById("spinner") as HTMLDivElement;

  spinner.style.display = "block";
  IModelApp.viewManager.dropViewport(theViewport!);
  await clearViews();
  await openStandaloneIModel(activeViewState, filename);
  await buildViewList(activeViewState);
  await openView(activeViewState);
  spinner.style.display = "none";
}

async function selectIModel() {
  if (ElectronRpcConfiguration.isElectron) {  // Electron
    const options = {
      properties: ["openFile"],
      filters: [{ name: "IModels", extensions: ["ibim", "bim"] }],
    };
    remote.dialog.showOpenDialog(options, async (filePaths?: string[]) => {
      if (undefined !== filePaths)
        await resetStandaloneIModel(filePaths[0]);
    });
  } else {  // Browser
    if (configuration.standalonePath === undefined || !document.createEvent) { // Do not have standalone path for files or support for document.createEvent... request full file path
      const filePath = prompt("Enter the full local path of the iModel you wish to open:");
      if (filePath !== null) {
        try {
          await resetStandaloneIModel(filePath);
        } catch {
          alert("Error - The file path given is invalid.");
          const spinner = document.getElementById("spinner") as HTMLDivElement;
          spinner.style.display = "none";
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

// undo prev view manipulation
function doUndo(_event: any) {
  IModelApp.tools.run("View.Undo", theViewport!);
}

// redo view manipulation
function doRedo(_event: any) {
  IModelApp.tools.run("View.Redo", theViewport!);
}

function setFpsInfo() {
  const perfMet = (theViewport!.target as Target).performanceMetrics;
  if (document.getElementById("showfps")) document.getElementById("showfps")!.innerHTML =
    "Avg. FPS: " + (perfMet.spfTimes.length / perfMet.spfSum).toFixed(2)
    + " Render Time (ms): " + (perfMet.renderSpfSum / perfMet.renderSpfTimes.length).toFixed(2)
    + "<br />Scene Time (ms): " + (perfMet.loadTileSum / perfMet.loadTileTimes.length).toFixed(2);
}

function addRenderModeHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyRenderModeChange(id));
}

// associate viewing commands to icons. I couldn't get assigning these in the HTML to work.
function wireIconsToFunctions() {
  document.getElementById("selectIModel")!.addEventListener("click", selectIModel);
  document.getElementById("viewList")!.addEventListener("change", changeView);
  document.getElementById("startToggleModel")!.addEventListener("click", startToggleModel);
  document.getElementById("startCategorySelection")!.addEventListener("click", startCategorySelection);
  document.getElementById("startToggleCamera")!.addEventListener("click", startToggleCamera);
  document.getElementById("startFit")!.addEventListener("click", startFit);
  document.getElementById("startWindowArea")!.addEventListener("click", startWindowArea);
  document.getElementById("startSelect")!.addEventListener("click", startSelect);
  document.getElementById("startMeasurePoints")!.addEventListener("click", startMeasurePoints);
  document.getElementById("startWalk")!.addEventListener("click", startWalk);
  document.getElementById("startRotateView")!.addEventListener("click", startRotateView);
  document.getElementById("switchStandardRotation")!.addEventListener("click", toggleStandardViewMenu);
  document.getElementById("renderModeToggle")!.addEventListener("click", toggleRenderModeMenu);
  document.getElementById("snapModeToggle")!.addEventListener("click", toggleSnapModeMenu);
  document.getElementById("doUndo")!.addEventListener("click", doUndo);
  document.getElementById("doRedo")!.addEventListener("click", doRedo);

  // standard view rotation handlers
  document.getElementById("top")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Top, "Top"));
  document.getElementById("bottom")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Bottom, "Bottom"));
  document.getElementById("left")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Left, "Left"));
  document.getElementById("right")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Right, "Right"));
  document.getElementById("front")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Front, "Front"));
  document.getElementById("back")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Back, "Back"));
  document.getElementById("iso")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.Iso, "Iso"));
  document.getElementById("rightIso")!.addEventListener("click", () => applyStandardViewRotation(StandardViewId.RightIso, "RightIso"));

  // render mode handlers
  addRenderModeHandler("skybox");
  addRenderModeHandler("groundplane");
  addRenderModeHandler("ACSTriad");
  addRenderModeHandler("fill");
  addRenderModeHandler("grid");
  addRenderModeHandler("textures");
  addRenderModeHandler("visibleEdges");
  addRenderModeHandler("hiddenEdges");
  addRenderModeHandler("materials");
  addRenderModeHandler("lights");
  addRenderModeHandler("monochrome");
  addRenderModeHandler("constructions");
  addRenderModeHandler("weights");
  addRenderModeHandler("styles");
  addRenderModeHandler("transparency");
  document.getElementById("continuousRendering")!.addEventListener("click", () => {
    const checked: boolean = (document.getElementById("continuousRendering")! as HTMLInputElement).checked;
    if (theViewport)
      theViewport!.continuousRendering = checked;
    if (checked) {
      curFPSIntervalId = setInterval(setFpsInfo, 500);
      document.getElementById("showfps")!.style.display = "inline";
    } else {
      document.getElementById("showfps")!.style.display = "none";
      clearInterval(curFPSIntervalId);
    }
  });
  document.getElementById("renderModeList")!.addEventListener("change", () => changeRenderMode());

  // File Selector for the browser (a change represents a file selection)... only used when in browser and given base path for local files
  document.getElementById("browserFileSelector")!.addEventListener("change", async function onChange(this: HTMLElement) {
    const files = (this as any).files;
    if (files !== undefined && files.length > 0) {
      try {
        await resetStandaloneIModel(configuration.standalonePath + "/" + files[0].name);
      } catch {
        alert("Error Opening iModel - Make you are selecting files from " + configuration.standalonePath);
        const spinner = document.getElementById("spinner") as HTMLDivElement;
        spinner.style.display = "none";
      }
    }
  });
}

// If we are using a browser, close the current iModel before leaving
window.onbeforeunload = () => {
  if (activeViewState.iModelConnection !== undefined)
    if (configuration.standalone)
      activeViewState.iModelConnection.closeStandalone();
    else
      activeViewState.iModelConnection.close(activeViewState.accessToken!);
};

function stringToSnapMode(name: string): SnapMode {
  switch (name) {
    case "Keypoint": return SnapMode.NearestKeypoint;
    case "Nearest": return SnapMode.Nearest;
    case "Center": return SnapMode.Center;
    case "Origin": return SnapMode.Origin;
    case "Intersection": return SnapMode.Intersection;
    default: return SnapMode.NearestKeypoint;
  }
}

class SVTAccuSnap extends AccuSnap {
  public getActiveSnapModes(): SnapMode[] {
    const select = (document.getElementById("snapModeList") as HTMLSelectElement)!;
    const snapMode = stringToSnapMode(select.value);
    const snaps: SnapMode[] = [];
    snaps.push(snapMode);
    return snaps;
  }
}

class SVTNotifications extends NotificationManager {
  private toolTip?: Tooltip;

  public outputPrompt(prompt: string) { showStatus(prompt); }

  /** Output a message and/or alert to the user. */
  public outputMessage(message: NotifyMessageDetails) { showError(message.briefMessage); }

  public isToolTipOpen(): boolean { return !!this.toolTip && this.toolTip._isOpen; }
  public clearToolTip(): void {
    if (this.isToolTipOpen())
      this.toolTip!.hide();
  }
  public showToolTip(el: HTMLElement, message: string, pt?: XAndY, _options?: ToolTipOptions): void {
    this.clearToolTip();

    const position = document.getElementById("tooltip-location");
    if (!position)
      return;

    if (!this.toolTip)
      this.toolTip = new ttjs.default(position, { trigger: "manual", html: true, placement: "auto", offset: 10 });

    this.toolTip!.updateTitleContent(message);

    const rect = el.getBoundingClientRect();
    if (undefined === pt) {
      pt = { x: rect.width / 2, y: rect.height / 2 };
    }
    const height = 20; // parseInt(position.style.height!, 10) / 2;
    const width = 20; // parseInt(position.style.width!, 10) / 2;
    position.style.top = (pt.y + rect.top - height / 2) + "px";
    position.style.left = (pt.x + rect.left - width / 2) + "px";
    position.style.width = width + "px";
    position.style.height = height + "px";

    this.toolTip!.show();
  }
}

class SVTIModelApp extends IModelApp {
  protected static onStartup(): void {
    IModelApp.accuSnap = new SVTAccuSnap();
    IModelApp.notifications = new SVTNotifications();
    const svtToolNamespace = IModelApp.i18n.registerNamespace("SVTTools");
    MeasurePointsTool.register(svtToolNamespace);
  }
}

const docReady = new Promise((resolve) => {
  window.addEventListener("DOMContentLoaded", () => {
    resolve();
  });
});

// main entry point.
async function main() {
  // retrieve, set, and output the global configuration variable
  await retrieveConfiguration(); // (does a fetch)
  console.log("Configuration", JSON.stringify(configuration));

  // Start the app. (This tries to fetch a number of localization json files from the orgin.)
  SVTIModelApp.startup();

  // Choose RpcConfiguration based on whether we are in electron or browser
  let rpcConfiguration: RpcConfiguration;
  if (ElectronRpcConfiguration.isElectron) {
    rpcConfiguration = ElectronRpcManager.initializeClient({}, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
  } else {
    rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "SimpleViewApp", version: "v1.0" } }, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
    Config.devCorsProxyServer = "https://localhost:3001";
  }

  // WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request. ECPresentation initialization tries to set active locale using
  // RPC without any imodel and fails...
  for (const definition of rpcConfiguration.interfaces())
    RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test"));

  const uiReady = displayUi();  // Get the browser started loading our html page and the svgs that it references but DON'T WAIT

  // while the browser is loading stuff, start work on logging in and downloading the imodel, etc.
  try {
    if (configuration.standalone) {
      await openStandaloneIModel(activeViewState, configuration.iModelName!);
    } else {
      IModelApp.hubDeploymentEnv = configuration.environment || "QA";
      const projectMgr: ProjectAbstraction = configuration.useIModelBank ? new NonConnectProject() : new ConnectProject();
      await projectMgr.loginAndOpenImodel(activeViewState);
    }

  } catch (reason) {
    alert(reason);
    return;
  }

  console.log("This is from frontend/main");

  await uiReady; // Now wait for the HTML UI to finish loading.

  // Now we have both the UI and the iModel.

  // open the specified view
  showStatus("opening View", configuration.viewName);
  await buildViewList(activeViewState, configuration);

  showStatus("View Ready");
  hideSpinner();

  // now connect the view to the canvas
  await openView(activeViewState);
}

// Set up the HTML UI elements and wire them to our functions
async function displayUi() {
  return new Promise(async (resolve) => {
    await docReady; // We must wait for the document to be in place.
    showSpinner();
    wireIconsToFunctions();
    resolve();
  });
}

function showSpinner() {
  const spinner = document.getElementById("spinner") as HTMLElement;
  spinner.style.display = "block";
}

function hideSpinner() {
  const spinner = document.getElementById("spinner");
  if (spinner)
    spinner.style.display = "none";
}

// Entry point - run the main function
main();
