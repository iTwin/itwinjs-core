
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, OpenMode, StopWatch } from "@bentley/bentleyjs-core";
import { Config, HubIModel, OidcFrontendClientConfiguration, Project } from "@bentley/imodeljs-clients";
import {
  BentleyCloudRpcManager, DisplayStyleProps, ElectronRpcConfiguration, ElectronRpcManager, IModelReadRpcInterface,
  IModelTileRpcInterface, IModelToken, MobileRpcConfiguration, MobileRpcManager, RpcConfiguration, RpcOperation, RenderMode,
  SnapshotIModelRpcInterface, ViewDefinitionProps, ViewFlag,
} from "@bentley/imodeljs-common";
import {
  AuthorizedFrontendRequestContext, FrontendRequestContext, DisplayStyleState, DisplayStyle3dState, IModelApp, IModelConnection,
  OidcClientWrapper, PerformanceMetrics, Pixel, RenderSystem, ScreenViewport, Target, TileAdmin, Viewport, ViewRect, ViewState,
} from "@bentley/imodeljs-frontend";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { ConnectProjectConfiguration, SVTConfiguration } from "../common/SVTConfiguration";
import { initializeIModelHub } from "./ConnectEnv";
import { IModelApi } from "./IModelApi";

let curRenderOpts: RenderSystem.Options = {}; // Keep track of the current render options (disabled webgl extensions and enableOptimizedSurfaceShaders flag)
let curTileProps: TileAdmin.Props = {}; // Keep track of whether or not instancing has been enabled

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

class DisplayPerfTestApp extends IModelApp {
  protected static supplyI18NOptions(): I18NOptions | undefined { return { urlTemplate: "locales/en/{{ns}}.json" } as I18NOptions; }
}

function setViewFlagOverrides(vf: any, vfo?: ViewFlag.Overrides): ViewFlag.Overrides {
  if (!vfo) vfo = new ViewFlag.Overrides();
  if (vf) {
    if (vf.hasOwnProperty("dimensions"))
      vfo.setShowDimensions(vf.dimensions);
    if (vf.hasOwnProperty("patterns"))
      vfo.setShowPatterns(vf.patterns);
    if (vf.hasOwnProperty("weights"))
      vfo.setShowWeights(vf.weights);
    if (vf.hasOwnProperty("styles"))
      vfo.setShowStyles(vf.styles);
    if (vf.hasOwnProperty("transparency"))
      vfo.setShowTransparency(vf.transparency);
    if (vf.hasOwnProperty("fill"))
      vfo.setShowFill(vf.fill);
    if (vf.hasOwnProperty("textures"))
      vfo.setShowTextures(vf.textures);
    if (vf.hasOwnProperty("materials"))
      vfo.setShowMaterials(vf.materials);
    if (vf.hasOwnProperty("visibleEdges"))
      vfo.setShowVisibleEdges(vf.visibleEdges);
    if (vf.hasOwnProperty("hiddenEdges"))
      vfo.setShowHiddenEdges(vf.hiddenEdges);
    if (vf.hasOwnProperty("sourceLights"))
      vfo.setShowSourceLights(vf.sourceLights);
    if (vf.hasOwnProperty("cameraLights"))
      vfo.setShowCameraLights(vf.cameraLights);
    if (vf.hasOwnProperty("solarLights"))
      vfo.setShowSolarLight(vf.solarLights);
    if (vf.hasOwnProperty("shadows"))
      vfo.setShowShadows(vf.shadows);
    if (vf.hasOwnProperty("clipVolume"))
      vfo.setShowClipVolume(vf.clipVolume);
    if (vf.hasOwnProperty("constructions"))
      vfo.setShowConstructions(vf.constructions);
    if (vf.hasOwnProperty("monochrome"))
      vfo.setMonochrome(vf.monochrome);
    if (vf.hasOwnProperty("noGeometryMap"))
      vfo.setIgnoreGeometryMap(vf.noGeometryMap);
    if (vf.hasOwnProperty("backgroundMap"))
      vfo.setShowBackgroundMap(vf.backgroundMap);
    if (vf.hasOwnProperty("hLineMaterialColors"))
      vfo.setUseHlineMaterialColors(vf.hLineMaterialColors);
    if (vf.hasOwnProperty("edgeMask"))
      vfo.setEdgeMask(Number(vf.edgeMask));
    if (vf.hasOwnProperty("forceSurfaceDiscard"))
      vfo.setForceSurfaceDiscard(vf.forceSurfaceDiscard);

    if (vf.hasOwnProperty("renderMode")) {
      const rm: string = vf.renderMode.toString();
      switch (rm.toLowerCase().trim()) {
        case "wireframe":
          vfo.setRenderMode(RenderMode.Wireframe);
          break;
        case "hiddenline":
          vfo.setRenderMode(RenderMode.HiddenLine);
          break;
        case "solidfill":
          vfo.setRenderMode(RenderMode.SolidFill);
          break;
        case "smoothshade":
          vfo.setRenderMode(RenderMode.SmoothShade);
          break;
        case "0":
          vfo.setRenderMode(RenderMode.Wireframe);
          break;
        case "3":
          vfo.setRenderMode(RenderMode.HiddenLine);
          break;
        case "4":
          vfo.setRenderMode(RenderMode.SolidFill);
          break;
        case "6":
          vfo.setRenderMode(RenderMode.SmoothShade);
          break;
      }
    }
  }
  return vfo;
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
  let extString = "";
  if (curRenderOpts.disabledExtensions) curRenderOpts.disabledExtensions.forEach((ext) => {
    switch (ext) {
      case "WEBGL_draw_buffers":
        extString += "-drawBuf";
        break;
      case "OES_element_index_uint":
        extString += "-unsignedInt";
        break;
      case "OES_texture_float":
        extString += "-texFloat";
        break;
      case "OES_texture_half_float":
        extString += "-texHalfFloat";
        break;
      case "WEBGL_depth_texture":
        extString += "-depthTex";
        break;
      case "EXT_color_buffer_float":
        extString += "-floats";
        break;
      case "EXT_shader_texture_lod":
        extString += "-texLod";
        break;
      case "ANGLE_instanced_arrays":
        extString += "-instArrays";
        break;
      default:
        extString += "-" + ext;
        break;
    }
  });
  // if (curRenderOpts.enableOptimizedSurfaceShaders) extString += "+optSurf";
  return extString;
}

function getTileProps(): string {
  let tilePropsStr = "";
  if (curTileProps.disableThrottling) tilePropsStr += "+throt";
  if (curTileProps.elideEmptyChildContentRequests) tilePropsStr += "+elide";
  if (curTileProps.enableInstancing) tilePropsStr += "+inst";
  if (curTileProps.maxActiveRequests && curTileProps.maxActiveRequests !== 10) tilePropsStr += "+max" + curTileProps.maxActiveRequests;
  if (curTileProps.retryInterval) tilePropsStr += "+retry" + curTileProps.retryInterval;
  return tilePropsStr;
}

function getViewFlagsString(): string {
  const vf = activeViewState.viewState!.displayStyle.viewFlags;
  let vfString = "";
  if (!vf.dimensions) vfString += "-dim";
  if (!vf.patterns) vfString += "-pat";
  if (!vf.weights) vfString += "-wt";
  if (!vf.styles) vfString += "-sty";
  if (!vf.transparency) vfString += "-trn";
  if (!vf.fill) vfString += "-fll";
  if (!vf.textures) vfString += "-txt";
  if (!vf.materials) vfString += "-mat";
  if (vf.visibleEdges) vfString += "+vsE";
  if (vf.hiddenEdges) vfString += "+hdE";
  if (vf.sourceLights) vfString += "+scL";
  if (vf.cameraLights) vfString += "+cmL";
  if (vf.solarLight) vfString += "+slL";
  if (vf.shadows) vfString += "+shd";
  if (!vf.clipVolume) vfString += "-clp";
  if (vf.constructions) vfString += "+con";
  if (vf.monochrome) vfString += "+mno";
  if (vf.noGeometryMap) vfString += "+noG";
  if (vf.backgroundMap) vfString += "+bkg";
  if (vf.hLineMaterialColors) vfString += "+hln";
  if (vf.edgeMask === 1) vfString += "+genM";
  if (vf.edgeMask === 2) vfString += "+useM";
  if (vf.ambientOcclusion) vfString += "+ao";
  if (vf.forceSurfaceDiscard) vfString += "+fsd";
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
  public viewFlags?: ViewFlag.Overrides;
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
      if (prevConfigs.renderOptions) this.renderOptions = prevConfigs.renderOptions;
      if (prevConfigs.tileProps) this.tileProps = prevConfigs.tileProps;
      if (prevConfigs.viewFlags) this.viewFlags = prevConfigs.viewFlags;
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
    if (jsonData.renderOptions) this.renderOptions = jsonData.renderOptions as RenderSystem.Options;
    if (jsonData.tileProps) this.tileProps = jsonData.tileProps as TileAdmin.Props;
    if (jsonData.viewFlags) this.viewFlags = setViewFlagOverrides(jsonData.viewFlags, this.viewFlags);
    this.aoEnabled = undefined !== jsonData.viewFlags && !!jsonData.viewFlags.ambientOcclusion;

    debugPrint("view: " + this.view ? (this.view!.width + "X" + this.view!.height) : "undefined");
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
  const oidcConfig: OidcFrontendClientConfiguration = { clientId, redirectUri, scope: "openid email profile organization imodelhub context-registry-service imodeljs-router reality-data:read" };

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

// Retrieves the configuration for which project and imodel to open from connect-configuration.json file located in the built public folder
async function retrieveProjectConfiguration(): Promise<void> {
  return new Promise<void>((resolve, _reject) => {
    const request: XMLHttpRequest = new XMLHttpRequest();
    request.open("GET", "connect-configuration.json", false);
    request.setRequestHeader("Cache-Control", "no-cache");
    request.onreadystatechange = ((_event: Event) => {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          activeViewState.projectConfig = JSON.parse(request.responseText);
          resolve();
        }
      }
    });
    request.send();
  });
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

    await retrieveProjectConfiguration();
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
    const displayStyleProps = await iModCon.elements.queryProps({ from: DisplayStyleState.sqlName, where: "CodeValue = '" + testConfig.displayStyle + "'" });
    if (displayStyleProps.length >= 1)
      theViewport!.view.setDisplayStyle(new DisplayStyle3dState(displayStyleProps[0] as DisplayStyleProps, iModCon));
  }

  // Set the viewFlags (including the render mode)
  if (undefined !== activeViewState.viewState) {
    activeViewState.viewState.displayStyle.viewFlags.ambientOcclusion = testConfig.aoEnabled;
    if (testConfig.viewFlags)
      testConfig.viewFlags.apply(activeViewState.viewState.displayStyle.viewFlags);
  }

  // Load all tiles
  await waitForTilesToLoad(testConfig.iModelLocation);
}

async function closeIModel(isSnapshot: boolean) {
  debugPrint("start closeIModel" + activeViewState.iModelConnection);
  if (activeViewState.iModelConnection) {
    if (isSnapshot)
      await activeViewState.iModelConnection.closeSnapshot();
    else {
      await activeViewState.iModelConnection!.close();
    }
  }
  debugPrint("end closeIModel");
}

// Restart the IModelApp if either the TileAdmin.Props or the Render.Options has changed
function restartIModelApp(testConfig: DefaultConfigs) {
  const newRenderOpts: RenderSystem.Options = testConfig.renderOptions ? testConfig.renderOptions : {};
  const newTileProps: TileAdmin.Props = testConfig.tileProps ? testConfig.tileProps : {};
  if (IModelApp.initialized) {
    if (curTileProps.disableThrottling !== newTileProps.disableThrottling || curTileProps.elideEmptyChildContentRequests !== newTileProps.elideEmptyChildContentRequests
      || curTileProps.enableInstancing !== newTileProps.enableInstancing || curTileProps.maxActiveRequests !== newTileProps.maxActiveRequests || curTileProps.retryInterval !== newTileProps.retryInterval
      /*|| curRenderOpts.enableOptimizedSurfaceShaders !== newRenderOpts.enableOptimizedSurfaceShaders*/ || ((curRenderOpts.disabledExtensions ? curRenderOpts.disabledExtensions.length : 0) !== (newRenderOpts.disabledExtensions ? newRenderOpts.disabledExtensions.length : 0))) {
      if (theViewport) {
        theViewport.dispose();
        theViewport = undefined;
      }
      IModelApp.shutdown();
    } else if (curRenderOpts.disabledExtensions !== newRenderOpts.disabledExtensions) {
      for (let i = 0; i < (curRenderOpts.disabledExtensions ? curRenderOpts.disabledExtensions.length : 0); i++) {
        if (curRenderOpts.disabledExtensions && newRenderOpts.disabledExtensions && curRenderOpts.disabledExtensions[i] !== newRenderOpts.disabledExtensions[i]) {
          if (theViewport) {
            theViewport.dispose();
            theViewport = undefined;
          }
          IModelApp.shutdown();
          break;
        }
      }
    }
  }
  curRenderOpts = newRenderOpts;
  curTileProps = newTileProps;
  if (!IModelApp.initialized) {
    IModelApp.tileAdmin = TileAdmin.create(curTileProps);
    DisplayPerfTestApp.startup(undefined, testConfig.renderOptions);
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
    for (let i = 0; i < 15; ++i) {
      theViewport!.sync.setRedrawPending();
      theViewport!.renderFrame();
    }

    // Turn on performance metrics to start collecting data when we render things
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false);

    // Add a pause so that user can start the GPU Performance Capture program
    // await resolveAfterXMilSeconds(7000);

    const finalFrameTimings: Array<Map<string, number>> = [];
    const numToRender = 50;
    if (testConfig.testType === "readPixels") {
      const width = testConfig.view!.width;
      const height = testConfig.view!.height;
      const viewRect = new ViewRect(0, 0, width, height);
      const testReadPix = async (pixSelect: Pixel.Selector, pixSelectStr: string) => {
        for (let i = 0; i < numToRender; ++i) {
          theViewport!.readPixels(viewRect, pixSelect, (_pixels) => { return; });
          finalFrameTimings[i] = (theViewport!.target as Target).performanceMetrics!.frameTimings;
          finalFrameTimings[i].delete("Scene Time");
        }
        const rowData = getRowData(finalFrameTimings, testConfig, pixSelectStr);
        await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData);
      };
      // Test each combo of pixel selectors
      await testReadPix(Pixel.Selector.Feature, "+feature");
      await testReadPix(Pixel.Selector.GeometryAndDistance, "+geom+dist");
      await testReadPix(Pixel.Selector.All, "+feature+geom+dist");

      // Create images from the elementID, depth (i.e. distance), and type (i.e. order)
      if (theViewport && theViewport.canvas) {
        const ctx = theViewport.canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, theViewport.canvas.width, theViewport.canvas.height);
          const elemIdImgData = ctx.createImageData(width, height);
          const depthImgData = ctx.createImageData(width, height);
          const typeImgData = ctx.createImageData(width, height);

          theViewport.readPixels(viewRect, Pixel.Selector.All, (pixels) => {
            if (undefined === pixels)
              return;
            for (let y = viewRect.top; y < viewRect.bottom; ++y) {
              for (let x = viewRect.left; x < viewRect.right; ++x) {
                const index = (x * 4) + (y * 4 * viewRect.right);
                const pixel = pixels.getPixel(x, y);
                // // RGB for element ID
                const elemId = Id64.getLowerUint32(pixel.elementId ? pixel.elementId : "");
                elemIdImgData.data[index + 0] = elemId % 256;
                elemIdImgData.data[index + 1] = (Math.floor(elemId / 256)) % 256;
                elemIdImgData.data[index + 2] = (Math.floor(elemId / (256 ^ 2))) % 256;
                // RGB for Depth
                const distColor = pixels.getPixel(x, y).distanceFraction * 255;
                const type = pixels.getPixel(x, y).type;
                depthImgData.data[index + 0] = depthImgData.data[index + 1] = depthImgData.data[index + 2] = distColor;
                // RGB for type
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
                // Alpha for all - set to 100% opaque
                elemIdImgData.data[index + 3] = depthImgData.data[index + 3] = typeImgData.data[index + 3] = 255;
              }
            }
            return;
          });
          ctx.putImageData(elemIdImgData, 0, 0);
          await savePng(getImageString(testConfig, "elemId_"));
          ctx.putImageData(depthImgData, 0, 0);
          await savePng(getImageString(testConfig, "depth_"));
          ctx.putImageData(typeImgData, 0, 0);
          await savePng(getImageString(testConfig, "type_"));
        }
      }
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
  const viewIds = await state.iModelConnection!.elements.queryIds({ from: ViewState.sqlName, where: "CodeValue = '" + viewName + "'" });
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
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test", OpenMode.Readonly));
  }

  // ###TODO: Raman added one-time initialization logic IModelApp.startup which replaces a couple of RpcRequest-related functions.
  // Cheap hacky workaround until that's fixed.
  DisplayPerfTestApp.startup();

  main(); // tslint:disable-line:no-floating-promises
};
