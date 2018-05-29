import { IModelApp, IModelConnection, ViewState, Viewport, ViewTool, BeButtonEvent, DecorateContext, StandardViewId } from "@bentley/imodeljs-frontend";
import { ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AccessToken, AuthorizationToken, Project, IModel } from "@bentley/imodeljs-clients";
import { ElectronRpcManager, ElectronRpcConfiguration, IModelReadRpcInterface, ViewQueryParams, ViewDefinitionProps } from "@bentley/imodeljs-common";
import { Point3d } from "@bentley/geometry-core";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelApi } from "./IModelApi";
import { ProjectApi, ProjectScope } from "./ProjectApi";

// tslint:disable:no-console

class SimpleViewState {
  public accessToken?: AccessToken;
  public project?: Project;
  public iModel?: IModel;
  public iModelConnection?: IModelConnection;
  public viewDefinition?: ViewDefinitionProps;
  public viewState?: ViewState;
  public viewPort?: Viewport;
  constructor() {
    this.accessToken = undefined;
    this.project = undefined;
    this.iModel = undefined;
    this.iModelConnection = undefined;
    this.viewDefinition = undefined;
    this.viewState = undefined;
    this.viewPort = undefined;
  }
}

// Entry point - run the main function
main();

// retrieves configuration.json from the Public folder, and override configuration values from that.
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

// selects the configured view.
async function selectView(state: SimpleViewState, viewName: string) {
  const viewQueryParams: ViewQueryParams = { wantPrivate: false };
  const viewProps: ViewDefinitionProps[] = await state.iModelConnection!.views.queryProps(viewQueryParams);
  for (const viewProp of viewProps) {
    // look for view of the expected name.
    if (viewProp.code && viewProp.id && (viewProp.code.value === viewName)) {
      state.viewState = await state.iModelConnection!.views.load(viewProp.id);
      return;
    }
  }
}

let theViewport: Viewport | undefined;

export class LocateTool extends ViewTool {
  public static toolId = "View.Locate";

  private _curPoint?: Point3d;

  public constructor() { super(); }

  public onDataButtonDown(_ev: BeButtonEvent) { }
  public updateDynamics(ev: BeButtonEvent) { this.onModelMotion(ev); }
  public onModelMotion(ev: BeButtonEvent) {
    this._curPoint = ev.point;

    if (ev.viewport)
      ev.viewport.invalidateDecorations();
  }

  public decorate(context: DecorateContext) {
    if (undefined !== this._curPoint)
      context.viewport.drawLocateCursor(context, this._curPoint, context.viewport.pixelsFromInches(IModelApp.locateManager.getApertureInches()), true);
  }
}

export class StandardViewRotationTool extends ViewTool {
  public static toolId = "View.StandardRotation";
  private rotations = [StandardViewId.Top, StandardViewId.Iso, StandardViewId.Front];
  private rotationIndex = 0;

  public onDataButtonDown(ev: BeButtonEvent) {
    if (ev.viewport) {
      console.log("STANDARD VIEW ROTATION CLICKED", this.rotationIndex); //tslint:disable-line
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
    await theViewport.changeView(state.viewState!);
    IModelApp.viewManager.addViewport(theViewport);
  }
}

// functions that start viewing commands, associated with icons in wireIconsToFunctions
function startFit(_event: any) {
  IModelApp.tools.run("View.Fit", theViewport!, true);
}

// starts Window Area
function startWindowArea(_event: any) {
  IModelApp.tools.run("View.WindowArea", theViewport!);
}

// starts View Scroll (I don't see a Zoom command)
function startZoom(_event: any) {
  // IModelApp.tools.run("View.Scroll", theViewport!);
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

// associate viewing commands to icons. I couldn't get assigning these in the HTML to work.
function wireIconsToFunctions() {
  document.getElementById("startFit")!.addEventListener("click", startFit);
  document.getElementById("startWindowArea")!.addEventListener("click", startWindowArea);
  document.getElementById("startZoom")!.addEventListener("click", startZoom);
  document.getElementById("startWalk")!.addEventListener("click", startWalk);
  document.getElementById("startRotateView")!.addEventListener("click", startRotateView);
  document.getElementById("switchStandardRotation")!.addEventListener("click", switchStandardRotation);
}

// show status in the output HTML
function showStatus(string1: string, string2?: string) {
  let outString: string = string1;
  if (string2)
    outString = outString.concat(" ", string2);
  document.getElementById("showstatus")!.innerHTML = outString;
}

// ----------------------------------------------------------
// main entry point.
async function main() {
  const state: SimpleViewState = new SimpleViewState();

  // this is the default configuration
  const configuration: any = {
    userName: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
    projectName: "plant-sta",
    iModelName: "NabeelQATestiModel",
    viewName: "GistTop",
  };

  // override anything that's in the configuration
  retrieveConfigurationOverrides(configuration);
  console.log("Configuration", JSON.stringify(configuration));

  // start the app.
  IModelApp.startup("QA", true);

  if (ElectronRpcConfiguration.isElectron)
    ElectronRpcManager.initializeClient({}, [IModelReadRpcInterface]);

  try {
    // initialize the Project and IModel Api
    await ProjectApi.init();
    await IModelApi.init();

    IModelApp.tools.register(LocateTool);
    IModelApp.tools.register(StandardViewRotationTool);

    // log in.
    showStatus("logging in as", configuration.userName);
    await loginToConnect(state, configuration.userName, configuration.password);

    // open the specified project
    showStatus("opening Project", configuration.projectName);
    await openProject(state, configuration.projectName);

    // open the specified iModel
    showStatus("opening iModel", configuration.iModelName);
    await openIModel(state, configuration.iModelName);

    // open the specified view
    showStatus("opening View", configuration.viewName);
    await selectView(state, configuration.viewName);

    // now connect the view to the canvas
    await openView(state);

    showStatus("View Ready");
  } catch (reason) {
    alert(reason);
    return;
  }

  wireIconsToFunctions();
  console.log("This is from frontend/main");
}
