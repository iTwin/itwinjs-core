import { IModelApp, IModelConnection, ViewState, Viewport, ViewRect, ViewTool, BeButtonEvent, DecorateContext, StandardViewId, ViewState3d, SpatialViewState } from "@bentley/imodeljs-frontend";
import { Pixel } from "@bentley/imodeljs-frontend/lib/rendering";
import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AccessToken, AuthorizationToken, Project, IModel } from "@bentley/imodeljs-clients";
import { ElectronRpcManager, ElectronRpcConfiguration, StandaloneIModelRpcInterface, IModelTileRpcInterface, IModelReadRpcInterface, ViewQueryParams, ViewDefinitionProps, ColorDef, ModelProps, ModelQueryParams, RenderMode } from "@bentley/imodeljs-common";
import { Point3d } from "@bentley/geometry-core";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelApi } from "./IModelApi";
import { ProjectApi, ProjectScope } from "./ProjectApi";
import { remote } from "electron";

// tslint:disable:no-console

// show status in the output HTML
function showStatus(string1: string, string2?: string) {
  let outString: string = string1;
  if (string2)
    outString = outString.concat(" ", string2);
  document.getElementById("showstatus")!.innerHTML = outString;
}

class SimpleViewState {
  public accessToken?: AccessToken;
  public project?: Project;
  public iModel?: IModel;
  public iModelConnection?: IModelConnection;
  public viewDefinition?: ViewDefinitionProps;
  public viewState?: ViewState;
  public viewPort?: Viewport;
  constructor() { }
}

interface RenderModeOptions {
  flags: Map<string, boolean>;
  mode: RenderMode;
}

const renderModeOptions: RenderModeOptions = {
  flags: new Map<string, boolean>(),
  mode: RenderMode.SmoothShade,
};

let activeViewState: SimpleViewState = new SimpleViewState();
const viewMap = new Map<string, ViewState>();
let theViewport: Viewport | undefined;
let curModelProps: ModelProps[] = [];
let curModelPropIndices: number[] = [];
let curNumModels = 0;

// Entry point - run the main function
main();

// retrieves configuration.json from the Public folder, and override configuration values from that.
// see configuration.json in simpleviewtest/public.
// alternatively, can open a standalone iModel from disk by setting iModelName to filename and standalone to true.
function retrieveConfigurationOverrides(configuration: any) {
  const request: XMLHttpRequest = new XMLHttpRequest();
  request.open("GET", "configuration.json", false);
  request.setRequestHeader("Cache-Control", "no-cache");
  request.onreadystatechange = ((_event: Event) => {
    if (request.readyState === XMLHttpRequest.DONE) {
      if (request.status === 200) {
        const newConfigurationInfo: any = JSON.parse(request.responseText);
        Object.assign(configuration, newConfigurationInfo);
      }
      // Everything is good, the response was received.
    } else {
      // Not ready yet.
    }
  });
  request.send();
}

// Apply environment overrides to configuration.
// This allows us to switch data sets without constantly editing configuration.json (and having to rebuild afterward).
function applyConfigurationOverrides(config: any): void {
  const filename = remote.process.env.SVT_STANDALONE_FILENAME;
  if (undefined !== filename) {
    config.iModelName = filename;
    config.viewName = remote.process.env.SVT_STANDALONE_VIEWNAME; // optional
    config.standalone = true;
  }
}

// log in to connect
async function loginToConnect(state: SimpleViewState, userName: string, password: string) {
  // tslint:disable-next-line:no-console
  console.log("Attempting login with userName", userName, "password", password);

  const authClient = new ImsActiveSecureTokenClient("QA");
  const accessClient = new ImsDelegationSecureTokenClient("QA");

  const authToken: AuthorizationToken = await authClient.getToken(userName, password);
  state.accessToken = await accessClient.getToken(authToken);
}

// opens the configured project
async function openProject(state: SimpleViewState, projectName: string) {
  state.project = await ProjectApi.getProjectByName(state.accessToken!, ProjectScope.Invited, projectName);
}

// opens the configured iModel
async function openIModel(state: SimpleViewState, iModelName: string) {
  state.iModel = await IModelApi.getIModelByName(state.accessToken!, state.project!.wsgId, iModelName);
  state.iModelConnection = await IModelApi.openIModel(state.accessToken!, state.project!.wsgId, state.iModel!.wsgId, undefined, OpenMode.Readonly);
}

// opens the configured iModel from disk
async function openStandaloneIModel(state: SimpleViewState, filename: string) {
  state.iModelConnection = await IModelConnection.openStandalone(filename);
}

// selects the configured view.
async function buildViewList(state: SimpleViewState, configurations?: { viewName?: string }) {
  const config = undefined !== configurations ? configurations : {};
  const viewList = document.getElementById("viewList") as HTMLSelectElement;
  const viewQueryParams: ViewQueryParams = { wantPrivate: false };
  const viewProps: ViewDefinitionProps[] = await state.iModelConnection!.views.queryProps(viewQueryParams);
  for (const viewProp of viewProps) {
    // look for view of the expected name.
    if (viewProp.code && viewProp.id) {
      const option = document.createElement("option");
      option.text = viewProp.code.value!;
      viewList.add(option);
      const viewState = await state.iModelConnection!.views.load(viewProp.id);
      viewMap.set(viewProp.code.value!, viewState);
      if (undefined === config.viewName)
        config.viewName = viewProp.code.value!;
      if (viewProp.code.value === config.viewName) {
        viewList!.value = viewProp.code.value;
        state.viewState = viewState;
      }
    }
  }
}

// open up the model toggle menu
function startToggleModel(_event: any) {
  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

// build list of  models; enables them all
async function buildModelMenu(state: SimpleViewState) {
  const modelMenu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  const modelQueryParams: ModelQueryParams = { wantPrivate: false };
  curModelProps = await state.iModelConnection!.models.queryProps(modelQueryParams);
  curModelPropIndices = [];
  modelMenu.innerHTML = "";
  let i = 0, p = 0;
  for (const modelProp of curModelProps) {
    if (modelProp.name && modelProp.id && modelProp.classFullName === "BisCore:PhysicalModel") {
      modelMenu.innerHTML += '<input id="cbxModel' + i + '" type="checkbox"> ' + modelProp.name + "\n<br>\n";
      curModelPropIndices.push(p);
      i++;
    }
    p++;
  }

  curNumModels = i;
  for (let c = 0; c < curNumModels; c++) {
    const cbxName = "cbxModel" + c;
    updateModelToggleState(cbxName, true);
    addModelToggleHandler(cbxName);
  }

  applyModelToggleChange("cbxModel0"); // force view to update based on all being enabled
}

// set model checkbox state to checked or unchecked
function updateModelToggleState(id: string, enabled: boolean) {
  (document.getElementById(id)! as HTMLInputElement).checked = enabled;
}

// query model checkbox state (checked or unchecked)
function getModelToggleState(id: string): boolean {
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
    const isChecked = getModelToggleState(cbxName);
    if (isChecked)
      view.addViewedModel(curModelProps[curModelPropIndices[c]].id!);
  }

  theViewport!.sync.invalidateScene();

  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
}

// add a click handler to model checkbox
function addModelToggleHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyModelToggleChange(id));
}

export class LocateTool extends ViewTool {
  public static toolId = "View.Locate";

  private _curPoint = new Point3d();
  private _worldPoint = new Point3d();
  private _haveWorldPoint = false;
  private _pixelColor: ColorDef = ColorDef.black.clone();

  public constructor() { super(); }

  public updateDynamics(ev: BeButtonEvent) { this.onModelMotion(ev); }
  public onModelMotion(ev: BeButtonEvent) {
    this._curPoint.setFrom(ev.point);

    if (ev.viewport)
      ev.viewport.invalidateDecorations();
  }

  public onDataButtonDown(ev: BeButtonEvent) {
    this._worldPoint.setFrom(ev.point);
    this._haveWorldPoint = true;
    if (ev.viewport) {
      ev.viewport.invalidateDecorations();

      const rect = new ViewRect(ev.viewPoint.x, ev.viewPoint.y, ev.viewPoint.x + 1, ev.viewPoint.y + 1);
      const pixels = ev.viewport.readPixels(rect, Pixel.Selector.All);
      if (undefined === pixels) {
        this._pixelColor = ColorDef.black.clone();
        showStatus("No pixel data");
      } else {
        const pixel = pixels.getPixel(ev.viewPoint.x, ev.viewPoint.y);
        const red = pixel.type * (255.0 / 6.0);
        const green = pixel.planarity * (255.0 / 4.0);
        const blue = Math.max(pixel.distanceFraction, 0.0) * 255.0;
        this._pixelColor = ColorDef.from(red, green, blue);
        showStatus("Pixel: " + LocateTool._planarity[pixel.planarity], LocateTool._type[pixel.type] + " " + pixel.elementId + " " + pixel.distanceFraction);
      }
    }
  }

  public decorate(context: DecorateContext) {
    context.viewport.drawLocateCursor(context, this._curPoint, context.viewport.pixelsFromInches(IModelApp.locateManager.getApertureInches()), true);
    if (this._haveWorldPoint) {
      const gf = context.createWorldOverlay();
      gf.setSymbology(this._pixelColor, this._pixelColor, 10);
      // gf.addPointString([this._worldPoint]);
      // context.addWorldOverlay(gf.finish()!);
      const pt = context.viewport.worldToView(this._worldPoint);
      gf.addPointString([pt]);
      context.addViewOverlay(gf.finish()!);
    }
  }

  private static _planarity = ["unknown", "none", "planar", "non-planar"];
  private static _type = ["unknown", "none", "surface", "linear", "edge", "silhouette"];
}

function toggleStandardViewMenu(_event: any) {
  const menu = document.getElementById("standardRotationMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function toggleRenderModeMenu(_event: any) {
  const menu = document.getElementById("changeRenderModeMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function applyStandardViewRotation(rotationId: StandardViewId, label: string) {
  theViewport!.setStandardRotation(rotationId);
  IModelApp.tools.run("View.Fit", theViewport!, false, false);
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
    case "Smooth Shade":  return RenderMode.SmoothShade;
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
    const target = IModelApp.renderSystem.createTarget(htmlCanvas);
    theViewport = new Viewport(htmlCanvas, state.viewState!, target);
    await _changeView(state.viewState!);
    IModelApp.viewManager.addViewport(theViewport);
    updateRenderModeOptionsMap();
  }
}

async function _changeView(view: ViewState) {
  await theViewport!.changeView(view);
  buildModelMenu(activeViewState);
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
  // ###TODO: SelectTool is busted in various ways...use LocateTool for demo.
  // IModelApp.tools.run("Select");
  IModelApp.tools.run("View.Locate", theViewport!);
}

// starts walk command
function startWalk(_event: any) {
  IModelApp.tools.run("View.Walk", theViewport!);
}

// start rotate view.
function startRotateView(_event: any) {
  IModelApp.tools.run("View.Rotate", theViewport!);
}

// start rotate view.
function changeView(event: any) {
  const viewName = event.target.selectedOptions["0"].label;
  _changeView(viewMap.get(viewName)!);
}

async function clearViews() {
  await activeViewState.iModelConnection!.closeStandalone();
  activeViewState = new SimpleViewState();
  viewMap.clear();
  document.getElementById("viewList")!.innerHTML = "";
}

async function resetStandaloneIModel(filename: string) {
  const spinner = document.getElementById("spinner") as HTMLDivElement;
  spinner.style.display = "block";
  IModelApp.viewManager.dropViewport(theViewport!);
  IModelApp.renderSystem.onShutDown();
  await clearViews();
  await openStandaloneIModel(activeViewState, filename);
  await buildViewList(activeViewState);
  await openView(activeViewState);
  spinner.style.display = "none";
}

function selectIModel(): void {
  const options: Electron.OpenDialogOptions = {
    properties: ["openFile"],
    filters: [{ name: "IModels", extensions: ["ibim", "bim"] }],
  };
  remote.dialog.showOpenDialog(options, async (filePaths?: string[]) => {
    if (undefined !== filePaths)
      await resetStandaloneIModel(filePaths[0]);
  });
}

// undo prev view manipulation
function doUndo(_event: any) {
  IModelApp.tools.run("View.Undo", theViewport!);
}

// redo view manipulation
function doRedo(_event: any) {
  IModelApp.tools.run("View.Redo", theViewport!);
}

function addRenderModeHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyRenderModeChange(id));
}

// associate viewing commands to icons. I couldn't get assigning these in the HTML to work.
function wireIconsToFunctions() {
  document.getElementById("selectIModel")!.addEventListener("click", selectIModel);
  document.getElementById("viewList")!.addEventListener("change", changeView);
  document.getElementById("startToggleModel")!.addEventListener("click", startToggleModel);
  document.getElementById("startToggleCamera")!.addEventListener("click", startToggleCamera);
  document.getElementById("startFit")!.addEventListener("click", startFit);
  document.getElementById("startWindowArea")!.addEventListener("click", startWindowArea);
  document.getElementById("startZoom")!.addEventListener("click", startSelect);
  document.getElementById("startWalk")!.addEventListener("click", startWalk);
  document.getElementById("startRotateView")!.addEventListener("click", startRotateView);
  document.getElementById("switchStandardRotation")!.addEventListener("click", toggleStandardViewMenu);
  document.getElementById("renderModeToggle")!.addEventListener("click", toggleRenderModeMenu);
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

  document.getElementById("renderModeList")!.addEventListener("change", () => changeRenderMode());
}

// ----------------------------------------------------------
// main entry point.
async function main() {
  // this is the default configuration
  const configuration: any = {
    userName: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
    projectName: "plant-sta",
    iModelName: "NabeelQATestiModel",
  };

  // override anything that's in the configuration
  retrieveConfigurationOverrides(configuration);
  applyConfigurationOverrides(configuration);
  console.log("Configuration", JSON.stringify(configuration));

  // start the app.
  IModelApp.startup("QA", true);

  if (ElectronRpcConfiguration.isElectron)
    ElectronRpcManager.initializeClient({}, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);

  const spinner = document.getElementById("spinner") as HTMLDivElement;
  spinner.style.display = "block";

  try {
    // initialize the Project and IModel Api
    await ProjectApi.init();
    await IModelApi.init();

    IModelApp.tools.register(LocateTool);

    if (!configuration.standalone) {
      // log in.
      showStatus("logging in as", configuration.userName);
      await loginToConnect(activeViewState, configuration.userName, configuration.password);

      // open the specified project
      showStatus("opening Project", configuration.projectName);
      await openProject(activeViewState, configuration.projectName);

      // open the specified iModel
      showStatus("opening iModel", configuration.iModelName);
      await openIModel(activeViewState, configuration.iModelName);
    } else {
      showStatus("Opening", configuration.iModelName);
      await openStandaloneIModel(activeViewState, configuration.iModelName);
    }

    // open the specified view
    showStatus("opening View", configuration.viewName);
    await buildViewList(activeViewState, configuration);

    // now connect the view to the canvas
    await openView(activeViewState);

    showStatus("View Ready");
  } catch (reason) {
    alert(reason);
    return;
  }

  spinner.style.display = "none";

  wireIconsToFunctions();
  console.log("This is from frontend/main");
}
