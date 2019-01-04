/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { OpenMode, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { Point3d, Transform, Vector3d, XAndY, LineString3d, IModelJson as GeomJson, LineSegment3d } from "@bentley/geometry-core";
import {
  BentleyCloudRpcManager,
  ColorDef,
  ElectronRpcConfiguration,
  ElectronRpcManager,
  IModelReadRpcInterface,
  IModelTileRpcInterface,
  IModelToken,
  LinePixels,
  ModelProps,
  ModelQueryParams,
  RgbColor,
  RpcConfiguration,
  RpcOperation,
  StandaloneIModelRpcInterface,
  ViewQueryParams,
  GeometryStreamProps,
  ContextRealityModelProps,
  MobileRpcConfiguration,
  MobileRpcManager,
} from "@bentley/imodeljs-common";
import { AccessToken, Config, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import {
  AccuDraw,
  AccuDrawHintBuilder,
  AccuDrawShortcuts,
  AccuSnap,
  DecorateContext,
  MessageBoxIconType,
  BeButtonEvent,
  DynamicsContext,
  EventHandled,
  HitDetail,
  IModelApp,
  IModelConnection,
  MessageBoxType,
  MessageBoxValue,
  NotificationManager,
  NotifyMessageDetails,
  PrimitiveTool,
  RotationMode,
  ScreenViewport,
  SnapMode,
  SpatialModelState,
  SpatialViewState,
  StandardViewId,
  ToolTipOptions,
  Viewport,
  ViewState,
  SnapStatus,
  imageBufferToPngDataUrl,
  ContextRealityModelState,
  OidcClientWrapper,
  FeatureSymbology,
  GraphicType,
} from "@bentley/imodeljs-frontend";
import ToolTip from "tooltip.js";
import { IModelApi } from "./IModelApi";
import { SimpleViewState } from "./SimpleViewState";
import { DebugPanel } from "./DebugPanel";
import { CategoryPicker } from "./CategoryPicker";
import { ViewAttributesPanel } from "./ViewAttributes";
import { showError, showStatus } from "./Utils";
import { initializeCustomCloudEnv } from "./CustomCloudEnv";
import { initializeIModelHub } from "./ConnectEnv";
import { SVTConfiguration } from "../common/SVTConfiguration";
import { toggleIncidentMarkers } from "./IncidentMarkerDemo";
import { toggleProjectExtents } from "./ProjectExtents";
import { TileLoadIndicator } from "./TileLoadIndicator";

// Only want the following imports if we are using electron and not a browser -----
// tslint:disable-next-line:variable-name
let remote: any;
if (ElectronRpcConfiguration.isElectron) {
  // tslint:disable-next-line:no-var-requires
  remote = require("electron").remote;
}

// tslint:disable:no-console

const availableContextRealityModels: ContextRealityModelProps[] = ContextRealityModelState.findAvailableRealityModels();

let activeViewState: SimpleViewState = new SimpleViewState();
const viewMap = new Map<string, ViewState | IModelConnection.ViewSpec>();
let theViewport: ScreenViewport | undefined;
let curModelProps: ModelProps[] = [];
let curModelPropIndices: number[] = [];
let curNumModels = 0;
const configuration = {} as SVTConfiguration;
let overrideColor: ColorDef | undefined;
let overrideTransparency: number | undefined;
let curContextRealityModels: ContextRealityModelState[];

function addFeatureOverrides(ovrs: FeatureSymbology.Overrides, viewport: Viewport): void {
  if (undefined === overrideColor && undefined === overrideTransparency)
    return;

  const color = undefined !== overrideColor ? RgbColor.fromColorDef(overrideColor) : undefined;
  const app = FeatureSymbology.Appearance.fromJSON({ rgb: color, weight: 4, linePixels: LinePixels.Code1, transparency: overrideTransparency });
  for (const elemId of viewport.iModel.selectionSet.elements)
    ovrs.overrideElement(elemId, app);
}

// Retrieves the configuration for starting SVT from configuration.json file located in the built public folder
async function retrieveConfiguration(): Promise<void> {
  return new Promise<void>((resolve, _reject) => {
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
      }
    });
    request.send();
  });
}

// opens the configured iModel from disk
async function openStandaloneIModel(state: SimpleViewState, filename: string) {
  configuration.standalone = true;
  state.iModelConnection = await IModelConnection.openStandalone(filename, OpenMode.Readonly);
  configuration.iModelName = state.iModelConnection.name;
  IModelApp.accessToken = state.accessToken;
}

// opens the configured iModel from iModelHub or iModelBank
async function openIModel(state: SimpleViewState) {
  await retrieveProjectConfiguration();
  configuration.iModelName = activeViewState.projectConfig!.iModelName;
  if (configuration.customOrchestratorUri)
    await initializeCustomCloudEnv(state, configuration.customOrchestratorUri);
  else {
    await initializeIModelHub(state);
  }

  state.iModel = await IModelApi.getIModelByName(state.accessToken!, state.project!.wsgId, configuration.iModelName!);
  if (state.iModel === undefined)
    throw new Error(`${configuration.iModelName} - IModel not found in project ${state.project!.name}`);
  state.iModelConnection = await IModelApi.openIModel(state.accessToken!, state.project!.wsgId, state.iModel!.wsgId, undefined, OpenMode.Readonly);
}

// selects the configured view.
async function buildViewList(state: SimpleViewState, configurations?: { viewName?: string }) {
  const config = undefined !== configurations ? configurations : {};
  const viewList = document.getElementById("viewList") as HTMLSelectElement;
  const viewQueryParams: ViewQueryParams = { wantPrivate: false };
  const viewSpecs: IModelConnection.ViewSpec[] = await state.iModelConnection!.views.getViewList(viewQueryParams);
  if (undefined === config.viewName) {
    const defaultViewId = (await state.iModelConnection!.views.queryDefaultViewId()).toString();
    for (const spec of viewSpecs) {
      if (spec.id.toString() === defaultViewId) {
        config.viewName = spec.name;
        break;
      }
    }
  }

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
function startToggleModel() {
  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}
// open up the context model toggle menu
function startToggleContextRealityModel() {
  const menu = document.getElementById("toggleContextRealityModelMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

// build list of contextRealityContextRealityModels; enables those defined in contextRealityModel selector
async function buildContextRealityModelMenu(state: SimpleViewState) {
  const contextRealityModelMenu = document.getElementById("toggleContextRealityModelMenu") as HTMLDivElement;
  const contextRealityModelButton = document.getElementById("startToggleContextRealityModel")!;
  const spatialView = undefined !== state.viewState && state.viewState instanceof SpatialViewState ? state.viewState as SpatialViewState : undefined;
  if (undefined === spatialView) {
    contextRealityModelMenu.style.display = contextRealityModelButton.style.display = "none";
    return;
  }
  curContextRealityModels = [];
  contextRealityModelButton.style.display = "inline";
  contextRealityModelMenu.innerHTML = '<input id="cbxCRMToggleAll" type="checkbox"> Toggle All\n<br>\n';
  for (const availableCRM of availableContextRealityModels) {
    const contextRealityModel = new ContextRealityModelState(availableCRM, activeViewState.iModelConnection!);

    if (await contextRealityModel.intersectsProjectExtents()) {   // Add geospatial filtering
      curContextRealityModels.push(contextRealityModel);
    }
  }
  if (curContextRealityModels.length === 0) {
    contextRealityModelMenu.style.display = contextRealityModelButton.style.display = "none";
    return;
  }

  for (const contextRealityModel of curContextRealityModels) {
    const cbxName = "cbxCRM" + contextRealityModel.url; // Use URL for ID.
    contextRealityModelMenu.innerHTML += '&nbsp;&nbsp;<input id="' + cbxName + '" type="checkbox"> ' + contextRealityModel.name + "\n<br>\n";
  }

  let allEnabled = true;    // TBD - Test if all enabled

  for (const contextRealityModel of curContextRealityModels) {
    const enabled = spatialView.displayStyle.containsContextRealityModel(contextRealityModel);
    if (!enabled) allEnabled = false;
    const cbxName = "cbxCRM" + contextRealityModel.url; // Use URL for ID.
    updateCheckboxToggleState(cbxName, enabled);
    addContextRealityModelToggleHandler(cbxName);
  }
  updateCheckboxToggleState("cbxCRMToggleAll", allEnabled);
  addContextRealityModelToggleAllHandler();
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
  modelMenu.innerHTML = '<input id="cbxModelToggleAll" type="checkbox"> Toggle All\n<br>\n';

  // ###TODO: Load models on demand when they are enabled in the dialog - not all up front like this...super-inefficient...
  let i = 0;
  for (const modelProp of curModelProps) {
    const model = spatialView.iModel.models.getLoaded(modelProp.id!.toString());
    if (undefined === model)
      await spatialView.iModel.models.load(modelProp.id!.toString());

    modelMenu.innerHTML += '<input id="cbxModel' + i + '" type="checkbox"> ' + modelProp.name + "\n<br>\n";
    curModelPropIndices.push(i);

    let j = 0;
    if (model !== undefined) {
      if (model.jsonProperties.classifiers !== undefined) {
        for (const classifier of model.jsonProperties.classifiers) {
          modelMenu.innerHTML += '&nbsp;&nbsp;<input id="cbxModel' + i + "_" + j + '" type="checkbox"> ' + classifier.name + "\n<br>\n";
          j++;
        }
      }
    }

    i++;
  }

  curNumModels = i;
  let allEnabled: boolean = true;
  for (let c = 0; c < curNumModels; c++) {
    const cbxName = "cbxModel" + c;
    const enabled = spatialView.modelSelector.has(curModelProps[c].id!.toString());
    if (!enabled)
      allEnabled = false;

    updateCheckboxToggleState(cbxName, enabled);
    addModelToggleHandler(cbxName);

    const model = spatialView.iModel.models.getLoaded(curModelProps[c].id!.toString());
    if (model !== undefined) {
      if (model.jsonProperties.classifiers !== undefined) {
        let cc = 0;
        for (const classifier of model.jsonProperties.classifiers) {
          const classifierName = "cbxModel" + c + "_" + cc;
          updateCheckboxToggleState(classifierName, classifier.isActive);
          addClassifierToggleHandler(classifierName);
          cc++;
        }
      }
    }
  }

  updateCheckboxToggleState("cbxModelToggleAll", allEnabled);
  addModelToggleAllHandler();

  applyModelToggleChange("cbxModel0"); // force view to update based on all being enabled
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

  let allEnabled: boolean = true;
  for (let c = 0; c < curNumModels; c++) {
    const cbxName = "cbxModel" + c;
    const isChecked = getCheckboxToggleState(cbxName);
    if (isChecked)
      view.addViewedModel(curModelProps[curModelPropIndices[c]].id!);
    else
      allEnabled = false;
  }

  theViewport!.sync.invalidateScene();

  updateCheckboxToggleState("cbxModelToggleAll", allEnabled);

  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
}

// apply a classifier checkbox state being changed (change isActive flag on classifier on a model)
function applyClassifierToggleChange(cName: string) {
  if (!(theViewport!.view instanceof SpatialViewState))
    return;
  const view = theViewport!.view as SpatialViewState;

  for (let c = 0; c < curNumModels; c++) {
    const model = view.iModel.models.getLoaded(curModelProps[c].id!.toString());
    if (model !== undefined) {
      if (model.jsonProperties.classifiers !== undefined) {
        let cc = 0;
        for (const classifier of model.jsonProperties.classifiers) {
          const classifierName = "cbxModel" + c + "_" + cc;
          if (cName === classifierName) { // Found the classifier
            classifier.isActive = getCheckboxToggleState(classifierName);
            theViewport!.sync.invalidateScene();
            const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
            menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
            return;
          }
          cc++;
        }
      }
    }
  }
}
// apply a model checkbox state being changed (actually change list of viewed models)
function applyContextRealityModelToggleChange(_cbxContextRealityModel: string) {
  if (!(theViewport!.view instanceof SpatialViewState))
    return;
  const view = theViewport!.view as SpatialViewState;
  const currentCRMs = view.displayStyle.contextRealityModels;
  const prefix = "cbxCRM";

  for (let i = 0; i < currentCRMs.length; i++) {
    if (prefix + currentCRMs[i].url === _cbxContextRealityModel) {
      currentCRMs.splice(i, 1);
      theViewport!.sync.invalidateScene();
      return;
    }
  }
  currentCRMs.push(new ContextRealityModelState({ name: "", tilesetUrl: _cbxContextRealityModel.slice(prefix.length) }, activeViewState.iModelConnection!));
  theViewport!.sync.invalidateScene();
}
function applyContextRealityModelToggleAllChange() {
  if (!(theViewport!.view instanceof SpatialViewState))
    return;

  const isChecked = getCheckboxToggleState("cbxCRMToggleAll");
  const view = theViewport!.view as SpatialViewState;
  const displayStyle = view.displayStyle;

  if (!isChecked)
    displayStyle.contextRealityModels = [];

  for (const curr of curContextRealityModels) {
    if (isChecked && !displayStyle.containsContextRealityModel(curr))
      displayStyle.contextRealityModels.push(curr);

    const cbxName = "cbxCRM" + curr.url; // Use URL for ID.
    updateCheckboxToggleState(cbxName, isChecked);
  }
  theViewport!.sync.invalidateScene();
}

function applyModelToggleAllChange() {
  if (!(theViewport!.view instanceof SpatialViewState))
    return;

  const view = theViewport!.view as SpatialViewState;
  view.clearViewedModels();

  const isChecked = getCheckboxToggleState("cbxModelToggleAll");
  for (let c = 0; c < curNumModels; c++) {
    const cbxName = "cbxModel" + c;
    (document.getElementById(cbxName)! as HTMLInputElement).checked = isChecked;
    if (isChecked) {
      const id = curModelProps[curModelPropIndices[c]].id!;
      view.addViewedModel(id);
    }
  }

  theViewport!.sync.invalidateScene();

  const menu = document.getElementById("toggleModelMenu") as HTMLDivElement;
  menu.style.display = "none"; // menu.style.display === "none" || menu.style.display === "" ? "none" : "block";
}

// add a click handler to model checkbox
function addModelToggleHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyModelToggleChange(id));
}

function addModelToggleAllHandler() {
  document.getElementById("cbxModelToggleAll")!.addEventListener("click", () => applyModelToggleAllChange());
}

// add a click handler to context reality model checkbox
function addContextRealityModelToggleHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyContextRealityModelToggleChange(id));
}

function addContextRealityModelToggleAllHandler() {
  document.getElementById("cbxCRMToggleAll")!.addEventListener("click", () => applyContextRealityModelToggleAllChange());
}

// add a click handler to classifier checkbox
function addClassifierToggleHandler(id: string) {
  document.getElementById(id)!.addEventListener("click", () => applyClassifierToggleChange(id));
}

function toggleStandardViewMenu() {
  const menu = document.getElementById("standardRotationMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function toggleDebugToolsMenu() {
  const menu = document.getElementById("debugToolsMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

let debugPanel: DebugPanel | undefined;
let categoryPicker: CategoryPicker | undefined;
let viewAttributes: ViewAttributesPanel | undefined;

function closeDebugPanel() {
  if (undefined !== debugPanel && debugPanel.isOpen)
    debugPanel.toggle();
}
function closeCategoryPicker() {
  if (undefined !== categoryPicker && categoryPicker.isOpen)
    categoryPicker.toggle();
}
function closeViewAttributes() {
  if (undefined !== viewAttributes)
    viewAttributes = viewAttributes.dispose();
}

function toggleDebugPanel() {
  if (undefined === debugPanel) {
    // Panel is shown on construction. toggle() will hide it.
    debugPanel = new DebugPanel(theViewport!, document.getElementById("debugPanelContainer")!);
  } else {
    // Alternatively: debugPanel.dispose() will reset any changes made. toggle() simply temporarily hides the panel.
    debugPanel.toggle();
  }

  if (debugPanel.isOpen) {
    closeCategoryPicker();
    closeViewAttributes();
  }
}

async function toggleCategoryPicker() {
  if (undefined === categoryPicker) {
    categoryPicker = new CategoryPicker(theViewport!, document.getElementById("categoryPickerContainer")!);
    await categoryPicker.populate();
  } else {
    categoryPicker.toggle();
  }

  if (categoryPicker.isOpen) {
    closeViewAttributes();
    closeDebugPanel();
  }
}
async function updateCategoryPicker() {
  if (undefined !== categoryPicker)
    await categoryPicker.populate();
}

function toggleViewAttributes() {
  if (undefined === viewAttributes) {
    closeCategoryPicker();
    closeDebugPanel();
    viewAttributes = new ViewAttributesPanel(theViewport!, document.getElementById("viewAttributesContainer")!);
  } else {
    viewAttributes = viewAttributes.dispose();
  }
}

function toggleSnapModeMenu() {
  const menu = document.getElementById("changeSnapModeMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function toggleAnimationMenu() {
  const menu = document.getElementById("animationMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

let isAnimating: boolean = false;
let isAnimationPaused: boolean = false;
let animationStartTime: number = 0;
let animationPauseTime: number = 0;
let animationEndTime: number = 0;

function setAnimationStateMessage(msg: string) {
  const animationState = document.getElementById("animationState") as HTMLDivElement;
  animationState.innerHTML = msg;
}

function enableAnimationUI(enabled: boolean = true) {
  const animationDuration = document.getElementById("animationDuration") as HTMLInputElement;
  const animationLoop = document.getElementById("animationLoop") as HTMLInputElement;
  animationDuration.disabled = !enabled;
  animationLoop.disabled = !enabled;
}

function isAnimationLooping(): boolean {
  const animationLoop = document.getElementById("animationLoop") as HTMLInputElement;
  return animationLoop.checked;
}

function processAnimationSliderAdjustment() {
  const animationSlider = document.getElementById("animationSlider") as HTMLInputElement;

  if (animationSlider.value === "0") {
    stopAnimation();
    return;
  }

  if (!isAnimating)
    startAnimation();
  if (!isAnimationPaused)
    pauseAnimation();

  const sliderValue = parseInt(animationSlider.value, undefined);
  const animationFraction = sliderValue / 1000.0;
  animationPauseTime = animationStartTime + (animationEndTime - animationStartTime) * animationFraction;
  theViewport!.animationFraction = animationFraction;
}

function updateAnimation() {
  if (isAnimationPaused) {
    window.requestAnimationFrame(updateAnimation);
    return;
  }

  const animationSlider = document.getElementById("animationSlider") as HTMLInputElement;
  const animationCurTime = (new Date()).getTime();
  theViewport!.animationFraction = (animationCurTime - animationStartTime) / (animationEndTime - animationStartTime);
  animationSlider.value = (theViewport!.animationFraction * 1000).toString();
  const userHitStop = !isAnimating;
  if (animationCurTime >= animationEndTime || !isAnimating) { // stop the animation!
    enableAnimationUI();
    if (isAnimationLooping()) {
      animationSlider.value = "0";
      theViewport!.animationFraction = 0;
    }
    isAnimating = false;
    setAnimationStateMessage("Stopped.");
  } else { // continue the animation - request the next frame
    window.requestAnimationFrame(updateAnimation);
  }
  if (!userHitStop && isAnimationLooping()) // only loop if user did not hit stop (naturally finished animation)
    startAnimation();
}

function startAnimation() {
  if (isAnimationPaused) { // resume animation
    const animationPauseOffset = (new Date()).getTime() - animationPauseTime; // how long were we paused?
    animationStartTime += animationPauseOffset;
    animationEndTime += animationPauseOffset;
    setAnimationStateMessage("Playing.");
    isAnimationPaused = false;
    return;
  }

  if (isAnimating)
    return; // cannot animate while animating

  setAnimationStateMessage("Playing.");

  theViewport!.animationFraction = 0;
  animationStartTime = (new Date()).getTime();
  const animationDuration = document.getElementById("animationDuration") as HTMLInputElement;
  animationEndTime = animationStartTime + parseFloat(animationDuration.value) * 1000;
  enableAnimationUI(false);
  isAnimating = true;
  isAnimationPaused = false;
  window.requestAnimationFrame(updateAnimation);
}

function pauseAnimation() {
  if (isAnimationPaused || !isAnimating)
    return;
  animationPauseTime = (new Date()).getTime();
  isAnimationPaused = true;
  setAnimationStateMessage("Paused.");
}

function stopAnimation() {
  if (!isAnimating)
    return; // already not animating!
  isAnimating = false;
  isAnimationPaused = false;
}

function processAnimationMenuEvent() { // keep animation menu open even when it is clicked
  const menu = document.getElementById("animationMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function applyStandardViewRotation(rotationId: StandardViewId, label: string) {
  if (undefined === theViewport)
    return;

  if (StandardViewId.Top !== rotationId && !theViewport.view.allow3dManipulations())
    return;

  const rMatrix = AccuDraw.getStandardRotation(rotationId, theViewport, theViewport.isContextRotationRequired);
  const inverse = rMatrix.inverse();
  if (undefined === inverse)
    return;

  const targetMatrix = inverse.multiplyMatrixMatrix(theViewport.rotation);
  const rotateTransform = Transform.createFixedPointAndMatrix(theViewport.view.getTargetPoint(), targetMatrix);
  const startFrustum = theViewport.getFrustum();
  const newFrustum = startFrustum.clone();
  newFrustum.multiply(rotateTransform);

  theViewport.animateFrustumChange(startFrustum, newFrustum);
  theViewport.view.setupFromFrustum(newFrustum);
  theViewport.synchWithView(true);
  showStatus(label, "view");
}

// opens the view and connects it to the HTML canvas element.
async function openView(state: SimpleViewState) {
  if (undefined === theViewport) {
    const vpDiv = document.getElementById("imodel-viewport") as HTMLDivElement;
    theViewport = ScreenViewport.create(vpDiv, state.viewState!);

    const tileLoadIndicatorDiv = document.getElementById("tileLoadIndicatorContainer") as HTMLDivElement;
    new TileLoadIndicator(tileLoadIndicatorDiv, theViewport);
  }

  await _changeView(state.viewState!);
  theViewport.addFeatureOverrides = addFeatureOverrides;
  IModelApp.viewManager.addViewport(theViewport);
}

async function _changeView(view: ViewState) {
  stopAnimation(); // cease any previous animation
  theViewport!.changeView(view);
  activeViewState.viewState = view;
  await buildModelMenu(activeViewState);
  await updateCategoryPicker();
  await buildContextRealityModelMenu(activeViewState);
}

export class DrawingAidTestTool extends PrimitiveTool {
  public static toolId = "DrawingAidTest.Points";
  public readonly points: Point3d[] = [];
  protected _snapGeomId?: string;

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    if (0 === this.points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (this.points.length > 1 && !(this.points[this.points.length - 1].isAlmostEqual(this.points[this.points.length - 2])))
      hints.setXAxis(Vector3d.createStartEnd(this.points[this.points.length - 2], this.points[this.points.length - 1])); // Rotate AccuDraw to last segment...

    hints.setOrigin(this.points[this.points.length - 1]);
    hints.sendHints();
  }

  public testDecorationHit(id: string): boolean { return id === this._snapGeomId; }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this.points.length < 2)
      return undefined;

    const geomData = GeomJson.Writer.toIModelJson(LineString3d.create(this.points));
    return (undefined === geomData ? undefined : [geomData]);
  }

  public decorate(context: DecorateContext): void {
    if (this.points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString(this.points);

    context.addDecorationFromBuilder(builder);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.points.length < 1)
      return;

    const builder = context.createSceneGraphicBuilder();

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this.points[this.points.length - 1], ev.point]); // Only draw current segment in dynamics, accepted segments are drawn as pickable decorations...

    context.addGraphic(builder.finish());
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined !== IModelApp.accuSnap.currHit) {
      const status = await IModelApp.accuSnap.resetButton(); // TESTING ONLY - NOT NORMAL TOOL OPERATION - Exercise AccuSnap hit cycling...only restart when no current hit or not hot snap on next hit...
      if (SnapStatus.Success === status)
        return EventHandled.No;
    }
    this.onReinitialize();
    return EventHandled.No;
  }

  public onUndoPreviousStep(): boolean {
    if (0 === this.points.length)
      return false;

    this.points.pop();
    if (0 === this.points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (wentDown) {
      switch (keyEvent.key) {
        case " ":
          AccuDrawShortcuts.changeCompassMode();
          break;
        case "Enter":
          AccuDrawShortcuts.lockSmart();
          break;
        case "x":
        case "X":
          AccuDrawShortcuts.lockX();
          break;
        case "y":
        case "Y":
          AccuDrawShortcuts.lockY();
          break;
        case "z":
        case "Z":
          AccuDrawShortcuts.lockZ();
          break;
        case "a":
        case "A":
          AccuDrawShortcuts.lockAngle();
          break;
        case "d":
        case "D":
          AccuDrawShortcuts.lockDistance();
          break;
        case "t":
        case "T":
          AccuDrawShortcuts.setStandardRotation(RotationMode.Top);
          break;
        case "f":
        case "F":
          AccuDrawShortcuts.setStandardRotation(RotationMode.Front);
          break;
        case "s":
        case "S":
          AccuDrawShortcuts.setStandardRotation(RotationMode.Side);
          break;
        case "v":
        case "V":
          AccuDrawShortcuts.setStandardRotation(RotationMode.View);
          break;
        case "o":
        case "O":
          AccuDrawShortcuts.setOrigin();
          break;
        case "c":
        case "C":
          AccuDrawShortcuts.rotateCycle(false);
          break;
        case "q":
        case "Q":
          AccuDrawShortcuts.rotateAxes(true);
          break;
        case "e":
        case "E":
          AccuDrawShortcuts.rotateToElement(false);
          break;
        case "r":
        case "R":
          AccuDrawShortcuts.defineACSByPoints();
          break;
      }
    }
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new DrawingAidTestTool();
    if (!tool.run())
      this.exitTool();
  }
}

export class MeasureDistanceTool extends PrimitiveTool {
  public static toolId = "Measure.Distance";
  public readonly points: Point3d[] = [];
  public readonly segments: LineSegment3d[] = [];

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public onUnsuspend(): void { this.showPrompt(); } // TODO: Tool assistance...
  protected showPrompt(): void { }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    IModelApp.accuDraw.deactivate(); // Don't enable AccuDraw automatically when starting dynamics.
    this.showPrompt();
  }

  public decorate(context: DecorateContext): void {
    if (this.points.length > 0) {
      const tmpPoints = this.points.slice(); // Deep copy not necessary...
      const ev = new BeButtonEvent();
      IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
      tmpPoints.push(ev.point.clone());

      const builder1 = context.createGraphicBuilder(GraphicType.WorldDecoration);
      const builder2 = context.createGraphicBuilder(GraphicType.WorldOverlay);

      builder1.setSymbology(context.viewport.hilite.color, ColorDef.black, 3);
      builder2.setSymbology(context.viewport.hilite.color, ColorDef.black, 1, LinePixels.Code5);

      builder1.addLineString(tmpPoints);
      builder2.addLineString(tmpPoints);

      context.addDecorationFromBuilder(builder1);
      context.addDecorationFromBuilder(builder2);
    }

    if (this.segments.length > 0) {
      const builder3 = context.createGraphicBuilder(GraphicType.WorldDecoration);
      const builder4 = context.createGraphicBuilder(GraphicType.WorldOverlay);

      builder3.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 3);
      builder4.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.Code5);

      for (const segment of this.segments) {
        builder3.addLineString([segment.point0Ref, segment.point1Ref]);
        builder4.addLineString([segment.point0Ref, segment.point1Ref]);
      }

      builder4.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 8);

      for (const segment of this.segments)
        builder4.addPointString([segment.point0Ref, segment.point1Ref]);

      context.addDecorationFromBuilder(builder3);
      context.addDecorationFromBuilder(builder4);
    }
  }

  public decorateSuspended(context: DecorateContext): void { this.decorate(context); }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { if (this.points.length > 0 && undefined !== ev.viewport) ev.viewport.invalidateDecorations(); }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (this.points.length < 2) {
      IModelApp.toolAdmin.setCursor(IModelApp.viewManager.dynamicsCursor);
    } else if (!ev.isControlKey) {
      for (let i = 0; i < this.points.length - 1; i++)
        this.segments.push(LineSegment3d.create(this.points[i], this.points[i + 1]));
      this.points.length = 0;
      IModelApp.toolAdmin.setCursor(IModelApp.viewManager.crossHairCursor);
      if (undefined !== ev.viewport)
        ev.viewport.invalidateDecorations();
    }

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (wentDown) {
      switch (keyEvent.key) {
        case "u":
        case "U":
          this.undoPreviousStep(); // TESTING...
          break;
      }
    }
    return EventHandled.No;
  }

  public onUndoPreviousStep(): boolean {
    if (0 === this.points.length && 0 === this.segments.length)
      return false;

    if (0 !== this.points.length)
      this.points.pop();
    else
      this.segments.pop();

    if (0 === this.points.length && 0 === this.segments.length) {
      this.onReinitialize();
    } else {
      if (0 === this.points.length)
        IModelApp.toolAdmin.setCursor(IModelApp.viewManager.crossHairCursor);
      this.setupAndPromptForNextAction();
    }
    return true;
  }

  public onRestartTool(): void {
    const tool = new MeasureDistanceTool();
    if (!tool.run())
      this.exitTool();
  }
}

// Starts drawing aid test tool
function startDrawingAidTest(event: Event) {
  const menu = document.getElementById("snapModeList") as HTMLDivElement;
  if (event.target === menu)
    return;
  IModelApp.tools.run("DrawingAidTest.Points", theViewport!);
  // IModelApp.tools.run("Measure.Distance", theViewport!);
}

// functions that start viewing commands, associated with icons in wireIconsToFunctions
function startToggleCamera() {
  const togglingOff = theViewport!.isCameraOn;
  showStatus("Camera", togglingOff ? "off" : "on");
  IModelApp.tools.run("View.ToggleCamera", theViewport!);
}

// override symbology for selected elements
function changeOverrideColor() {
  const select = (document.getElementById("colorList") as HTMLSelectElement)!;
  const value = select.value;
  const transparency = Number.parseFloat(value);
  if (Number.isNaN(transparency)) {
    overrideTransparency = undefined;
    overrideColor = new ColorDef(select.value);
  } else {
    overrideTransparency = transparency;
    overrideColor = undefined;
  }

  theViewport!.view.setFeatureOverridesDirty();
}

// change iModel on mobile app
async function changeModel(event: any) {
  const modelName = event.target.selectedOptions["0"].value;
  await resetStandaloneIModel("sample_documents/" + modelName);
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
  let accessToken: AccessToken | undefined;
  if (activeViewState.iModelConnection !== undefined) {
    if (configuration.standalone) {
      await activeViewState.iModelConnection.closeStandalone();
      if (configuration.signInForStandalone)
        accessToken = activeViewState.accessToken;
    } else {
      await activeViewState.iModelConnection!.close(activeViewState.accessToken!);
    }
  }

  activeViewState = new SimpleViewState();
  activeViewState.accessToken = accessToken;
  viewMap.clear();
  document.getElementById("viewList")!.innerHTML = "";
}

async function resetStandaloneIModel(filename: string) {
  const spinner = document.getElementById("spinner") as HTMLDivElement;

  spinner.style.display = "block";
  IModelApp.viewManager.dropViewport(theViewport!, false);
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

function keepOpenDebugToolsMenu(_open: boolean = true) { // keep open debug tool menu
  const menu = document.getElementById("debugToolsMenu") as HTMLDivElement;
  menu.style.display = menu.style.display === "none" || menu.style.display === "" ? "block" : "none";
}

function saveImage() {
  const vp = theViewport!;
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

// associate viewing commands to icons. I couldn't get assigning these in the HTML to work.
function wireIconsToFunctions() {
  if (MobileRpcConfiguration.isMobileFrontend) {
    const modelList = document.createElement("select");
    modelList.id = "modelList";
    // Use hardcoded list for test sample files
    modelList.innerHTML =
      " <option value='04_Plant.i.ibim'>04_Plant</option> \
        <option value='almostopaque.ibim'>almostopaque</option> \
        <option value='mesh_widget_piece.ibim'>mesh_widget_piece</option> \
        <option value='PhotoRealisticRendering.ibim'>PhotoRealisticRendering</option> \
        <option value='PSolidNewTransparent.ibim'>PSolidNewTransparent</option> \
        <option value='rectangle.ibim'>rectangle</option> \
        <option value='scattergories.ibim'>scattergories</option> \
        <option value='SketchOnSurface.ibim'>SketchOnSurface</option> \
        <option value='slabs.ibim'>slabs</option> \
        <option value='small_building_2.ibim'>small_building_2</option> \
        <option value='tr_blk.ibim'>tr_blk</option>";

    document.getElementById("toolBar")!.replaceChild(modelList, document.getElementById("selectIModel")!);
    modelList.addEventListener("change", changeModel);
  } else {
    document.getElementById("selectIModel")!.addEventListener("click", selectIModel);
  }

  document.getElementById("viewList")!.addEventListener("change", changeView);
  document.getElementById("animationSlider")!.addEventListener("input", processAnimationSliderAdjustment);

  const addClickListener = (el: string, listener: (ev: Event) => void) => { document.getElementById(el)!.addEventListener("click", listener); };
  addClickListener("startToggleModel", startToggleModel);
  addClickListener("startToggleContextRealityModel", startToggleContextRealityModel);
  addClickListener("startToggleCamera", startToggleCamera);
  addClickListener("startFit", () => IModelApp.tools.run("View.Fit", theViewport, true));
  addClickListener("startWindowArea", () => IModelApp.tools.run("View.WindowArea", theViewport));
  addClickListener("startSelect", () => IModelApp.tools.run("Select"));
  addClickListener("startDrawingAidTest", startDrawingAidTest);
  addClickListener("startWalk", () => IModelApp.tools.run("View.Walk", theViewport));
  addClickListener("startRotateView", () => IModelApp.tools.run("View.Rotate", theViewport));
  addClickListener("switchStandardRotation", toggleStandardViewMenu);
  addClickListener("debugTools", toggleDebugToolsMenu);
  addClickListener("debugPanelToggle", toggleDebugPanel);
  addClickListener("categoryPickerToggle", toggleCategoryPicker);
  addClickListener("viewAttributesToggle", toggleViewAttributes);
  addClickListener("snapModeToggle", toggleSnapModeMenu);
  addClickListener("doUndo", () => IModelApp.tools.run("View.Undo", theViewport));
  addClickListener("doRedo", () => IModelApp.tools.run("View.Redo", theViewport));
  addClickListener("showAnimationMenu", toggleAnimationMenu);
  addClickListener("animationPlay", startAnimation);
  addClickListener("animationPause", pauseAnimation);
  addClickListener("animationStop", stopAnimation);
  addClickListener("animationMenu", processAnimationMenuEvent);

  // debug tool handlers
  addClickListener("incidentMarkers", () => toggleIncidentMarkers(activeViewState.iModelConnection!.projectExtents));
  addClickListener("projectExtents", () => toggleProjectExtents(activeViewState.iModelConnection!));
  addClickListener("saveImage", () => saveImage());
  addClickListener("debugToolsMenu", () => keepOpenDebugToolsMenu());

  // standard view rotation handlers
  addClickListener("top", () => applyStandardViewRotation(StandardViewId.Top, "Top"));
  addClickListener("bottom", () => applyStandardViewRotation(StandardViewId.Bottom, "Bottom"));
  addClickListener("left", () => applyStandardViewRotation(StandardViewId.Left, "Left"));
  addClickListener("right", () => applyStandardViewRotation(StandardViewId.Right, "Right"));
  addClickListener("front", () => applyStandardViewRotation(StandardViewId.Front, "Front"));
  addClickListener("back", () => applyStandardViewRotation(StandardViewId.Back, "Back"));
  addClickListener("iso", () => applyStandardViewRotation(StandardViewId.Iso, "Iso"));
  addClickListener("rightIso", () => applyStandardViewRotation(StandardViewId.RightIso, "RightIso"));

  document.getElementById("colorList")!.addEventListener("change", () => changeOverrideColor());

  // File Selector for the browser (a change represents a file selection)... only used when in browser and given base path for local files
  document.getElementById("browserFileSelector")!.addEventListener("change", async function onChange(this: HTMLElement) {
    const files = (this as any).files;
    if (files !== undefined && files.length > 0) {
      try {
        await resetStandaloneIModel(configuration.standalonePath + "/" + files[0].name);
      } catch {
        alert("Error Opening iModel - Make sure you are selecting files from the following directory: " + configuration.standalonePath);
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
      activeViewState.iModelConnection.closeStandalone(); // tslint:disable-line:no-floating-promises
    else
      activeViewState.iModelConnection.close(activeViewState.accessToken!); // tslint:disable-line:no-floating-promises
};

function stringToSnapModes(name: string): SnapMode[] {
  const snaps: SnapMode[] = [];
  switch (name) {
    case "Keypoint":
      snaps.push(SnapMode.NearestKeypoint);
      break;
    case "Nearest":
      snaps.push(SnapMode.Nearest);
      break;
    case "Center":
      snaps.push(SnapMode.Center);
      break;
    case "Origin":
      snaps.push(SnapMode.Origin);
      break;
    case "Intersection":
      snaps.push(SnapMode.Intersection);
      break;
    default:
      snaps.push(SnapMode.NearestKeypoint);
      snaps.push(SnapMode.Nearest);
      snaps.push(SnapMode.Intersection);
      snaps.push(SnapMode.MidPoint);
      snaps.push(SnapMode.Origin);
      snaps.push(SnapMode.Center);
      snaps.push(SnapMode.Bisector);
      break;
  }
  return snaps;
}

class SVTAccuSnap extends AccuSnap {
  public get keypointDivisor() { return 2; }
  public getActiveSnapModes(): SnapMode[] {
    const select = (document.getElementById("snapModeList") as HTMLSelectElement)!;
    return stringToSnapModes(select.value);
  }
}

class SVTNotifications extends NotificationManager {
  private _toolTip?: ToolTip;
  private _el?: HTMLElement;
  private _tooltipDiv?: HTMLDivElement;

  public outputPrompt(prompt: string) { showStatus(prompt); }

  /** Output a message and/or alert to the user. */
  public outputMessage(message: NotifyMessageDetails) { showError(message.briefMessage); }

  public async openMessageBox(_mbType: MessageBoxType, _message: string, _icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const rootDiv: HTMLDivElement = document.getElementById("root") as HTMLDivElement;
    if (!rootDiv)
      return Promise.resolve(MessageBoxValue.Cancel);
    // create a dialog element.
    const dialog: HTMLDialogElement = document.createElement("dialog") as HTMLDialogElement;
    dialog.className = "notification-messagebox";

    // set up the message
    const span: HTMLSpanElement = document.createElement("span");
    span.innerHTML = _message;
    span.className = "notification-messageboxtext";
    dialog.appendChild(span);

    // make the ok button.
    const button: HTMLButtonElement = document.createElement("button");
    button.className = "notification-messageboxbutton";
    button.innerHTML = "Ok";
    button.onclick = (event) => {
      const okButton = event.target as HTMLButtonElement;
      const msgDialog = okButton.parentElement as HTMLDialogElement;
      const topDiv = msgDialog.parentElement as HTMLDivElement;
      msgDialog.close();
      topDiv.removeChild(dialog);
    };
    dialog.appendChild(button);

    // add the dialog to the root div element and show it.
    rootDiv.appendChild(dialog);
    dialog.showModal();

    return Promise.resolve(MessageBoxValue.Ok);
  }

  public get isToolTipSupported(): boolean { return true; }
  public get isToolTipOpen(): boolean { return undefined !== this._toolTip; }

  public clearToolTip(): void {
    if (!this.isToolTipOpen)
      return;

    this._toolTip!.dispose();
    this._el!.removeChild(this._tooltipDiv!);
    this._toolTip = undefined;
    this._el = undefined;
    this._tooltipDiv = undefined;
  }

  protected _showToolTip(el: HTMLElement, message: HTMLElement | string, pt?: XAndY, options?: ToolTipOptions): void {
    this.clearToolTip();

    const rect = el.getBoundingClientRect();
    if (undefined === pt)
      pt = { x: rect.width / 2, y: rect.height / 2 };

    const location = document.createElement("div");
    const height = 20;
    const width = 20;
    location.style.position = "absolute";
    location.style.top = (pt.y - height / 2) + "px";
    location.style.left = (pt.x - width / 2) + "px";
    location.style.width = width + "px";
    location.style.height = height + "px";

    el.appendChild(location);

    this._el = el;
    this._tooltipDiv = location;
    this._toolTip = new ToolTip(location, { trigger: "manual", html: true, placement: (options && options.placement) ? options.placement as any : "right-start", title: message });
    this._toolTip!.show();
  }
}

class SVTIModelApp extends IModelApp {
  protected static onStartup(): void {
    IModelApp.accuSnap = new SVTAccuSnap();
    IModelApp.notifications = new SVTNotifications();
    const svtToolNamespace = IModelApp.i18n.registerNamespace("SVTTools");
    DrawingAidTestTool.register(svtToolNamespace);
    // MeasureDistanceTool.register(svtToolNamespace);
  }
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

async function initializeOidc(actx: ActivityLoggingContext) {
  actx.enter();

  const clientId = Config.App.get("imjs_browser_test_client_id");
  const redirectUri = Config.App.getString("imjs_browser_test_redirect_uri"); // must be set in config
  const oidcConfig: OidcFrontendClientConfiguration = { clientId, redirectUri };

  await OidcClientWrapper.initialize(actx, oidcConfig);
  actx.enter();

  OidcClientWrapper.oidcClient.onUserStateChanged.addListener((accessToken: AccessToken | undefined) => {
    activeViewState.accessToken = accessToken;
  });

  activeViewState.accessToken = await OidcClientWrapper.oidcClient.getAccessToken(actx);
  actx.enter();
}

// main entry point.
async function main() {
  const actx = new ActivityLoggingContext(Guid.createValue());
  actx.enter();

  if (!MobileRpcConfiguration.isMobileFrontend) {
    // retrieve, set, and output the global configuration variable
    await retrieveConfiguration(); // (does a fetch)
    console.log("Configuration", JSON.stringify(configuration));
  }
  // Start the app. (This tries to fetch a number of localization json files from the origin.)
  SVTIModelApp.startup();

  // Choose RpcConfiguration based on whether we are in electron or browser
  let rpcConfiguration: RpcConfiguration;
  if (ElectronRpcConfiguration.isElectron) {
    rpcConfiguration = ElectronRpcManager.initializeClient({}, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
  } else if (MobileRpcConfiguration.isMobileFrontend) {
    Object.assign(configuration, { standalone: true, iModelName: "sample_documents/04_Plant.i.ibim" });
    rpcConfiguration = MobileRpcManager.initializeClient([IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
  } else {
    const uriPrefix = configuration.customOrchestratorUri || "http://localhost:3001";
    rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "SimpleViewApp", version: "v1.0" }, uriPrefix }, [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface]);
    // WIP: WebAppRpcProtocol seems to require an IModelToken for every RPC request. ECPresentation initialization tries to set active locale using
    // RPC without any imodel and fails...
    for (const definition of rpcConfiguration.interfaces())
      RpcOperation.forEach(definition, (operation) => operation.policy.token = (_request) => new IModelToken("test", "test", "test", "test", OpenMode.Readonly));
  }

  const uiReady = displayUi();  // Get the browser started loading our html page and the svgs that it references but DON'T WAIT

  // while the browser is loading stuff, start work on logging in and downloading the imodel, etc.
  try {
    if (configuration.standalone && !configuration.signInForStandalone) {
      await openStandaloneIModel(activeViewState, configuration.iModelName!);
      await uiReady; // Now wait for the HTML UI to finish loading.
      await initView();
      return;
    }

    await initializeOidc(actx);
    actx.enter();

    if (!activeViewState.accessToken)
      OidcClientWrapper.oidcClient.signIn(actx);
    else {
      if (configuration.standalone)
        await openStandaloneIModel(activeViewState, configuration.iModelName!);
      else
        await openIModel(activeViewState);

      await uiReady; // Now, wait for the HTML UI to finish loading.
      await initView();
    }
  } catch (reason) {
    alert(reason);
    return;
  }
}

async function initView() {
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
main(); // tslint:disable-line:no-floating-promises
