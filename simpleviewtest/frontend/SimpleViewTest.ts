import { IModelApp, IModelConnection, ViewState, Viewport, ViewTool, BeButtonEvent, DecorateContext, StandardViewId } from "@bentley/imodeljs-frontend";
import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AccessToken, AuthorizationToken, Project, IModel } from "@bentley/imodeljs-clients";
import { ElectronRpcManager, ElectronRpcConfiguration, StandaloneIModelRpcInterface, IModelTileRpcInterface, IModelReadRpcInterface, ViewQueryParams, ViewDefinitionProps, ColorDef } from "@bentley/imodeljs-common";
import { Point3d } from "@bentley/geometry-core";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelApi } from "./IModelApi";
import { ProjectApi, ProjectScope } from "./ProjectApi";

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

const activeViewState: SimpleViewState = new SimpleViewState();
const viewMap = new Map<string, ViewState>();
let theViewport: Viewport | undefined;

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
  const electron = (window as any).require("electron");
  const remote = electron.remote;
  if (undefined === remote)
    return;

  const filename = remote.process.env.SVT_STANDALONE_FILENAME;
  const viewName = remote.process.env.SVT_STANDALONE_VIEWNAME;
  if (undefined !== filename && undefined !== viewName) {
    config.iModelName = filename;
    config.viewName = viewName;
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
async function buildViewList(state: SimpleViewState, config: { viewName?: string }) {
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

export class LocateTool extends ViewTool {
  public static toolId = "View.Locate";

  private _curPoint = new Point3d();
  private _worldPoint = new Point3d();
  private _haveWorldPoint = false;

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
    if (ev.viewport)
      ev.viewport.invalidateDecorations();
  }

  public decorate(context: DecorateContext) {
    context.viewport.drawLocateCursor(context, this._curPoint, context.viewport.pixelsFromInches(IModelApp.locateManager.getApertureInches()), true);
    if (this._haveWorldPoint) {
      const gf = context.createWorldOverlay();
      const color = ColorDef.red.clone();
      gf.setSymbology(color, color, 10);
      // gf.addPointString([this._worldPoint]);
      // context.addWorldOverlay(gf.finish()!);
      const pt = context.viewport.worldToView(this._worldPoint);
      gf.addPointString([pt]);
      context.addViewOverlay(gf.finish()!);
    }
  }
}

export class StandardViewRotationTool extends ViewTool {
  public static toolId = "View.StandardRotation";
  private rotations = [StandardViewId.Top, StandardViewId.Iso, StandardViewId.Front];
  private rotationNames = ["Top", "Iso", "Front"];
  private rotationIndex = 0;

  public onDataButtonDown(ev: BeButtonEvent) {
    if (ev.viewport) {
      showStatus(this.rotationNames[this.rotationIndex], "view");
      ev.viewport.setStandardRotation(this.rotations[this.rotationIndex]);
      this.rotationIndex = (this.rotationIndex + 1) % 3;
    }
  }
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
  }
}

async function _changeView(view: ViewState) {
  await theViewport!.changeView(view);
}

// functions that start viewing commands, associated with icons in wireIconsToFunctions
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
function switchStandardRotation(_event: any) {
  IModelApp.tools.run("View.StandardRotation", theViewport!);
}

// start rotate view.
function changeView(event: any) {
  const viewName = event.target.selectedOptions["0"].label;
  _changeView(viewMap.get(viewName)!);
}

// associate viewing commands to icons. I couldn't get assigning these in the HTML to work.
function wireIconsToFunctions() {
  document.getElementById("viewList")!.addEventListener("change", changeView);
  document.getElementById("startFit")!.addEventListener("click", startFit);
  document.getElementById("startWindowArea")!.addEventListener("click", startWindowArea);
  document.getElementById("startZoom")!.addEventListener("click", startSelect);
  document.getElementById("startWalk")!.addEventListener("click", startWalk);
  document.getElementById("startRotateView")!.addEventListener("click", startRotateView);
  document.getElementById("switchStandardRotation")!.addEventListener("click", switchStandardRotation);
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
    IModelApp.tools.register(StandardViewRotationTool);

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
