/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import {
  ClientRequestContext, Dictionary, Id64, Id64Arg, Id64String, OpenMode, ProcessDetector, SortedArray, StopWatch,
} from "@bentley/bentleyjs-core";
import { Project } from "@bentley/context-registry-client";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { BrowserAuthorizationClient, BrowserAuthorizationClientConfiguration } from "@bentley/frontend-authorization-client";
import { HubIModel } from "@bentley/imodelhub-client";
import {
  BackgroundMapProps, BackgroundMapType, BentleyCloudRpcManager, ColorDef, DisplayStyleProps, FeatureAppearance, FeatureAppearanceProps, Hilite,
  IModelReadRpcInterface, IModelTileRpcInterface, RenderMode, RpcConfiguration, SnapshotIModelRpcInterface, ViewDefinitionProps,
} from "@bentley/imodeljs-common";
import {
  AuthorizedFrontendRequestContext, DisplayStyle3dState, DisplayStyleState, EntityState, FeatureOverrideProvider, FeatureSymbology,
  FrontendRequestContext, GLTimerResult, IModelApp, IModelAppOptions, IModelConnection, NativeAppAuthorization, PerformanceMetrics, Pixel,
  RenderSystem, ScreenViewport, SnapshotConnection, Target, TileAdmin, Viewport, ViewRect, ViewState,
} from "@bentley/imodeljs-frontend";
import { System } from "@bentley/imodeljs-frontend/lib/webgl";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { AccessToken } from "@bentley/itwin-client";
import { ProjectShareClient, ProjectShareFile, ProjectShareFileQuery, ProjectShareFolderQuery } from "@bentley/projectshare-client";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { initializeIModelHub } from "./ConnectEnv";
import { IModelApi } from "./IModelApi";

let curRenderOpts: RenderSystem.Options = {}; // Keep track of the current render options (disabled webgl extensions and enableOptimizedSurfaceShaders flag)
let curTileProps: TileAdmin.Props = {}; // Keep track of whether or not instancing has been enabled
let gpuFramesCollected = 0; // Keep track of how many gpu timings we have collected
const fixed = 4; // The number of decimal places the csv file should save for each data point
const testNamesImages = new Map<string, number>(); // Keep track of test names and how many duplicate names exist for images
const testNamesTimings = new Map<string, number>(); // Keep track of test names and how many duplicate names exist for timings
const defaultHilite = new Hilite.Settings();
const defaultEmphasis = new Hilite.Settings(ColorDef.black, 0, 0, Hilite.Silhouette.Thick);
const rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];

let minimize = false;
interface Options {
  [key: string]: any; // Add index signature
}

interface ConnectProjectConfiguration {
  projectName: string;
  iModelName: string;
}

// Retrieve default config data from json file
async function getDefaultConfigs(): Promise<string> {
  return DisplayPerfRpcInterface.getClient().getDefaultConfigs();
}

async function saveCsv(outputPath: string, outputName: string, rowData: Map<string, number | string>, csvFormat?: string): Promise<void> {
  return DisplayPerfRpcInterface.getClient().saveCsv(outputPath, outputName, JSON.stringify([...rowData]), csvFormat);
}

async function writeExternalFile(outputPath: string, outputName: string, append: boolean, content: string): Promise<void> {
  return DisplayPerfRpcInterface.getClient().writeExternalFile(outputPath, outputName, append, content);
}

async function consoleLog(content: string): Promise<void> {
  return DisplayPerfRpcInterface.getClient().consoleLog(content);
}

const wantConsoleOutput: boolean = false;
function debugPrint(msg: string): void {
  if (wantConsoleOutput)
    console.log(msg); // eslint-disable-line no-console
}

async function resolveAfterXMilSeconds(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/**
 * See https://stackoverflow.com/questions/26246601/wildcard-string-comparison-in-javascript
 * Compare strToTest with a given rule containing a wildcard, and will return true if strToTest matches the given wildcard
 * Make sure it is case-insensitive
 */
function matchRule(strToTest: string, rule: string) {
  strToTest = strToTest.toLowerCase();
  rule = rule.toLowerCase();
  const escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp(`^${rule.split("*").map(escapeRegex).join(".*")}$`).test(strToTest);
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
  while (combined.endsWith("\\") || combined.endsWith("/"))
    combined = combined.slice(0, -1);
  if (additionalPath[0] !== "\\" && additionalPath[0] !== "/")
    combined += "\\";
  combined += additionalPath;
  return combined;
}

function getBrowserName(userAgent: string) {
  const lowUserAgent = userAgent.toLowerCase();
  if (lowUserAgent.includes("electron"))
    return "Electron";
  if (lowUserAgent.includes("firefox"))
    return "FireFox";
  if (lowUserAgent.includes("edge"))
    return "Edge";
  if (lowUserAgent.includes("chrome") && !userAgent.includes("chromium"))
    return "Chrome";
  if (lowUserAgent.includes("safari") && !userAgent.includes("chrome") && !userAgent.includes("chromium"))
    return "Safari";
  return "Unknown";
}

class DisplayPerfTestApp {
  public static async startup(iModelApp?: IModelAppOptions): Promise<void> {
    iModelApp = iModelApp ?? {};
    iModelApp.i18n = { urlTemplate: "locales/en/{{ns}}.json" } as I18NOptions;
    iModelApp.rpcInterfaces = rpcInterfaces;
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp });
    else
      await IModelApp.startup(iModelApp);
    IModelApp.animationInterval = undefined;
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
        if (value) {
          for (const ext of value) {
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
              case "EXT_frag_depth":
                optString += "-fragDepth";
                break;
              default:
                optString += `-${ext}`;
                break;
            }
          }
        }
        break;
      // case "enableOptimizedSurfaceShaders": // No longer supported
      //   if (value) optString += "+optSurf";
      //   break;
      // case "cullAgainstActiveVolume": // No longer supported
      //   if (value) optString += "+cullActVol";
      //   break;
      case "preserveShaderSourceCode":
        if (value) optString += "+shadeSrc";
        break;
      case "displaySolarShadows":
        if (!value) optString += "-solShd";
        break;
      case "logarithmicZBuffer":
        if (value) optString += "+logZBuf";
        break;
      case "useWebGL2":
        if (value) optString += "+webGL2";
        break;
      case "antialiasSamples":
        if (value > 1) optString += `+aa${value as number}`;
        break;
      default:
        if (value) optString += `+${key}`;
    }
  }
  return optString;
}

function getTileProps(): string {
  let tilePropsStr = "";
  for (const [key, value] of Object.entries(curTileProps)) {
    switch (key) {
      // case "disableThrottling": // No longer supported
      //   if (value) tilePropsStr += "-throt";
      //   break;
      case "elideEmptyChildContentRequests":
        if (value) tilePropsStr += "+elide";
        break;
      case "enableInstancing":
        if (value) tilePropsStr += "+inst";
        break;
      case "maxActiveRequests":
        if (value !== 10) tilePropsStr += `+max${value}`;
        break;
      case "retryInterval":
        if (value) tilePropsStr += `+retry${value}`;
        break;
      case "disableMagnification":
        if (value) tilePropsStr += "-mag";
        break;
      default:
        if (value) tilePropsStr += `+${key}`;
    }
  }
  return tilePropsStr;
}

function getBackgroundMapProps(): string {
  let bmPropsStr = "";
  const bmProps = activeViewState.viewState!.displayStyle.settings.backgroundMap;
  switch (bmProps.providerName) {
    case "BingProvider":
      break;
    case "MapBoxProvider":
      bmPropsStr += "MapBox";
      break;
    default:
      bmPropsStr += bmProps.providerName;
      break;
  }
  switch (bmProps.mapType) {
    case BackgroundMapType.Hybrid:
      break;
    case BackgroundMapType.Aerial:
      bmPropsStr += "+aer";
      break;
    case BackgroundMapType.Street:
      bmPropsStr += "+st";
      break;
    default:
      bmPropsStr += `+type${bmProps.mapType}`;
      break;
  }
  if (bmProps.groundBias !== 0) bmPropsStr += `+bias${bmProps.groundBias}`;
  if (bmProps.applyTerrain) bmPropsStr += "+terr";
  if (bmProps.useDepthBuffer) bmPropsStr += "+depth";
  if (typeof (bmProps.transparency) === "number") bmPropsStr += `+trans${bmProps.transparency}`;
  return bmPropsStr;
}

function hiliteSettingsStr(settings: Hilite.Settings): string {
  let hsStr = (settings.color.colors.r * 256 * 256 + settings.color.colors.g * 256 + settings.color.colors.b).toString(36).padStart(5, "0");
  hsStr += (settings.silhouette * 256 * 256 + Math.round(settings.visibleRatio * 255) * 256 + Math.round(settings.hiddenRatio * 255)).toString(36).padStart(4, "0");
  return hsStr.toUpperCase();
}

function getOtherProps(): string {
  let propsStr = "";
  if (undefined !== theViewport!.hilite) {
    if (!Hilite.equalSettings(theViewport!.hilite, defaultHilite))
      propsStr += `+h${hiliteSettingsStr(theViewport!.hilite)}`;
  }
  if (undefined !== theViewport!.emphasisSettings) {
    if (!Hilite.equalSettings(theViewport!.emphasisSettings, defaultEmphasis))
      propsStr += `+e${hiliteSettingsStr(theViewport!.emphasisSettings)}`;
  }
  return propsStr;
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
        if (value) vfString += `+${key}`;
    }
  }
  if (undefined !== activeViewState.overrideElements)
    vfString += "+ovrEl";
  if (undefined !== activeViewState.selectedElements)
    vfString += "+selEl";
  return vfString;
}

/* A formatted string containing the Ids of all the tiles that were selected for display by the last call to waitForTilesToLoad(), of the format:
 *  Selected Tiles:
 *    TreeId1: tileId1,tileId2,...
 *    TreeId2: tileId1,tileId2,...
 *    ...
 * Sorted by tree Id and then by tile Id so that the output is consistent from run to run unless the set of selected tiles changed between runs.
 */
let formattedSelectedTileIds = "Selected tiles:\n";
function formatSelectedTileIds(vp: Viewport): void {
  formattedSelectedTileIds = "Selected tiles:\n";
  const dict = new Dictionary<string, SortedArray<string>>((lhs, rhs) => lhs.localeCompare(rhs));
  for (const viewport of [vp, ...vp.view.secondaryViewports]) {
    const selected = IModelApp.tileAdmin.getTilesForViewport(viewport)?.selected;
    if (!selected)
      continue;

    for (const tile of selected) {
      const treeId = tile.tree.id;
      let tileIds = dict.get(treeId);
      if (!tileIds)
        dict.set(treeId, tileIds = new SortedArray<string>((lhs, rhs) => lhs.localeCompare(rhs)));

      tileIds.insert(tile.contentId);
    }
  }

  if (dict.size === 0)
    return;

  for (const kvp of dict) {
    const contentIds = kvp.value.extractArray().join(",");
    const line = `  ${kvp.key}: ${contentIds}`;
    formattedSelectedTileIds = `${formattedSelectedTileIds}${line}\n`;
  }
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
    theViewport!.requestRedraw();
    theViewport!.invalidateScene();
    theViewport!.renderFrame();

    // The scene is ready when (1) all required TileTree roots have been created and (2) all required tiles have finished loading
    const sceneContext = theViewport!.createSceneContext();
    activeViewState.viewState!.createScene(sceneContext);
    sceneContext.requestMissingTiles();
    haveNewTiles = !(activeViewState.viewState!.areAllTileTreesLoaded) || sceneContext.hasMissingTiles || 0 < sceneContext.missingTiles.size;

    if (!haveNewTiles) {
      // ViewAttachments and 3d section drawing attachments render to separate off-screen viewports. Check those too.
      for (const secondaryVp of activeViewState.viewState!.secondaryViewports) {
        if (secondaryVp.numRequestedTiles > 0) {
          haveNewTiles = true;
          break;
        }

        const secondaryTiles = IModelApp.tileAdmin.getTilesForViewport(secondaryVp);
        if (secondaryTiles && secondaryTiles.external.requested > 0) {
          haveNewTiles = true;
          break;
        }
      }
    }

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

  // Record the Ids of all the tiles that were selected for display.
  formatSelectedTileIds(theViewport!);
}

// ###TODO this should be using Viewport.devicePixelRatio.
function queryDevicePixelRatio(): number {
  if (false === IModelApp.renderSystem.options.dpiAwareViewports)
    return 1;

  return window.devicePixelRatio || 1;
}

// ###TODO This should be going through Viewport.cssPixelsToDevicePixels().
function cssPixelsToDevicePixels(css: number): number {
  return Math.floor(css * queryDevicePixelRatio());
}

function getRowData(finalFrameTimings: Array<Map<string, number>>, finalGPUFrameTimings: Map<string, number[]>, timingsForActualFPS: Array<Map<string, number>>, configs: DefaultConfigs, pixSelectStr?: string): Map<string, number | string> {
  const rowData = new Map<string, number | string>();
  rowData.set("iModel", configs.iModelName!);
  rowData.set("View", configs.viewName!);
  const w = cssPixelsToDevicePixels(configs.view!.width);
  const h = cssPixelsToDevicePixels(configs.view!.height);
  rowData.set("Screen Size", `${w}X${h}`);
  rowData.set("Skip & Time Renders", `${configs.numRendersToSkip} & ${configs.numRendersToTime}`);
  rowData.set("Display Style", activeViewState.viewState!.displayStyle.name);
  rowData.set("Render Mode", getRenderMode());
  rowData.set("View Flags", getViewFlagsString() !== "" ? ` ${getViewFlagsString()}` : "");
  rowData.set("Render Options", getRenderOpts() !== "" ? ` ${getRenderOpts()}` : "");
  rowData.set("Tile Props", getTileProps() !== "" ? ` ${getTileProps()}` : "");
  rowData.set("Bkg Map Props", getBackgroundMapProps() !== "" ? ` ${getBackgroundMapProps()}` : "");
  if (getOtherProps() !== "") rowData.set("Other Props", ` ${getOtherProps()}`);
  if (pixSelectStr) rowData.set("ReadPixels Selector", ` ${pixSelectStr}`);
  rowData.set("Test Name", getTestName(configs));
  rowData.set("Browser", getBrowserName(IModelApp.queryRenderCompatibility().userAgent));
  if (!minimize) rowData.set("Tile Loading Time", curTileLoadingTime);

  const setGpuData = (name: string) => {
    if (name === "CPU Total Time")
      name = "Total";
    const gpuDataArray = finalGPUFrameTimings.get(name);
    if (gpuDataArray) {
      let gpuSum = 0;
      for (const gpuData of gpuDataArray)
        gpuSum += gpuData;
      rowData.set(`GPU-${name}`, gpuDataArray.length ? (gpuSum / gpuDataArray.length).toFixed(fixed) : gpuSum.toFixed(fixed));
    }
  };

  // Calculate average timings
  if (pixSelectStr) { // timing read pixels
    for (const colName of finalFrameTimings[0].keys()) {
      let sum = 0;
      finalFrameTimings.forEach((timing) => {
        const data = timing.get(colName);
        sum += data ? data : 0;
      });
      if (!minimize || (minimize && colName === "CPU Total Time")) {
        rowData.set(colName, (sum / finalFrameTimings.length).toFixed(fixed));
        setGpuData(colName);
      }
    }
  } else { // timing render frame
    for (const colName of finalFrameTimings[0].keys()) {
      let sum = 0;
      finalFrameTimings.forEach((timing) => {
        const data = timing.get(colName);
        sum += data ? data : 0;
      });
      if (!minimize || (minimize && colName === "CPU Total Time")) {
        rowData.set(colName, sum / finalFrameTimings.length);
        setGpuData(colName);
      }
    }
  }

  let totalTime: number;
  if (rowData.get("Finish GPU Queue")) { // If we can't collect GPU data, get non-interactive total time with 'Finish GPU Queue' time
    totalTime = Number(rowData.get("CPU Total Time")) + Number(rowData.get("Finish GPU Queue"));
    rowData.set("Non-Interactive Total Time", totalTime);
    rowData.set("Non-Interactive FPS", totalTime > 0.0 ? (1000.0 / totalTime).toFixed(fixed) : "0");
  }

  // Get these values from the timingsForActualFPS -- timingsForActualFPS === finalFrameTimings, unless in readPixels mode
  let totalRenderTime = 0;
  totalTime = 0;
  for (const time of timingsForActualFPS) {
    let timing = time.get("CPU Total Time");
    totalRenderTime += timing ? timing : 0;
    timing = time.get("Total Time");
    totalTime += timing ? timing : 0;
  }
  rowData.delete("Total Time");
  totalRenderTime /= timingsForActualFPS.length;
  totalTime /= timingsForActualFPS.length;
  const totalGpuTime = Number(rowData.get("GPU-Total"));
  if (totalGpuTime) {
    const gpuBound = totalGpuTime > totalRenderTime;
    const effectiveFps = 1000.0 / (gpuBound ? totalGpuTime : totalRenderTime);
    rowData.delete("GPU-Total");
    rowData.set("GPU Total Time", totalGpuTime.toFixed(fixed)); // Change the name of this column & change column order
    rowData.set("Bound By", gpuBound ? (effectiveFps < 60.0 ? "gpu" : "gpu ?") : "cpu *");
    rowData.set("Effective Total Time", gpuBound ? totalGpuTime.toFixed(fixed) : totalRenderTime.toFixed(fixed)); // This is the total gpu time if gpu bound or the total cpu time if cpu bound; times gather with running continuously
    rowData.set("Effective FPS", effectiveFps.toFixed(fixed));
  }
  rowData.set("Actual Total Time", totalTime.toFixed(fixed));
  rowData.set("Actual FPS", totalTime > 0.0 ? (1000.0 / totalTime).toFixed(fixed) : "0");

  return rowData;
}

function removeOptsFromString(input: string, ignore: string[] | string | undefined): string {
  if (ignore === undefined)
    return input;
  let output = input;
  if (!(ignore instanceof Array))
    ignore = ignore.split(" ");
  ignore.forEach((del: string) => {
    if (del === "+max")
      output = output.replace(/\+max\d+/, "");
    else
      output = output.replace(del, "");
  });
  output = output.replace(/__+/, "_");
  if (output[output.length - 1] === "_")
    output = output.slice(0, output.length - 1);
  return output;
}

function getImageString(configs: DefaultConfigs, prefix = ""): string {
  const filename = `${getTestName(configs, prefix, true)}.png`;
  if (ProcessDetector.isMobileAppFrontend)
    return filename; // skip path for mobile - we use device's Documents path as determined by mobile backend
  return path.join(configs.outputPath ? configs.outputPath : "", filename);
}

function getTestName(configs: DefaultConfigs, prefix?: string, isImage = false, ignoreDupes = false): string {
  let testName = "";
  if (prefix) testName += prefix;
  testName += configs.iModelName ? configs.iModelName.replace(/\.[^/.]+$/, "") : "";
  testName += configs.viewName ? `_${configs.viewName}` : "";
  testName += configs.displayStyle ? `_${configs.displayStyle.trim()}` : "";
  testName += getRenderMode() !== "" ? `_${getRenderMode()}` : "";
  testName += getViewFlagsString() !== "" ? `_${getViewFlagsString()}` : "";
  testName += getRenderOpts() !== "" ? `_${getRenderOpts()}` : "";
  testName += getTileProps() !== "" ? `_${getTileProps()}` : "";
  testName += getBackgroundMapProps() !== "" ? `_${getBackgroundMapProps()}` : "";
  testName += getOtherProps() !== "" ? `_${getOtherProps()}` : "";
  testName = removeOptsFromString(testName, configs.filenameOptsToIgnore);
  if (!ignoreDupes) {
    let testNum = isImage ? testNamesImages.get(testName) : testNamesTimings.get(testName);
    if (testNum === undefined)
      testNum = 0;
    testName += (testNum > 1) ? (`---${testNum}`) : "";
  }
  return testName;
}

function updateTestNames(configs: DefaultConfigs, prefix?: string, isImage = false) {
  const testNames = isImage ? testNamesImages : testNamesTimings;
  let testNameDupes = testNames.get(getTestName(configs, prefix, false, true));
  if (testNameDupes === undefined) testNameDupes = 0;
  testNames.set(getTestName(configs, prefix, false, true), testNameDupes + 1);
}

async function savePng(fileName: string, canvas?: HTMLCanvasElement): Promise<void> {
  if (!canvas) canvas = theViewport !== undefined ? theViewport.readImageToCanvas() : undefined;
  if (canvas !== undefined) {
    const img = canvas.toDataURL("image/png"); // System.instance.canvas.toDataURL("image/png");
    const data = img.replace(/^data:image\/\w+;base64,/, ""); // strip off the data: url prefix to get just the base64-encoded bytes
    return DisplayPerfRpcInterface.getClient().savePng(fileName, data);
  }
}

class ViewSize {
  public width: number;
  public height: number;

  constructor(w = 0, h = 0) { this.width = w; this.height = h; }
}

type TestType = "timing" | "readPixels" | "image" | "both";

class DefaultConfigs {
  public view?: ViewSize;
  public numRendersToTime?: number;
  public numRendersToSkip?: number;
  public outputName?: string;
  public outputPath?: string;
  public iModelLocation?: string;
  public iModelName?: string;
  public iModelHubProject?: string;
  public csvFormat?: string;
  public filenameOptsToIgnore?: string[] | string;
  public viewName?: string;
  public extViewName?: string;
  public viewStatePropsString?: string;
  public overrideElements?: any[];
  public selectedElements?: Id64Arg;
  public testType?: TestType;
  public displayStyle?: string;
  public viewFlags?: any; // ViewFlags, except we want undefined for anything not specifically set
  public backgroundMap?: BackgroundMapProps;
  public renderOptions: RenderSystem.Options = {};
  public tileProps?: TileAdmin.Props;
  public hilite?: Hilite.Settings;
  public emphasis?: Hilite.Settings;
  public savedViewType?: string;

  public constructor(jsonData: any, prevConfigs?: DefaultConfigs, useDefaults = false) {
    if (useDefaults) {
      this.view = new ViewSize(1000, 1000);
      this.numRendersToTime = 100;
      this.numRendersToSkip = 50;
      this.outputName = "performanceResults.csv";
      this.outputPath = ProcessDetector.isMobileAppFrontend ? undefined : "D:\\output\\performanceData\\";
      this.iModelName = "*";
      this.iModelHubProject = "iModel Testing";
      this.viewName = "*"; // If no view is specified, test all views
      this.testType = "timing";
      this.csvFormat = "original";
      this.renderOptions = { useWebGL2: true, dpiAwareLOD: true };
      this.savedViewType = "both";
    }
    if (prevConfigs !== undefined) {
      if (prevConfigs.view) this.view = new ViewSize(prevConfigs.view.width, prevConfigs.view.height);
      if (prevConfigs.numRendersToTime) this.numRendersToTime = prevConfigs.numRendersToTime;
      if (prevConfigs.numRendersToSkip) this.numRendersToSkip = prevConfigs.numRendersToSkip;
      if (prevConfigs.outputName) this.outputName = prevConfigs.outputName;
      if (prevConfigs.outputPath) this.outputPath = prevConfigs.outputPath;
      if (prevConfigs.iModelLocation) this.iModelLocation = prevConfigs.iModelLocation;
      if (prevConfigs.iModelName) this.iModelName = prevConfigs.iModelName;
      if (prevConfigs.iModelHubProject) this.iModelHubProject = prevConfigs.iModelHubProject;
      if (prevConfigs.csvFormat) this.csvFormat = prevConfigs.csvFormat;
      if (prevConfigs.filenameOptsToIgnore) this.filenameOptsToIgnore = prevConfigs.filenameOptsToIgnore;
      if (prevConfigs.viewName) this.viewName = prevConfigs.viewName;
      if (prevConfigs.viewStatePropsString) this.viewStatePropsString = prevConfigs.viewStatePropsString;
      if (prevConfigs.testType) this.testType = prevConfigs.testType;
      if (prevConfigs.savedViewType) this.savedViewType = prevConfigs.savedViewType;
      if (prevConfigs.displayStyle) this.displayStyle = prevConfigs.displayStyle;
      this.renderOptions = this.updateData(prevConfigs.renderOptions, this.renderOptions) as RenderSystem.Options || undefined;
      this.tileProps = this.updateData(prevConfigs.tileProps, this.tileProps) as TileAdmin.Props || undefined;
      this.viewFlags = this.updateData(prevConfigs.viewFlags, this.viewFlags);
      this.backgroundMap = this.updateData(prevConfigs.backgroundMap, this.backgroundMap) as BackgroundMapProps || undefined;
      if (undefined !== prevConfigs.hilite)
        this.hilite = Hilite.cloneSettings(prevConfigs.hilite);
      if (undefined !== prevConfigs.emphasis)
        this.emphasis = Hilite.cloneSettings(prevConfigs.emphasis);
    } else if (jsonData.argOutputPath)
      this.outputPath = jsonData.argOutputPath;
    if (jsonData.view) this.view = new ViewSize(jsonData.view.width, jsonData.view.height);
    if (jsonData.numRendersToTime) this.numRendersToTime = jsonData.numRendersToTime;
    if (jsonData.numRendersToSkip) this.numRendersToSkip = jsonData.numRendersToSkip;
    if (jsonData.outputName) this.outputName = jsonData.outputName;
    if (jsonData.outputPath) this.outputPath = combineFilePaths(jsonData.outputPath, this.outputPath);
    if (jsonData.iModelLocation) this.iModelLocation = combineFilePaths(jsonData.iModelLocation, this.iModelLocation);
    if (jsonData.iModelName) this.iModelName = jsonData.iModelName;
    if (jsonData.iModelHubProject) this.iModelHubProject = jsonData.iModelHubProject;
    if (jsonData.csvFormat) this.csvFormat = jsonData.csvFormat;
    if (jsonData.filenameOptsToIgnore) this.filenameOptsToIgnore = jsonData.filenameOptsToIgnore;
    if (jsonData.viewName)
      this.viewName = jsonData.viewName;
    if (jsonData.extViewName)
      this.viewName = jsonData.extViewName;
    if (jsonData.savedViewType) this.savedViewType = jsonData.savedViewType;
    if (jsonData.viewString) {
      // If there is a viewString, put its name in the viewName property so that it gets used in the filename, etc.
      this.viewName = jsonData.viewString._name;
      this.viewStatePropsString = jsonData.viewString._viewStatePropsString;
      if (undefined !== jsonData.viewString._overrideElements)
        this.overrideElements = JSON.parse(jsonData.viewString._overrideElements) as any[];
      if (undefined !== jsonData.viewString._selectedElements)
        this.selectedElements = JSON.parse(jsonData.viewString._selectedElements) as Id64Arg;
    }
    if (jsonData.testType) this.testType = jsonData.testType;
    if (jsonData.displayStyle) this.displayStyle = jsonData.displayStyle;
    this.renderOptions = this.updateData(jsonData.renderOptions, this.renderOptions) as RenderSystem.Options || undefined;
    this.tileProps = this.updateData(jsonData.tileProps, this.tileProps) as TileAdmin.Props || undefined;
    this.viewFlags = this.updateData(jsonData.viewFlags, this.viewFlags); // as ViewFlags || undefined;
    this.backgroundMap = this.updateData(jsonData.backgroundMap, this.backgroundMap) as BackgroundMapProps || undefined;
    if (jsonData.hilite) {
      if (undefined === this.hilite)
        this.hilite = Hilite.cloneSettings(defaultHilite);
      const colors = this.hilite.color.colors;
      let visibleRatio = this.hilite.visibleRatio;
      let hiddenRatio = this.hilite.hiddenRatio;
      let silhouette = this.hilite.silhouette;
      if (undefined !== jsonData.hilite.red)
        colors.r = jsonData.hilite.red;
      if (undefined !== jsonData.hilite.green)
        colors.g = jsonData.hilite.green;
      if (undefined !== jsonData.hilite.blue)
        colors.b = jsonData.hilite.blue;
      if (undefined !== jsonData.hilite.visibleRatio)
        visibleRatio = jsonData.hilite.visibleRatio;
      if (undefined !== jsonData.hilite.hiddenRatio)
        hiddenRatio = jsonData.hilite.hiddenRatio;
      if (undefined !== jsonData.hilite.silhouette)
        silhouette = jsonData.hilite.silhouette;
      this.hilite = new Hilite.Settings(ColorDef.from(colors.r, colors.g, colors.b, 0), visibleRatio, hiddenRatio, silhouette);
    }
    if (jsonData.emphasis) {
      if (undefined === this.emphasis)
        this.emphasis = Hilite.cloneSettings(defaultEmphasis);
      const colors = this.emphasis.color.colors;
      let visibleRatio = this.emphasis.visibleRatio;
      let hiddenRatio = this.emphasis.hiddenRatio;
      let silhouette = this.emphasis.silhouette;
      if (undefined !== jsonData.emphasis.red)
        colors.r = jsonData.emphasis.red;
      if (undefined !== jsonData.emphasis.green)
        colors.g = jsonData.emphasis.green;
      if (undefined !== jsonData.emphasis.blue)
        colors.b = jsonData.emphasis.blue;
      if (undefined !== jsonData.emphasis.visibleRatio)
        visibleRatio = jsonData.emphasis.visibleRatio;
      if (undefined !== jsonData.emphasis.hiddenRatio)
        hiddenRatio = jsonData.emphasis.hiddenRatio;
      if (undefined !== jsonData.emphasis.silhouette)
        silhouette = jsonData.emphasis.silhouette;
      this.emphasis = new Hilite.Settings(ColorDef.from(colors.r, colors.g, colors.b, 0), visibleRatio, hiddenRatio, silhouette);
    }

    debugPrint(`view: ${this.view !== undefined ? (`${this.view.width}X${this.view.height}`) : "undefined"}`);
    debugPrint(`numRendersToTime: ${this.numRendersToTime}`);
    debugPrint(`numRendersToSkip: ${this.numRendersToSkip}`);
    debugPrint(`outputFile: ${this.outputFile}`);
    debugPrint(`outputName: ${this.outputName}`);
    debugPrint(`outputPath: ${this.outputPath}`);
    debugPrint(`iModelFile: ${this.iModelFile}`);
    debugPrint(`iModelLocation: ${this.iModelLocation}`);
    debugPrint(`iModelName: ${this.iModelName}`);
    debugPrint(`iModelHubProject: ${this.iModelHubProject}`);
    debugPrint(`csvFormat: ${this.csvFormat}`);
    debugPrint(`filenameOptsToIgnore: ${this.filenameOptsToIgnore}`);
    debugPrint(`viewName: ${this.viewName}`);
    debugPrint(`testType: ${this.testType}`);
    debugPrint(`displayStyle: ${this.displayStyle}`);
    debugPrint(`tileProps: ${this.tileProps}`);
    debugPrint(`renderOptions: ${this.renderOptions}`);
    debugPrint(`viewFlags: ${this.viewFlags}`);
    debugPrint(`backgroundMap: ${this.backgroundMap}`);
    debugPrint(`savedViewType: ${this.savedViewType}`);
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
      debugPrint(`lastChar: ${lastChar}`);
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
  public oidcClient?: BrowserAuthorizationClient;
  public externalSavedViews?: any[];
  public overrideElements?: any[];
  public selectedElements?: Id64Arg;
}

class FOProvider implements FeatureOverrideProvider {
  private readonly _elementOvrs = new Map<Id64String, FeatureAppearance>();
  private _defaultOvrs: FeatureAppearance | undefined;
  private readonly _vp: Viewport;

  public constructor(vp: Viewport) { this._vp = vp; }

  public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, _vp: Viewport): void {
    this._elementOvrs.forEach((value, key) => ovrs.overrideElement(key, value));
    if (undefined !== this._defaultOvrs)
      ovrs.setDefaultOverrides(this._defaultOvrs);
  }

  public overrideElementsByArray(elementOvrs: any[]): void {
    elementOvrs.forEach((eo) => {
      const fsa = FeatureAppearance.fromJSON(JSON.parse(eo.fsa) as FeatureAppearanceProps);
      if (eo.id === "-default-")
        this.defaults = fsa;
      else
        this._elementOvrs.set(eo.id, fsa);
    });
    this.sync();
  }

  public clear(): void {
    this._elementOvrs.clear();
    this._defaultOvrs = undefined;
    this.sync();
  }

  public set defaults(value: FeatureAppearance | undefined) {
    this._defaultOvrs = value;
    this.sync();
  }

  private sync(): void { this._vp.setFeatureOverrideProviderChanged(); }

  public static get(vp: Viewport): FOProvider | undefined {
    return vp.findFeatureOverrideProviderOfType<FOProvider>(FOProvider);
  }

  public static remove(vp: Viewport): void {
    const provider = this.get(vp);
    if (provider)
      vp.dropFeatureOverrideProvider(provider);
  }

  public static getOrCreate(vp: Viewport): FOProvider {
    let provider = this.get(vp);
    if (undefined === provider) {
      provider = new FOProvider(vp);
      vp.addFeatureOverrideProvider(provider);
    }

    return provider;
  }
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
    // We must make sure we test the exact same number of pixels regardless of the device pixel ratio
    const pixelRatio = queryDevicePixelRatio();
    const width = viewSize.width / pixelRatio;
    const height = viewSize.height / pixelRatio;

    vpDiv.style.width = `${String(width)}px`;
    vpDiv.style.height = `${String(height)}px`;
    theViewport = ScreenViewport.create(vpDiv, state.viewState!);
    theViewport.rendersToScreen = true;
    const canvas = theViewport.canvas;
    canvas.style.width = `${String(width)}px`;
    canvas.style.height = `${String(height)}px`;
    theViewport.continuousRendering = false;
    theViewport.requestRedraw();
    (theViewport.target as Target).performanceMetrics = undefined;
    await _changeView(state.viewState!);
  }
}

async function createOidcClient(requestContext: ClientRequestContext): Promise<NativeAppAuthorization | BrowserAuthorizationClient> {
  const scope = "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party";

  if (ProcessDetector.isElectronAppFrontend) {
    const clientId = "imodeljs-electron-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration = { clientId, redirectUri, scope: `${scope} offline_access` };
    const desktopClient = new NativeAppAuthorization(oidcConfiguration);
    await desktopClient.initialize(requestContext);
    return desktopClient;
  } else {
    const clientId = "imodeljs-spa-test";
    const redirectUri = "http://localhost:3000/signin-callback";
    const oidcConfiguration: BrowserAuthorizationClientConfiguration = { clientId, redirectUri, scope: `${scope} imodeljs-router`, responseType: "code" };
    const browserClient = new BrowserAuthorizationClient(oidcConfiguration);
    return browserClient;
  }
}

// Wraps the signIn process
// In the case of use in web applications:
// - called the first time to start the signIn process - resolves to false
// - called the second time as the Authorization provider redirects to cause the application to refresh/reload - resolves to false
// - called the third time as the application redirects back to complete the authorization - finally resolves to true
// In the case of use in electron applications:
// - promise wraps around a registered call back and resolves to true when the sign in is complete
// @return Promise that resolves to true only after signIn is complete. Resolves to false until then.
async function signIn(): Promise<boolean> {
  const requestContext = new FrontendRequestContext();
  const oidcClient = await createOidcClient(requestContext);

  IModelApp.authorizationClient = oidcClient;
  if (oidcClient.isAuthorized)
    return true;

  const retPromise = new Promise<boolean>((resolve, _reject) => {
    oidcClient.onUserStateChanged.addListener((token: AccessToken | undefined) => {
      resolve(token !== undefined);
    });
  });

  await oidcClient.signIn(requestContext);
  return retPromise;
}

async function getAllMatchingModels(testConfig: DefaultConfigs): Promise<string[]> {
  if (!testConfig.iModelLocation || !testConfig.iModelName?.includes("*"))
    return [testConfig.iModelName!];

  const matchingFilesJson = await DisplayPerfRpcInterface.getClient().getMatchingFiles(testConfig.iModelLocation, testConfig.iModelName ?? "*");
  const matchingFiles = JSON.parse(matchingFilesJson);
  const matchingIModels: string[] = [];
  matchingFiles.forEach((file: string) => {
    if ((file.endsWith(".bim") || file.endsWith(".ibim"))) {
      const fileSplit = file.split("\\");
      const model = fileSplit[fileSplit.length - 1];
      if (model)
        matchingIModels.push(model);
    }
  });
  return matchingIModels;
}

async function getAllMatchingSavedViews(testConfig: DefaultConfigs): Promise<string[]> {
  const intViews: string[] = [];
  const extViews: string[] = [];

  await openImodelAndLoadExtViews(testConfig); // Open iModel & load all external saved views into activeViewState

  if (testConfig.savedViewType?.toLocaleLowerCase() !== "external") { // Get both public & private internal/local saved views
    if (activeViewState.iModelConnection) {
      const viewSpecs = await activeViewState.iModelConnection.views.getViewList({ wantPrivate: true });
      viewSpecs.forEach((spec) => intViews.push(spec.name));
    }
  }
  if (testConfig.savedViewType?.toLocaleLowerCase() !== "internal" && testConfig.savedViewType?.toLocaleLowerCase() !== "local") {  // Open external saved views
    activeViewState.externalSavedViews?.forEach((view) => extViews.push(view._name));
  }

  const allViews = intViews.concat(extViews);
  return allViews.filter((view) => matchRule(view, testConfig.viewName ?? "*")).sort(); // Filter & alphabetize all view names
}

async function openImodelAndLoadExtViews(testConfig: DefaultConfigs, extViews?: any[]): Promise<void> {
  activeViewState = new SimpleViewState();

  // Open an iModel from a local file
  let openLocalIModel = (testConfig.iModelLocation !== undefined) || ProcessDetector.isMobileAppFrontend;
  if (openLocalIModel) {
    try {
      activeViewState.iModelConnection = await SnapshotConnection.openFile(testConfig.iModelFile!);
    } catch (err) {
      alert(`openSnapshot failed: ${err.toString()}`);
      openLocalIModel = false;
    }
    if (extViews) {
      activeViewState.externalSavedViews = extViews;
    } else {
      const esvString = await DisplayPerfRpcInterface.getClient().readExternalSavedViews(testConfig.iModelFile!);
      if (undefined !== esvString && "" !== esvString) {
        activeViewState.externalSavedViews = JSON.parse(esvString) as any[];
      }
    }
  }

  // Open an iModel from iModelHub
  if (!openLocalIModel && testConfig.iModelHubProject !== undefined && !ProcessDetector.isMobileAppFrontend) {
    const signedIn: boolean = await signIn();
    if (!signedIn)
      return;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    const iModelName = testConfig.iModelName!.replace(".ibim", "").replace(".bim", "");
    activeViewState.projectConfig = { projectName: testConfig.iModelHubProject, iModelName } as ConnectProjectConfiguration;
    activeViewState.project = await initializeIModelHub(activeViewState.projectConfig.projectName);
    activeViewState.iModel = await IModelApi.getIModelByName(requestContext, activeViewState.project!.wsgId, activeViewState.projectConfig.iModelName);
    if (activeViewState.iModel === undefined)
      throw new Error(`${activeViewState.projectConfig.iModelName} - IModel not found in project ${activeViewState.project!.name}`);
    activeViewState.iModelConnection = await IModelApi.openIModel(activeViewState.project!.wsgId, activeViewState.iModel.wsgId, undefined, OpenMode.Readonly);

    if (extViews) {
      activeViewState.externalSavedViews = extViews;
    } else if (activeViewState.project) { // Get any external saved views from iModelHub if they exist
      try {
        const projectShareClient: ProjectShareClient = new ProjectShareClient();
        const projectId = activeViewState.project.wsgId;
        const findFile = async (folderId: string): Promise<boolean> => {
          const files: ProjectShareFile[] = await projectShareClient.getFiles(requestContext, projectId, new ProjectShareFileQuery().inFolderWithNameLike(folderId, `${iModelName}_ESV.json`));
          if (files && files.length > 0) {
            const content = await projectShareClient.readFile(requestContext, files[0]);
            const esvString = new TextDecoder("utf-8").decode(content);
            if (undefined !== esvString && "" !== esvString) {
              activeViewState.externalSavedViews = JSON.parse(esvString) as any[];
            }
            return true;
          }
          return false;
        };
        const findAllFiles = async (folderId: string): Promise<boolean> => {
          if (await findFile(folderId))
            return true;
          else {
            const folders = await projectShareClient.getFolders(requestContext, projectId, new ProjectShareFolderQuery().inFolder(folderId));
            let fileFound = false;
            for (let i = 0; i < folders.length && !fileFound; i++) {
              fileFound = await findAllFiles(folders[i].wsgId);
            }
            return fileFound;
          }
        };
        // Set activeViewState.externalSavedViews using the first _ESV.json file found in iModelHub with the iModel's name
        await findAllFiles(activeViewState.project.wsgId);
      } catch (error) {
        // Couldn't access the project share files
      }
    }
  }

}

async function loadIModel(testConfig: DefaultConfigs, extViews?: any[]): Promise<boolean> {
  await openImodelAndLoadExtViews(testConfig, extViews); // Open iModel & load all external saved views into activeViewState

  // open the specified view
  if (undefined !== testConfig.viewStatePropsString)
    await loadViewString(activeViewState, testConfig.viewStatePropsString, testConfig.selectedElements, testConfig.overrideElements);
  else if (undefined !== testConfig.extViewName)
    await loadExternalView(activeViewState, testConfig.extViewName);
  else if (undefined !== testConfig.viewName)
    await loadView(activeViewState, testConfig.viewName);
  else
    return false;

  // Make sure the view was set up.  If not (probably because the name wasn't found anywhere) just skip this test.
  if (undefined === activeViewState.viewState)
    return false;

  // now connect the view to the canvas
  await openView(activeViewState, testConfig.view!);
  // assert(theViewport !== undefined, "ERROR: theViewport is undefined");

  // Set the hilite/emphasis settings
  if (undefined !== testConfig.hilite)
    theViewport!.hilite = Hilite.cloneSettings(testConfig.hilite);
  if (undefined !== testConfig.emphasis)
    theViewport!.emphasisSettings = Hilite.cloneSettings(testConfig.emphasis);

  // Set the display style
  const iModCon = activeViewState.iModelConnection;
  if (iModCon && testConfig.displayStyle) {
    const displayStyleProps = await iModCon.elements.queryProps({ from: DisplayStyleState.classFullName, where: `CodeValue = '${testConfig.displayStyle}'` });
    if (displayStyleProps.length >= 1)
      theViewport!.view.setDisplayStyle(new DisplayStyle3dState(displayStyleProps[0] as DisplayStyleProps, iModCon));
  }

  // Set the viewFlags (including the render mode)
  if (undefined !== activeViewState.viewState) {
    if (testConfig.viewFlags) {
      // Use the testConfig.viewFlags data for each property in ViewFlags if it exists; otherwise, keep using the viewState's ViewFlags info
      for (const [key] of Object.entries(activeViewState.viewState.displayStyle.viewFlags)) {
        if ((testConfig.viewFlags as Options)[key] !== undefined)
          (activeViewState.viewState.displayStyle.viewFlags as Options)[key] = (testConfig.viewFlags as Options)[key];
        else
          (testConfig.viewFlags as Options)[key] = (activeViewState.viewState.displayStyle.viewFlags as Options)[key];
      }
    }
    if (undefined !== testConfig.backgroundMap) {
      // Use the testConfig.backgroundMap data for each property in Background if it exists; otherwise, keep using the viewState's ViewFlags info
      const bmSettings = activeViewState.viewState.displayStyle.settings.backgroundMap;
      activeViewState.viewState.displayStyle.changeBackgroundMapProps(bmSettings.clone(testConfig.backgroundMap));
    }
  }

  // Set the overrides for elements (if there are any)
  if (undefined !== iModCon && undefined !== activeViewState.overrideElements) {
    // Hook up the feature override provider and set up the overrides in it from the ViewState.
    // Note that we do not have to unhook it or clear out the feature overrides if there are none since the viewport is created from scratch each time.
    const provider = FOProvider.getOrCreate(theViewport!);
    if (undefined !== provider && undefined !== activeViewState.overrideElements) {
      provider.overrideElementsByArray(activeViewState.overrideElements);
    }
  }

  // Load all tiles
  await waitForTilesToLoad(testConfig.iModelLocation);

  // Set the selected elements (if there are any)
  if (undefined !== iModCon && undefined !== activeViewState.selectedElements) {
    iModCon.selectionSet.add(activeViewState.selectedElements);
    theViewport!.markSelectionSetDirty();
    theViewport!.renderFrame();
  }

  return true;
}

async function closeIModel() {
  debugPrint(`start closeIModel${activeViewState.iModelConnection}`);
  if (activeViewState.iModelConnection) {
    await activeViewState.iModelConnection.close();
  }
  debugPrint("end closeIModel");
}

// Restart the IModelApp if either the TileAdmin.Props or the Render.Options has changed
async function restartIModelApp(testConfig: DefaultConfigs): Promise<void> {
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
      await IModelApp.shutdown();
    }
  }
  curRenderOpts = newRenderOpts;
  curTileProps = newTileProps;
  if (!IModelApp.initialized) {
    await DisplayPerfTestApp.startup({
      renderSys: testConfig.renderOptions,
      tileAdmin: curTileProps,
    });
  }
}

async function createReadPixelsImages(testConfig: DefaultConfigs, pix: Pixel.Selector, pixStr: string) {
  const canvas = theViewport !== undefined ? theViewport.readImageToCanvas() : undefined;
  if (canvas !== undefined) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const cssWidth = testConfig.view!.width;
      const cssHeight = testConfig.view!.height;
      const cssRect = new ViewRect(0, 0, cssWidth, cssHeight);

      const imgWidth = cssPixelsToDevicePixels(cssWidth);
      const imgHeight = cssPixelsToDevicePixels(cssHeight);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elemIdImgData = (pix & Pixel.Selector.Feature) ? ctx.createImageData(imgWidth, imgHeight) : undefined;
      const depthImgData = (pix & Pixel.Selector.GeometryAndDistance) ? ctx.createImageData(imgWidth, imgHeight) : undefined;
      const typeImgData = (pix & Pixel.Selector.GeometryAndDistance) ? ctx.createImageData(imgWidth, imgHeight) : undefined;

      theViewport!.readPixels(cssRect, pix, (pixels: any) => {
        if (undefined === pixels)
          return;
        for (let y = 0; y < imgHeight; ++y) {
          for (let x = 0; x < imgWidth; ++x) {
            const index = (x * 4) + (y * 4 * imgWidth);
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
        await savePng(getImageString(testConfig, `elemId_${pixStr}_`), canvas);
      }
      if (depthImgData !== undefined) {
        ctx.putImageData(depthImgData, 0, 0);
        await savePng(getImageString(testConfig, `depth_${pixStr}_`), canvas);
      }
      if (typeImgData !== undefined) {
        ctx.putImageData(typeImgData, 0, 0);
        await savePng(getImageString(testConfig, `type_${pixStr}_`), canvas);
      }
    }
  }
}

async function renderAsync(vp: ScreenViewport, numFrames: number, timings: Array<Map<string, number>>, resultsCallback: (result: any) => void): Promise<void> {
  IModelApp.viewManager.addViewport(vp);

  const debugControl = IModelApp.renderSystem.debugControl!;
  const target = vp.target as Target;
  const metrics = target.performanceMetrics!;
  target.performanceMetrics = undefined;
  debugControl.resultsCallback = undefined; // Turn off glTimer metrics until after the first N frames

  const numFramesToIgnore = 120;
  let ignoreFrameCount = 0;
  let frameCount = 0;
  vp.continuousRendering = true;
  return new Promise((resolve: () => void, _reject) => {
    const timer = new StopWatch();
    const removeListener = vp.onRender.addListener((_) => {
      // Ignore the first N frames - they seem to have more variable frame rate.
      ++ignoreFrameCount;
      if (ignoreFrameCount <= numFramesToIgnore) {
        if (ignoreFrameCount === numFramesToIgnore) {
          // Time to start recording.
          target.performanceMetrics = metrics;
          debugControl.resultsCallback = resultsCallback; // Turn on glTimer metrics after the first N frames
          timer.start();
        }

        return;
      }

      timer.stop();
      timings[frameCount] = metrics.frameTimings;
      timings[frameCount].set("Total Time", timer.current.milliseconds);

      if (++frameCount === numFrames) {
        target.performanceMetrics = undefined;
      }
      if (gpuFramesCollected >= numFrames || (frameCount >= numFrames && !(IModelApp.renderSystem as System).isGLTimerSupported)) {
        removeListener();
        IModelApp.viewManager.dropViewport(vp, false);
        vp.continuousRendering = false;
        debugControl.resultsCallback = undefined; // Turn off glTimer metrics
        resolve();
      } else {
        vp.requestRedraw();
        timer.start();
      }
    });
  });
}

async function runTest(testConfig: DefaultConfigs, extViews?: any[]) {
  // Restart the IModelApp if needed
  await restartIModelApp(testConfig);

  // Reset the title bar to include the current model and view name
  document.title = "Display Performance Test App:  ".concat(testConfig.iModelName ?? "", "  [", testConfig.viewName ?? "", "]");

  // Open and finish loading model
  const loaded = await loadIModel(testConfig, extViews);
  if (!loaded) {
    await closeIModel();
    return; // could not properly open the given model or saved view so skip test
  }

  if (testConfig.testType === "image" || testConfig.testType === "both") {
    updateTestNames(testConfig, undefined, true); // Update the list of image test names
    await savePng(getImageString(testConfig));
    if (testConfig.testType === "image") {
      // Close the imodel & exit if nothing else needs to happen
      await closeIModel();
      return;
    }
  }

  const csvFormat = testConfig.csvFormat!;
  const debugControl = IModelApp.renderSystem.debugControl!;
  gpuFramesCollected = 0; // Set the number of gpu timings collected back to 0

  // Throw away the first n renderFrame times, until it's more consistent
  for (let i = 0; i < (testConfig.numRendersToSkip ? testConfig.numRendersToSkip : 50); ++i) {
    theViewport!.requestRedraw();
    theViewport!.renderFrame();
  }
  testConfig.numRendersToTime = testConfig.numRendersToTime ? testConfig.numRendersToTime : 100;

  // Turn on performance metrics to start collecting data when we render things
  const finalCPUFrameTimings: Array<Map<string, number>> = [];
  const finalGPUFrameTimings = new Map<string, number[]>();
  const timingsForActualFPS: Array<Map<string, number>> = []; // only used to get ; most gpu only metrics come from gpuResultsCallback
  const gpuResultsCallback = (result: GLTimerResult): void => {
    if (gpuFramesCollected < testConfig.numRendersToTime!) {
      const label = result.label;
      const timings = finalGPUFrameTimings.get(label);
      finalGPUFrameTimings.set(label, timings ? timings.concat(result.nanoseconds / 1e6) : [result.nanoseconds / 1e6]); // Save as milliseconds
      if (result.children) {
        for (const kid of result.children)
          gpuResultsCallback(kid);
      }
      if ("Total" === label) // Do this to ensure that we gather the gpu information for exactly 'testConfig.numRendersToTime' frames
        gpuFramesCollected++;
    }
  };

  // Add a pause so that user can start the GPU Performance Capture program
  // await resolveAfterXMilSeconds(7000);

  updateTestNames(testConfig); // Update the list of timing test names
  if (testConfig.testType === "readPixels") {
    const width = testConfig.view!.width;
    const height = testConfig.view!.height;
    const viewRect = new ViewRect(0, 0, width, height);
    const testReadPix = async (pixSelect: Pixel.Selector, pixSelectStr: string) => {
      // Get CPU timings
      (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false, undefined);
      debugControl.resultsCallback = undefined; // Turn off glTimer metrics
      for (let i = 0; i < testConfig.numRendersToTime!; ++i) {
        theViewport!.readPixels(viewRect, pixSelect, (_pixels: any) => { });
        finalCPUFrameTimings[i] = (theViewport!.target as Target).performanceMetrics!.frameTimings;
        finalCPUFrameTimings[i].delete("Scene Time");
      }
      // Get GPU timings
      gpuFramesCollected = 0; // Set the number of gpu timings collected back to 0
      (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false, gpuResultsCallback);
      await renderAsync(theViewport!, testConfig.numRendersToTime!, timingsForActualFPS, gpuResultsCallback);
      debugControl.resultsCallback = undefined; // Turn off glTimer metrics
      updateTestNames(testConfig, pixSelectStr, true); // Update the list of image test names
      updateTestNames(testConfig, pixSelectStr, false); // Update the list of timing test names
      const rowData = getRowData(finalCPUFrameTimings, finalGPUFrameTimings, timingsForActualFPS, testConfig, pixSelectStr);
      await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData, csvFormat);

      // Create images from the elementID, depth (i.e. distance), and type (i.e. order)
      await createReadPixelsImages(testConfig, pixSelect, pixSelectStr);
    };
    // Test each combo of pixel selectors, then close the iModel
    await testReadPix(Pixel.Selector.Feature, "+feature");
    await testReadPix(Pixel.Selector.GeometryAndDistance, "+geom+dist");
    await testReadPix(Pixel.Selector.All, "+feature+geom+dist");
    await closeIModel();
  } else {
    (theViewport!.target as Target).performanceMetrics = new PerformanceMetrics(true, false, gpuResultsCallback);
    await renderAsync(theViewport!, testConfig.numRendersToTime, timingsForActualFPS, gpuResultsCallback);
    // Close model & save csv file
    await closeIModel();
    const rowData = getRowData(timingsForActualFPS, finalGPUFrameTimings, timingsForActualFPS, testConfig);
    await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData, csvFormat);

    if (wantConsoleOutput) { // Debug purposes only
      debugPrint("------------ ");
      debugPrint(`Tile Loading Time: ${curTileLoadingTime}`);
      for (const t of finalCPUFrameTimings) {
        let timingsString = "[";
        t.forEach((val) => {
          timingsString += `${val}, `;
        });
        debugPrint(`${timingsString}]`);
        // Save all of the individual runs in the csv file, not just the average
        // const rowData = getRowData([t], testConfig);
        // await saveCsv(testConfig.outputPath!, testConfig.outputName!, rowData);
      }
    }
  }
}

// selects the configured view.
async function loadView(state: SimpleViewState, viewName: string) {
  const viewIds = await state.iModelConnection!.elements.queryIds({ from: ViewState.classFullName, where: `CodeValue = '${viewName}'` });
  if (1 === viewIds.size)
    state.viewState = await state.iModelConnection!.views.load(viewIds.values().next().value);

  if (undefined === state.viewState) {
    // Could not find it in the file, so look through the external saved views for this file.
    // This will allow us to use the 'viewName' property in the config file for either type of saved view
    // unless there is one named the same in both lists (which is not being prevented anymore when creating them).
    await loadExternalView(state, viewName);
    return;
  }

  if (undefined === state.viewState)
    debugPrint("Error: failed to load view by name");
}

// selects the configured view from the external saved views list.
async function loadExternalView(state: SimpleViewState, extViewName: string) {
  if (undefined !== state.externalSavedViews) {
    for (const namedExternalSavedView of state.externalSavedViews) {
      if (extViewName === namedExternalSavedView._name) {
        let oe;
        if (undefined !== namedExternalSavedView._overrideElements)
          oe = JSON.parse(namedExternalSavedView._overrideElements) as any[];
        let se;
        if (undefined !== namedExternalSavedView._selectedElements)
          se = JSON.parse(namedExternalSavedView._selectedElements) as Id64Arg;
        await loadViewString(state, namedExternalSavedView._viewStatePropsString, se, oe);
        return;
      }
    }
  }

  if (undefined === state.viewState)
    debugPrint("Error: failed to load view by name");
}

// selects the configured view from a viewStateProperties string.
async function loadViewString(state: SimpleViewState, viewStatePropsString: string, selectedElements: Id64Arg | undefined, overrideElements: any[] | undefined) {
  const vsp = JSON.parse(viewStatePropsString);
  const className = vsp.viewDefinitionProps.classFullName;
  const ctor = await state.iModelConnection!.findClassFor<typeof EntityState>(className, undefined) as typeof ViewState | undefined;
  if (undefined === ctor) {
    debugPrint("Could not create ViewState from viewString");
    state.viewState = undefined;
  } else {
    state.viewState = ctor.createFromProps(vsp, state.iModelConnection!);
    if (undefined !== state.viewState) {
      await state.viewState.load(); // make sure any attachments are loaded
      state.overrideElements = overrideElements;
      state.selectedElements = selectedElements;
    }
  }
}

async function testSet(configs: DefaultConfigs, setData: any, logFileName: string) {
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".Tiles");
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".TileCache");

  // Create DefaultModelConfigs
  const modConfigs = new DefaultConfigs(setData, configs);

  // Perform all tests for this model. If modelName contains an asterisk *,
  // treat it as a wildcard and run tests for each bim or ibim model that matches the given wildcard
  for (const testData of setData.tests) {

    // Create DefaultTestConfigs
    const testConfig = new DefaultConfigs(testData, modConfigs, true);
    const origViewName = testConfig.viewName;
    const allModelNames = await getAllMatchingModels(testConfig);
    for (const modelName of allModelNames) {
      testConfig.iModelName = modelName;
      testConfig.viewName = origViewName; // Reset viewName here in case running multiple models (which will overwrite the viewName)

      // Ensure imodel file exists
      // if (!fs.existsSync(testConfig.iModelFile!))
      //   break;

      // If a viewName contains an asterisk *,
      // treat it as a wildcard and run tests for each saved view that matches the given wildcard
      let allSavedViews = [testConfig.viewName];
      let extViews: any[] | undefined;
      if (testConfig.viewName?.includes("*")) {
        allSavedViews = await getAllMatchingSavedViews(testConfig);
        extViews = activeViewState.externalSavedViews;
      }
      for (const viewName of allSavedViews) {
        testConfig.viewName = viewName;

        // write output log file of timestamp, current model, and view
        const today = new Date();
        const month = (`0${(today.getMonth() + 1)}`).slice(-2);
        const day = (`0${today.getDate()}`).slice(-2);
        const year = today.getFullYear();
        const hours = (`0${today.getHours()}`).slice(-2);
        const minutes = (`0${today.getMinutes()}`).slice(-2);
        const seconds = (`0${today.getSeconds()}`).slice(-2);
        const outStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}  ${testConfig.iModelName}  [${testConfig.viewName}]`;
        await consoleLog(outStr);
        await writeExternalFile(testConfig.outputPath!, logFileName, true, `${outStr}\n`);

        await runTest(testConfig, extViews);

        await writeExternalFile(testConfig.outputPath!, logFileName, true, formattedSelectedTileIds);
      }
    }
  }
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".Tiles");
  if (configs.iModelLocation) removeFilesFromDir(configs.iModelLocation, ".TileCache");
}

async function main() {
  // Retrieve DefaultConfigs
  const defaultConfigStr = await getDefaultConfigs();
  const jsonData = JSON.parse(defaultConfigStr);
  const testConfig = new DefaultConfigs(jsonData);

  const logFileName = "_DispPerfTestAppViewLog.txt";
  const outStr = `View Log,  Model Base Location: ${testConfig.iModelLocation!}\n  format: Time_started  ModelName  [ViewName]`;
  await consoleLog(outStr);
  await writeExternalFile(testConfig.outputPath!, logFileName, false, `${outStr}\n`);

  // Sign In to iModelHub if needed
  if (jsonData.signIn) {
    const signedIn: boolean = await signIn();
    if (!signedIn)
      return;
  }
  if (jsonData.minimize)
    minimize = jsonData.minimize;

  for (const i in jsonData.testSet) {
    if (i) {
      const setData = jsonData.testSet[i];
      await testSet(testConfig, setData, logFileName);
    }
  }

  const topdiv = document.getElementById("topdiv")!;
  topdiv.style.display = "block";
  topdiv.innerText = "Tests Completed.";
  document.getElementById("imodel-viewport")!.style.display = "hidden";

  // Add render settings to the csv file
  let renderData = "\"End of Tests-----------\r\n";
  const renderComp = IModelApp.queryRenderCompatibility();
  if (renderComp.userAgent) {
    renderData += `Browser: ${getBrowserName(renderComp.userAgent)}\r\n`;
    renderData += `User Agent: ${renderComp.userAgent}\r\n`;
  }
  if (renderComp.unmaskedRenderer) renderData += `Unmasked Renderer: ${renderComp.unmaskedRenderer}\r\n`;
  if (renderComp.unmaskedVendor) renderData += `Unmasked Vendor: ${renderComp.unmaskedVendor}\r\n`;
  if (renderComp.missingRequiredFeatures) renderData += `Missing Required Features: ${renderComp.missingRequiredFeatures}\r\n`;
  if (renderComp.missingOptionalFeatures) renderData += `Missing Optional Features: ${renderComp.missingOptionalFeatures}"\r\n`;
  if (testConfig.csvFormat === undefined) testConfig.csvFormat = "original";
  await DisplayPerfRpcInterface.getClient().finishCsv(renderData, testConfig.outputPath, testConfig.outputName, testConfig.csvFormat);

  DisplayPerfRpcInterface.getClient().finishTest(); // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelApp.shutdown();
}

window.onload = async () => {
  // Choose RpcConfiguration based on whether we are in electron or browser
  RpcConfiguration.developmentMode = true;
  RpcConfiguration.disableRoutingValidation = true;

  if (!ProcessDetector.isElectronAppFrontend && !ProcessDetector.isMobileAppFrontend) {
    const uriPrefix = "http://localhost:3001";
    BentleyCloudRpcManager.initializeClient({ info: { title: "DisplayPerformanceTestApp", version: "v1.0" }, uriPrefix }, [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface]);
  }

  await DisplayPerfTestApp.startup();

  await main();
};
