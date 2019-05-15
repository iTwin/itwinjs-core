
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, OpenMode, StopWatch } from "@bentley/bentleyjs-core";
import { Config, HubIModel, OidcFrontendClientConfiguration, Project } from "@bentley/imodeljs-clients";
import {
  BentleyCloudRpcManager, DisplayStyleProps, ElectronRpcConfiguration, ElectronRpcManager, IModelReadRpcInterface,
  IModelTileRpcInterface, IModelToken, MobileRpcConfiguration, MobileRpcManager, RpcConfiguration, RpcOperation, RenderMode,
  SnapshotIModelRpcInterface, ViewDefinitionProps,
} from "@bentley/imodeljs-common";
import {
  AuthorizedFrontendRequestContext, FrontendRequestContext, DisplayStyleState, DisplayStyle3dState, IModelApp, IModelConnection,
  OidcClientWrapper, PerformanceMetrics, Pixel, RenderSystem, ScreenViewport, Target, TileAdmin, Viewport, ViewRect, ViewState, IModelAppOptions,
} from "@bentley/imodeljs-frontend";
import { System } from "@bentley/imodeljs-frontend/lib/webgl";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { ConnectProjectConfiguration, SVTConfiguration } from "../common/SVTConfiguration";
import { initializeIModelHub } from "./ConnectEnv";
import { IModelApi } from "./IModelApi";

let curRenderOpts: RenderSystem.Options = {}; // Keep track of the current render options (disabled webgl extensions and enableOptimizedSurfaceShaders flag)
let curTileProps: TileAdmin.Props = {}; // Keep track of whether or not instancing has been enabled

interface Options {
  [key: string]: any; // Add index signature
}

// Retrieve default config data from json file
async function getDefaultConfigs(): Promise<string> {
  return DisplayPerfRpcInterface.getClient().getDefaultConfigs();
}

async function saveCsv(outputPath: string, outputName: string, rowData: Map<string, number | string>): Promise<void> {
  return DisplayPerfRpcInterface.getClient().saveCsv(outputPath, outputName, rowData);
}

const wantConsoleOutput: boolean = false;
function debugPrint(msg: string): void {
  if (wantConsoleOutput)
    console.log(msg); // tslint:disable-line
}

async function resolveAfterXMilSeconds(ms: number) { // must call await before this function!!!
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function removeFilesFromDir(_startPath: string, _filter: string) {
  // if (!fs.existsSync(startPath))
  //   return;
  // const files = fs.readdirSync(startPath);
  // files.forEach((file) => {
  //   const filename = path.join(startPath, file);
  //   if (fs.lstatSync(filename).isDirectory()) {
  //     removeFilesFromDir(filename, filter); // recurse
  //   } else if (filename.indexOf(filter) >= 0) {
  //     debugPrint("deleting file " + filename);
  //     fs.unlinkSync(filename); // Delete file
  //   }
  // });
}

function combineFilePaths(additionalPath: string, initPath?: string) {
  if (initPath === undefined || additionalPath[1] === ":") // if additionalPath is full path (like D:), ignore the initial path
    return additionalPath;
  let combined = initPath;
  while (combined.endsWith("\\") || combined.endsWith("\/"))
    combined = combined.slice(0, -1);
  if (additionalPath[0] !== "\\" && additionalPath[0] !== "\/")
    combined += "\\";
  combined += additionalPath;
  return combined;
}

class DisplayPerfTestApp {
  public static startup(opts?: IModelAppOptions) {
    opts = opts ? opts : {};
    opts.i18n = { urlTemplate: "locales/en/{{ns}}.json" } as I18NOptions;
    IModelApp.startup(opts);
  }
}

function getRenderMode(): string {
  switch (activeViewState.viewState!.displayStyle.viewFlags.renderMode) {
    case 0: return "Wireframe";
    case 3: return "HiddenLine";
    case 4: return "SolidFill";
    case 6: return "SmoothShade";
    default: return "";
  }
}

function getRenderOpts(): string {
  let optString = "";
  for (const [key, value] of Object.entries(curRenderOpts)) {
    switch (key) {
      case "disabledExtensions":
        if (value) value.forEach((ext: string) => {
          switch (ext) {
            case "WEBGL_draw_buffers":
              optString += "-drawBuf";
              break;
            case "OES_element_index_uint":
              optString += "-unsignedInt";
              break;
            case "OES_texture_float":
              optString += "-texFloat";
              break;
            case "OES_texture_half_float":
              optString += "-texHalfFloat";
              break;
            case "WEBGL_depth_texture":
              optString += "-depthTex";
              break;
            case "EXT_color_buffer_float":
              optString += "-floats";
              break;
            case "EXT_shader_texture_lod":
              optString += "-texLod";
              break;
            case "ANGLE_instanced_arrays":
              optString += "-instArrays";
              break;
            default:
              optString += "-" + ext;
              break;
          }
        });
        break;
      case "enableOptimizedSurfaceShaders":
        if (value) optString += "+optSurf";
        break;
      case "cullAgainstActiveVolume":
        if (value) optString += "+cullActVol";
        break;
      case "preserveShaderSourceCode":
        if (value) optString += "+shadeSrc";
        break;
      case "displaySolarShadows":
        if (value) optString += "+solShd";
        break;
      default:
        if (value) optString += "+" + key;
    }
  }
  return optString;
}

function getTileProps(): string {
  let tilePropsStr = "";
  for (const [key, value] of Object.entries(curTileProps)) {
    switch (key) {
      case "disableThrottling":
        if (value) tilePropsStr += "+throt";
        break;
      case "elideEmptyChildContentRequests":
        if (value) tilePropsStr += "+elide";
        break;
      case "enableInstancing":
        if (value) tilePropsStr += "+inst";
        break;
      case "maxActiveRequests":
        if (value !== 10) tilePropsStr += "+max" + value;
        break;
      case "retryInterval":
        if (value) tilePropsStr += "+retry" + value;
        break;
      default:
        if (value) tilePropsStr += "+" + key;
    }
  }
  return tilePropsStr;
}

function getViewFlagsString(): string {
  let vfString = "";
  if (activeViewState.viewState) for (const [key, value] of Object.entries(activeViewState.viewState.displayStyle.viewFlags)) {
    switch (key) {
      case "renderMode":
        break;
      case "dimensions":
        if (!value) vfString += "-dim";
        break;
      case "patterns":
        if (!value) vfString += "-pat";
        break;
      case "weights":
        if (!value) vfString += "-wt";
        break;
      case "styles":
        if (!value) vfString += "-sty";
        break;
      case "transparency":
        if (!value) vfString += "-trn";
        break;
      case "fill":
        if (!value) vfString += "-fll";
        break;
      case "textures":
        if (!value) vfString += "-txt";
        break;
      case "materials":
        if (!value) vfString += "-mat";
        break;
      case "visibleEdges":
        if (value) vfString += "+vsE";
        break;
      case "hiddenEdges":
        if (value) vfString += "+hdE";
        break;
      case "sourceLights":
        if (value) vfString += "+scL";
        break;
      case "cameraLights":
        if (value) vfString += "+cmL";
        break;
      case "solarLight":
        if (value) vfString += "+slL";
        break;
      case "shadows":
        if (value) vfString += "+shd";
        break;
      case "clipVolume":
        if (!value) vfString += "-clp";
        break;
      case "constructions":
        if (value) vfString += "+con";
        break;
      case "monochrome":
        if (value) vfString += "+mno";
        break;
      case "noGeometryMap":
        if (value) vfString += "+noG";
        break;
      case "backgroundMap":
        if (value) vfString += "+bkg";
        break;
      case "hLineMaterialColors":
        if (value) vfString += "+hln";
        break;
      case "edgeMask":
        if (value === 1) vfString += "+genM";
        if (value === 2) vfString += "+useM";
        break;
      case "ambientOcclusion":
        if (value) vfString += "+ao";
        break;
      case "forceSurfaceDiscard":
        if (value) vfString += "+fsd";
        break;
      default:
        if (value) vfString += "+" + key;
    }
  }
  return vfString;
}

async function waitForTilesToLoad(modelLocation?: string) {
  if (modelLocation) {
    removeFilesFromDir(modelLocation, ".Tiles");
    removeFilesFromDir(modelLocation, ".TileCache");
  }

  theViewport!.continuousRendering = false;

  // Start timer for tile loading time
  const timer = new StopWatch(undefined, true);
  let haveNewTiles = true;
  while (haveNewTiles) {
    theViewport!.sync.setRedrawPending;
    theViewport!.sync.invalidateScene();
    theViewport!.renderFrame();

    const sceneContext = theViewport!.createSceneContext();
    activeViewState.viewState!.createScene(sceneContext);
    sceneContext.requestMissingTiles();

    // The scene is ready when (1) all required TileTree roots have been created and (2) all required tiles have finished loading
    haveNewTiles = !(activeViewState.viewState!.areAllTileTreesLoaded) || sceneContext.hasMissingTiles || 0 < sceneContext.missingTiles.size;

    // NB: The viewport is NOT added to the ViewManager's render loop, therefore we must manually pump the tile request scheduler...
    if (haveNewTiles)
      IModelApp.tileAdmin.process();

    // debugPrint(haveNewTiles ? "Awaiting tile loads..." : "...All tiles loaded.");

    await resolveAfterXMilSeconds(100);
  }
  theViewport!.continuousRendering = false;
  theViewport!.renderFrame();
  timer.stop();
  curTileLoadingTime = timer.current.milliseconds;
}

function getRowData(finalFrameTimings: Array<Map<string, number>>, configs: DefaultConfigs, pixSelectStr?: string): Map<string, number | string> {
  const rowData = new Map<string, number | string>();
  rowData.set("iModel", configs.iModelName!);
  rowData.set("View", configs.viewName!);
  rowData.set("Screen Size", configs.view!.width + "X" + configs.view!.height);
  rowData.set("Display Style", activeViewState.viewState!.displayStyle.name);
  rowData.set("Render Mode", getRenderMode());
  rowData.set("View Flags", getViewFlagsString() !== "" ? " " + getViewFlagsString() : "");
  rowData.set("Render Options", getRenderOpts() !== "" ? " " + getRenderOpts() : "");
  rowData.set("Tile Props", getTileProps() !== "" ? " " + getTileProps() : "");
  if (pixSelectStr) rowData.set("ReadPixels Selector", " " + pixSelectStr);
  rowData.set("Tile Loading Time", curTileLoadingTime);

  // Calculate average timings
  if (pixSelectStr) { // timing read pixels
    let gpuTime = 0;
    for (const colName of finalFrameTimings[0].keys()) {
      let sum = 0;
      finalFrameTimings.forEach((timing) => {
        const data = timing!.get(colName);
        sum += data ? data : 0;
      });
      if (colName === "Finish GPU Queue")
        gpuTime = sum / finalFrameTimings.length;
      else if (colName === "Read Pixels") {
        rowData.set("Finish GPU Queue", gpuTime);
        rowData.set(colName, sum / finalFrameTimings.length);
      } else
        rowData.set(colName, sum / finalFrameTimings.length);
    }
  } else { // timing render frame
    for (const colName of finalFrameTimings[0].keys()) {
      let sum = 0;
      finalFrameTimings.forEach((timing) => {
        const data = timing!.get(colName);
        sum += data ? data : 0;
      });
      rowData.set(colName, sum / finalFrameTimings.length);
    }
  }
  rowData.set("Effective FPS", (1000.0 / Number(rowData.get("Total Time"))).toFixed(2));
  return rowData;
}

function getImageString(configs: DefaultConfigs, prefix = ""): string {
  let output = configs.outputPath ? configs.outputPath : "";
  const lastChar = output[output.length - 1];
  if (lastChar !== "/" && lastChar !== "\\")
    output += "\\";
  output += prefix;
  output += configs.iModelName ? configs.iModelName.replace(/\.[^/.]+$/, "") : "";
  output += configs.viewName ? "_" + configs.viewName : "";
  output += configs.displayStyle ? "_" + configs.displayStyle.trim() : "";
  output += getRenderMode() !== "" ? "_" + getRenderMode() : "";
  output += getViewFlagsString() !== "" ? "_" + getViewFlagsString() : "";
  output += getRenderOpts() !== "" ? "_" + getRenderOpts() : "";
  output += getTileProps() !== "" ? "_" + getTileProps() : "";
  output += ".png";
  return output;
}

async function savePng(fileName: string): Promise<void> {
  if (theViewport && theViewport.canvas) {
    const img = theViewport.canvas.toDataURL("image/png"); // System.instance.canvas.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, ""); // strip off the data: url prefix to get just the base64-encoded bytes
    return DisplayPerfRpcInterface.getClient().savePng(fileName, data);
  }
}

class ViewSize {
  public width: number;
  public height: number;

  constructor(w = 0, h = 0) { this.width = w; this.height = h; }
}

class DefaultConfigs {
  public view?: ViewSize;
  public outputName?: string;
  public outputPath?: string;
  public iModelLocation?: string;
  public iModelName?: string;
  public iModelHubProject?: string;
  public viewName?: string;
  public testType?: string;
  public displayStyle?: string;
  public viewFlags?: any; // ViewFlags, except we want undefined for anything not specifically set
  public renderOptions?: RenderSystem.Options;
  public tileProps?: TileAdmin.Props;
  public aoEnabled = false;

  public constructor(jsonData: any, prevConfigs?: DefaultConfigs, useDefaults = false) {
    if (useDefaults) {
      this.view = new ViewSize(1000, 1000);
      this.outputName = "performanceResults.csv";
      this.outputPath = "D:\\output\\performanceData\\";
      this.iModelName = "Wraith.ibim";
      this.iModelHubProject = "DisplayPerformanceTest";
      this.viewName = "V0";
      this.testType = "timing";
    }
    if (prevConfigs !== undefined) {
      if (prevConfigs.view) this.view = new ViewSize(prevConfigs.view.width, prevConfigs.view.height);
      if (prevConfigs.outputName) this.outputName = prevConfigs.outputName;
      if (prevConfigs.outputPath) this.outputPath = prevConfigs.outputPath;
      if (prevConfigs.iModelLocation) this.iModelLocation = prevConfigs.iModelLocation;
      if (prevConfigs.iModelName) this.iModelName = prevConfigs.iModelName;
      if (prevConfigs.iModelHubProject) this.iModelHubProject = prevConfigs.iModelHubProject;
      if (prevConfigs.viewName) this.viewName = prevConfigs.viewName;
      if (prevConfigs.testType) this.testType = prevConfigs.testType;
      if (prevConfigs.displayStyle) this.displayStyle = prevConfigs.displayStyle;
      this.renderOptions = this.updateData(prevConfigs.renderOptions, this.renderOptions) as RenderSystem.Options || undefined;
      this.tileProps = this.updateData(prevConfigs.tileProps, this.tileProps) as TileAdmin.Props || undefined;
      this.viewFlags = this.updateData(prevConfigs.viewFlags, this.viewFlags);
    } else if (jsonData.argOutputPath)
      this.outputPath = jsonData.argOutputPath;
    if (jsonData.view) this.view = new ViewSize(jsonData.view.width, jsonData.view.height);
    if (jsonData.outputName) this.outputName = jsonData.outputName;
    if (jsonData.outputPath) this.outputPath = combineFilePaths(jsonData.outputPath, this.outputPath);
    if (jsonData.iModelLocation) this.iModelLocation = combineFilePaths(jsonData.iModelLocation, this.iModelLocation);
    if (jsonData.iModelName) this.iModelName = jsonData.iModelName;
    if (jsonData.iModelHubProject) this.iModelHubProject = jsonData.iModelHubProject;
    if (jsonData.viewName) this.viewName = jsonData.viewName;
    if (jsonData.testType) this.testType = jsonData.testType;
    if (jsonData.displayStyle) this.displayStyle = jsonData.displayStyle;
    this.renderOptions = this.updateData(jsonData.renderOptions, this.renderOptions) as RenderSystem.Options || undefined;
    this.tileProps = this.updateData(jsonData.tileProps, this.tileProps) as TileAdmin.Props || undefined;
    this.viewFlags = this.updateData(jsonData.viewFlags, this.viewFlags); // as ViewFlags || undefined;
    this.aoEnabled = undefined !== jsonData.viewFlags && !!jsonData.viewFlags.ambientOcclusion;

    debugPrint("view: " + (this.view !== undefined ? (this.view!.width + "X" + this.view!.height) : "undefined"));
    debugPrint("outputFile: " + this.outputFile);
    debugPrint("outputName: " + this.outputName);
    debugPrint("outputPath: " + this.outputPath);
    debugPrint("iModelFile: " + this.iModelFile);
    debugPrint("iModelLocation: " + this.iModelLocation);
    debugPrint("iModelName: " + this.iModelName);
    debugPrint("iModelHubProject: " + this.iModelHubProject);
    debugPrint("viewName: " + this.viewName);
    debugPrint("testType: " + this.testType);
    debugPrint("displayStyle: " + this.displayStyle);
    debugPrint("tileProps: " + this.tileProps);
    debugPrint("renderOptions: " + this.renderOptions);
    debugPrint("viewFlags: " + this.viewFlags);
  }

  private getRenderModeCode(value: any): RenderMode | undefined {
    if (value === undefined)
      return undefined;
    let mode;
    switch (value.toString().toLowerCase().trim()) {
      case "0":
      case "wireframe":
        mode = RenderMode.Wireframe;
        break;
      case "3":
      case "hiddenline":
        mode = RenderMode.HiddenLine;
        break;
      case "4":
      case "solidfill":
        mode = RenderMode.SolidFill;
        break;
      case "6":
      case "smoothshade":
        mode = RenderMode.SmoothShade;
        break;
    }
    return mode;
  }

  private updateData(prevData: any, newData: any) {

    if (prevData) {
      if (newData === undefined)
        newData = {};
      for (const [key, value] of Object.entries(prevData)) { // Copy by value
        if (key === "renderMode" && this.getRenderModeCode(value) !== undefined)
          (newData as Options)[key] = this.getRenderModeCode(value);
        else
          (newData as Options)[key] = value;
      }
    }
    return newData;
  }

  private createFullFilePath(filePath: string | undefined, fileName: string | undefined): string | undefined {
    if (fileName === undefined)
      return undefined;
    if (filePath === undefined)
      return fileName;
    else {
      let output = filePath;
      const lastChar = output[output.length - 1];
      debugPrint("lastChar: " + lastChar);
      if (lastChar !== "/" && lastChar !== "\\")
        output += "\\";
      return output + fileName;
    }
  }
  public get iModelFile() { return this.createFullFilePath(this.iModelLocation, this.iModelName); }
  public get outputFile() { return this.createFullFilePath(this.outputPath, this.outputName); }
}

class SimpleViewState {
  public project?: Project;
  public iModel?: HubIModel;
  public iModelConnection?: IModelConnection;
  public viewDefinition?: ViewDefinitionProps;
  public viewState?: ViewState;
  public viewPort?: Viewport;
  public projectConfig?: ConnectProjectConfiguration;
  constructor() { }
}

let theViewport: ScreenViewport | undefined;
let activeViewState: SimpleViewState = new SimpleViewState();
let curTileLoadingTime = 0;

async function _changeView(view: ViewState) {
  theViewport!.changeView(view);
  activeViewState.viewState = view;
}

// opens the view and connects it to the HTML canvas element.
async function openView(state: SimpleViewState, viewSize: ViewSize) {
  if (undefined !== theViewport) {
    theViewport.dispose();
    theViewport = undefined;
  }

  // find the canvas.
  const vpDiv = document.getElementById("imodel-viewport") as HTMLDivElement;

  if (vpDiv) {
    vpDiv.style.width = String(viewSize.width) + "px";
    vpDiv.style.height = String(viewSize.height) + "px";
    theViewport = ScreenViewport.create(vpDiv, state.viewState!);
    debugPrint("theViewport: " + theViewport);
    const canvas = theViewport.canvas as HTMLCanvasElement;
    debugPrint("canvas: " + canvas);
    canvas.style.width = String(viewSize.width) + "px";
    canvas.style.height = String(viewSize.height) + "px";
    theViewport.continuousRendering = false;
    theViewport.sync.setRedrawPending;
    (theViewport!.target as Target).performanceMetrics = undefined;
    await _changeView(state.viewState!);
  }
}

async function initializeOidc(requestContext: FrontendRequestContext) {
  if (OidcClientWrapper.oidcClient)
    return;

  const clientId = (ElectronRpcConfiguration.isElectron) ? Config.App.get("imjs_electron_test_client_id") : Config.App.get("imjs_browser_test_client_id");
  const redirectUri = (ElectronRpcConfiguration.isElectron) ? Config.App.get("imjs_electron_test_redirect_uri") : Config.App.get("imjs_browser_test_redirect_uri");
  const oidcConfig: OidcFrontendClientConfiguration = { clientId, redirectUri, scope: "openid email profile organization imodelhub context-registry-service imodeljs-router reality-data:read product-settings-service" };

  await OidcClientWrapper.initialize(requestContext, oidcConfig);
  IModelApp.authorizationClient = OidcClientWrapper.oidcClient;
}

// Wraps the signIn process
// - called the first time to start the signIn process - resolves to false
// - called the second time as the Authorization provider redirects to cause the application to refresh/reload - resolves to false
// - called the third time as the application redirects back to complete the authorization - finally resolves to true
// @return Promise that resolves to true only after signIn is complete. Resolves to false until then.
async function signIn(): Promise<boolean> {
  const requestContext = new FrontendRequestContext();
  await initializeOidc(requestContext);

  if (!OidcClientWrapper.oidcClient.hasSignedIn) {
    await OidcClientWrapper.oidcClient.signIn(new FrontendRequestContext());
    return false;
  }

  return true;
}

async function loadIModel(testConfig: DefaultConfigs) {
  activeViewState = new SimpleViewState();
  activeViewState.viewState;

  // Open an iModel from a local file
  let openLocalIModel = (testConfig.iModelLocation !== undefined);
  if (openLocalIModel) {
    try {
      activeViewState.iModelConnection = await IModelConnection.openSnapshot(testConfig.iModelFile!);
    } catch (err) {
      debugPrint("openSnapshot failed: " + err.toString());
      openLocalIModel = false;
    }
  }

  // Open an iModel from the iModelHub
  if (!openLocalIModel && testConfig.iModelHubProject !== undefined) {
    const signedIn: boolean = await signIn();
    if (!signedIn)
      return;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    activeViewState.projectConfig!.projectName = testConfig.iModelHubProject;
    activeViewState.projectConfig!.iModelName = testConfig.iModelName!.replace(".ibim", "").replace(".bim", "");
    activeViewState.project = await initializeIModelHub(activeViewState.projectConfig!.projectName);
    activeViewState.iModel = await IModelApi.getIModelByName(requestContext, activeViewState.project!.wsgId, activeViewState.projectConfig!.iModelName);
    if (activeViewState.iModel === undefined)
      throw new Error(`${activeViewState.projectConfig!.iModelName} - IModel not found in project ${activeViewState.project!.name}`);
    activeViewState.iModelConnection = await IModelApi.openIModel(activeViewState.project!.wsgId, activeViewState.iModel!.wsgId, undefined, OpenMode.Readonly);
  }

  // open the specified view
  await loadView(activeViewState, testConfig.viewName!);

  // now connect the view to the canvas
  await openView(activeViewState, testConfig.view!);
  // assert(theViewport !== undefined, "ERROR: theViewport is undefined");

  // Set the display style
  const iModCon = activeViewState.iModelConnection;
  if (iModCon && testConfig.displayStyle) {
    const displayStyleProps = await iModCon.elements.queryProps({ from: DisplayStyleState.classFullName, where: "CodeValue = '" + testConfig.displayStyle + "'" });
    if (displayStyleProps.length >= 1)
      theViewport!.view.setDisplayStyle(new DisplayStyle3dState(displayStyleProps[0] as DisplayStyleProps, iModCon));
  }

  // Set the viewFlags (including the render mode)
  if (undefined !== activeViewState.viewState) {
    activeViewState.viewState.displayStyle.viewFlags.ambientOcclusion = testConfig.aoEnabled;
    if (testConfig.viewFlags) {
      // Use the testConfig.viewFlags data for each property in ViewFlags if it exists; otherwise, keep using the viewState's ViewFlags info
      for (const [key] of Object.entries(activeViewState.viewState.displayStyle.viewFlags)) {
        if ((testConfig.viewFlags as Options)[key] !== undefined)
          (activeViewState.viewState.displayStyle.viewFlags as Options)[key] = (testConfig.viewFlags as Options)[key];
        else
          (testConfig.viewFlags as Options)[key] = (activeViewState.viewState.displayStyle.viewFlags as Options)[key];
      }
    }
  }

  // Load all tiles
  await waitForTilesToLoad(testConfig.iModelLocation);
}

async function closeIModel(isSnapshot: boolean) {
  debugPrint("start closeIModel" + activeViewState.iModelConnection);
  if (activeViewState.iModelConnection) {
    if (isSnapshot)
      await activeViewState.iModelConnection.closeSnapshot();
    else
      await activeViewState.iModelConnection!.close();
  }
  debugPrint("end closeIModel");
}

// Restart the IModelApp if either the TileAdmin.Props or the Render.Options has changed
function restartIModelApp(testConfig: DefaultConfigs) {
  const newRenderOpts: RenderSystem.Options = testConfig.renderOptions ? testConfig.renderOptions : {};
  const newTileProps: TileAdmin.Props = testConfig.tileProps ? testConfig.tileProps : {};
  if (IModelApp.initialized) {
    let restart = false; // Determine if anything in renderOpts or tileProps changed that requires the IModelApp to be reinitialized
    if (Object.keys(curTileProps).length !== Object.keys(newTileProps).length || Object.keys(curRenderOpts).length !== Object.keys(newRenderOpts).length)
      restart = true;
    for (const [key, value] of Object.entries(curTileProps)) {
      if (value !== (newTileProps as Options)[key]) {
        restart = true;
        break;
      }
    }
    for (const [key, value] of Object.entries(curRenderOpts)) {
      if (key === "disabledExtensions") {
        if ((value ? value.length : 0) !== ((newRenderOpts && newRenderOpts.disabledExtensions) ? newRenderOpts.disabledExtensions.length : 0)) {
          restart = true;
          break;
        }
        for (let i = 0; i < (value ? value.length : 0); i++) {
          if (value && newRenderOpts.disabledExtensions && value[i] !== newRenderOpts.disabledExtensions[i]) {
            restart = true;
            break;
          }
        }
      } else if (value !== (newRenderOpts as Options)[key]) {
        restart = true;
        break;
      }
    }
    if (restart) {
      if (theViewport) {
        theViewport.dispose();
        theViewport = undefined;
      }
      IModelApp.shutdown();
    }
  }
  curRenderOpts = newRenderOpts;
  curTileProps = newTileProps;
  if (!IModelApp.initialized) {
    DisplayPerfTestApp.startup({
      renderSys: testConfig.renderOptions,
      tileAdmin: TileAdmin.create(curTileProps),
    });
    (IModelApp.renderSystem as System).techniques.compileShaders();
  }
}

async function createReadPixelsImages(testConfig: DefaultConfigs, pix: Pixel.Selector, pixStr: string) {
  const width = testConfig.view!.width;
  const height = testConfig.view!.height;
  const viewRect = new ViewRect(0, 0, width, height);
  if (theViewport && theViewport.canvas) {
    const ctx = theViewport.canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, theViewport.canvas.width, theViewport.canvas.height);
      const elemIdImgData = (pix & Pixel.Selector.Feature) ? ctx.createImageData(width, height) : undefined;
      const depthImgData = (pix & Pixel.Selector.GeometryAndDistance) ? ctx.createImageData(width, height) : undefined;
      const typeImgData = (pix & Pixel.Selector.GeometryAndDistance) ? ctx.createImageData(width, height) : undefined;

      theViewport.readPixels(viewRect, pix, (pixels: any) => {
        if (undefined === pixels)
          return;
        for (let y = viewRect.top; y < viewRect.bottom; ++y) {
          for (let x = viewRect.left; x < viewRect.right; ++x) {
            const index = (x * 4) + (y * 4 * viewRect.right);
            const pixel = pixels.getPixel(x, y);
            // // RGB for element ID
            if (elemIdImgData !== undefined) {
              const elemId = Id64.getLowerUint32(pixel.elementId ? pixel.elementId : "");
              elemIdImgData.data[index + 0] = elemId % 256;
              elemIdImgData.data[index + 1] = (Math.floor(elemId / 256)) % 256;
              elemIdImgData.data[index + 2] = (Math.floor(elemId / (256 ^ 2))) % 256;
              elemIdImgData.data[index + 3] = 255; // Set alpha to 100% opaque
            }
            // RGB for Depth
            if (depthImgData !== undefined) {
              const distColor = pixels.getPixel(x, y).distanceFraction * 255;
              depthImgData.data[index + 0] = depthImgData.data[index + 1] = depthImgData.data[index + 2] = distColor;
              depthImgData.data[index + 3] = 255; // Set alpha to 100% opaque
            }
            // RGB for type
            if (typeImgData !== undefined) {
              const type = pixels.getPixel(x, y).type;
              switch (type) {
                case Pixel.GeometryType.None: // White
                  typeImgData.data[index + 0] = 255;
                  typeImgData.data[index + 1] = 255;
                  typeImgData.data[index + 2] = 255;
                  break;
                case Pixel.GeometryType.Surface: // Red
                  typeImgData.data[index + 0] = 255;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 0;
                  break;
                case Pixel.GeometryType.Linear: // Green
                  typeImgData.data[index + 0] = 0;
                  typeImgData.data[index + 1] = 255;
                  typeImgData.data[index + 2] = 0;
                  break;
                case Pixel.GeometryType.Edge: // Blue
                  typeImgData.data[index + 0] = 0;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 255;
                  break;
                case Pixel.GeometryType.Silhouette: // Purple
                  typeImgData.data[index + 0] = 255;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 255;
                  break;
                case Pixel.GeometryType.Unknown: // Black
                default:
                  typeImgData.data[index + 0] = 0;
                  typeImgData.data[index + 1] = 0;
                  typeImgData.data[index + 2] = 0;
                  break;
              }
              typeImgData.data[index + 3] = 255; // Set alpha to 100% opaque
            }
          }
        }
        return;
      });
      if (elemIdImgData !== undefined) {
        ctx.putImageData(elemIdImgData, 0, 0);
        await savePng(getImageString(testConfig, "elemId_" + pixStr + "_"));
      }
      if (depthImgData !== undefined) {
        ctx.putImageData(depthImgData, 0, 0);
        await savePng(getImageString(testConfig, "depth_" + pixStr + "_"));
      }
      if (typeImgData !== undefined) {
        ctx.putImageData(typeImgData, 0, 0);
        await savePng(getImageString(testConfig, "type_" + pixStr + "_"));
      }
    }
  }

}

async function runTest(testConfig: DefaultConfigs) {
  // Restart the IModelApp if needed
  restartIModelApp(testConfig);

  // Open and finish loading model
  await loadIModel(testConfig);

  if (testConfig.testType === "image" || testConfig.testType === "both")
    await savePng(getImageString(testConfig));

  if (testConfig.testType === "timing" || testConfig.testType === "both" || testConfig.testType === "readPixels") {
    // Throw away the first n renderFrame times, until it's more consistent
    for (let i = 0; i < 50; ++i) {
      theViewport!.sync.setRedrawPending();
      theViewport!.renderFrame();
    }

    // Turn on performance metrics to start collecting data when we render things
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false);

    // Add a pause so that user can start the GPU Performance Capture program
    // await resolveAfterXMilSeconds(7000);

    const finalFrameTimings: Array<Map<string, number>> = [];
    const numToRender = 100;
    if (testConfig.testType === "readPixels") {
      const width = testConfig.view!.width;
      const height = testConfig.view!.height;
      const viewRect = new ViewRect(0, 0, width, height);
      const testReadPix = async (pixSelect: Pixel.Selector, pixSelectStr: string) => {
        for (let i = 0; i < numToRender; ++i) {
          theViewport!.readPixels(viewRect, pixSelect, (_pixels: any) => { return; });
          finalFrameTimings[i] = (theViewport!.target as Target).performanceMetrics!.frameTimings;
          finalFrameTimings[i].delete("Scene Time");
        }
        const rowData = getRowData(finalFrameTimings, testConfig, pixSelectStr);
        await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData);

        // Create images from the elementID, depth (i.e. distance), and type (i.e. order)
        await createReadPixelsImages(testConfig, pixSelect, pixSelectStr);
      };
      // Test each combo of pixel selectors
      await testReadPix(Pixel.Selector.Feature, "+feature");
      await testReadPix(Pixel.Selector.GeometryAndDistance, "+geom+dist");
      await testReadPix(Pixel.Selector.All, "+feature+geom+dist");
    } else {
      const timer = new StopWatch(undefined, true);
      for (let i = 0; i < numToRender; ++i) {
        theViewport!.sync.setRedrawPending();
        theViewport!.renderFrame();
        finalFrameTimings[i] = (theViewport!.target as Target).performanceMetrics!.frameTimings;
      }
      timer.stop();
      if (wantConsoleOutput) {
        debugPrint("------------ Elapsed Time: " + timer.elapsed.milliseconds + " = " + timer.elapsed.milliseconds / numToRender + "ms per frame");
        debugPrint("Tile Loading Time: " + curTileLoadingTime);
        for (const t of finalFrameTimings) {
          let timingsString = "[";
          t.forEach((val) => {
            timingsString += val + ", ";
          });
          debugPrint(timingsString + "]");
          // Save all of the individual runs in the csv file, not just the average
          // const rowData = getRowData([t], testConfig);
          // await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData);
        }
      }
      const rowData = getRowData(finalFrameTimings, testConfig);
      await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData);
    }
  }

  // Close the imodel
  await closeIModel(testConfig.iModelLocation !== undefined);
}

// selects the configured view.
async function loadView(state: SimpleViewState, viewName: string) {
  const viewIds = await state.iModelConnection!.elements.queryIds({ from: ViewState.classFullName, where: "CodeValue = '" + viewName + "'" });
  if (1 === viewIds.size)
    state.viewState = await state.iModelConnection!.views.load(viewIds.values().next().value);

  if (undefined === state.viewState)
    debugPrint("Error: failed to load view by name");
}

async function testModel(configs: DefaultConfigs, modelData: any) {
  // Create DefaultModelConfigs
  const modConfigs = new DefaultConfigs(modelData, configs);

  // Perform all tests for this model
  for (const testData of modelData.tests) {
    if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".Tiles");
    if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".TileCache");

    // Create DefaultTestConfigs
    const testConfig = new DefaultConfigs(testData, modConfigs, true);

    // Ensure imodel file exists
    // if (!fs.existsSync(testConfig.iModelFile!))
    //   break;

    await runTest(testConfig);
  }
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".Tiles");
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".TileCache");
}

async function main() {
  // Retrieve DefaultConfigs
  const defaultConfigStr = await getDefaultConfigs();
  const jsonData = JSON.parse(defaultConfigStr);
  for (const i in jsonData.testSet) {
    if (i) {
      const modelData = jsonData.testSet[i];
      await testModel(new DefaultConfigs(jsonData), modelData);
    }
  }

  const topdiv = document.getElementById("topdiv")!;
  topdiv.style.display = "block";
  topdiv.innerText = "Tests Completed.";

  document.getElementById("imodel-viewport")!.style.display = "hidden";

  DisplayPerfRpcInterface.getClient().finishTest(); // tslint:disable-line:no-floating-promises

  IModelApp.shutdown();
}

window.onload = () => {
  const configuration = {} as SVTConfiguration;

  // Choose RpcConfiguration based on whether we are in electron or browser
  RpcConfiguration.developmentMode = true;
  let rpcConfiguration: RpcConfiguration;
  if (ElectronRpcConfiguration.isElectron) {
    rpcConfiguration = ElectronRpcManager.initializeClient({}, [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface]);
  } else if (MobileRpcConfiguration.isMobileFrontend) {
    rpcConfiguration = MobileRpcManager.initializeClient([DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface]);
  } else {
    const uriPrefix = configuration.customOrchestratorUri || "http://localhost:3001";
    rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "DisplayPerformanceTestApp", version: "v1.0" }, uriPrefix }, [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface]);

    // WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request. ECPresentation initialization tries to set active locale using
    // RPC without any imodel and fails...
    for (const definition of rpcConfiguration.interfaces())
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (request) => (request.findParameterOfType(IModelToken) || new IModelToken("test", "test", "test", "test", OpenMode.Readonly)));
  }

  // ###TODO: Raman added one-time initialization logic IModelApp.startup which replaces a couple of RpcRequest-related functions.
  // Cheap hacky workaround until that's fixed.
  DisplayPerfTestApp.startup();
  (IModelApp.renderSystem as System).techniques.compileShaders();

  main(); // tslint:disable-line:no-floating-promises
};
