// This source code was derived from mpetroff/pannellum on github, and modified
// to convert it to more modern typescript. I dropped support for the cubemap
// and the multires types to simplify it, since we use it only for panoramic images.

/*
 * Pannellum - An HTML5 based Panorama Viewer
 * Copyright (c) 2011-2019 Matthew Petroff
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// tslint:disable:no-console

import { PannellumRenderer } from "./pannellumRender";
import { I18N } from "@bentley/imodeljs-i18n";

import "./css/pannellum.css";

interface StartEnd {
  startTime: number;
  startPosition: number;
  endPosition: number;
  duration: number;
}

interface Move {
  pitch?: StartEnd;
  yaw?: StartEnd;
  hfov?: StartEnd;
}

interface Speed {
  pitch: number;
  yaw: number;
  hfov: number;
}

interface PointerCoordinates {
  clientX: number;
  clientY: number;
}

type EscapeFunc = () => void;

export interface PannellumHotSpot {
  yaw: number;
  pitch: number;
  cssClassName?: string;
  text?: string;
  video?: string;
  image?: string;
  URL?: string;
  width?: number;
  scale?: boolean;
  attributes?: string[];
  clickHandlerFunc?: (ev: MouseEvent, args: any) => void;
  clickHandlerArgs?: any;
  createTooltipFunc?: (div: HTMLDivElement, args: any) => void;
  createTooltipArgs?: any;
  styleFunc?: (hs: PannellumHotSpot, args: any) => void;
  styleArgs?: any;
  div?: HTMLDivElement | null;
}

export interface PannellumViewerConfig {
  hfov?: number;      // horizontal field of view
  minHfov?: number;   // minimum horizontal field of view
  maxHfov?: number;
  pitch?: number;     // pitch angle
  minPitch?: number;
  maxPitch?: number;
  yaw?: number;       // yaw angle.
  minYaw?: number;
  maxYaw?: number;
  roll?: number;    // roll angle.
  haov?: number;    // horizontal angle of view
  vaov?: number;    // vertical angle of view
  vOffset?: number;
  autoRotate?: number;
  autoRotateInactivityDelay?: number;
  autoRotateStopDelay?: number | undefined;
  northOffset?: number;
  showFullscreenCtrl?: boolean;
  dynamic?: boolean;
  dynamicUpdate?: boolean;
  doubleClickZoom?: boolean;
  keyboardZoom?: boolean;
  mouseZoom?: boolean;
  showZoomCtrl?: boolean;
  showControls?: boolean;
  orientationOnByDefault?: boolean;
  hotSpotDebug?: boolean;
  backgroundColor?: number[];
  avoidShowingBackground?: boolean;
  animationTimingFunction?: any;
  draggable?: boolean;
  disableKeyboardCtrl?: boolean;
  touchPanSpeedCoeffFactor?: number;
  capturedKeyNumbers?: number[];
  friction?: number;
  compass?: boolean;
  horizonPitch?: number;
  horizonRoll?: number;
  sceneFadeDuration?: number;
  title?: string;
  author?: string;
  authorURL?: string;
  hotSpots?: PannellumHotSpot[];
  escapeKeyFunc?: EscapeFunc;
}

interface PannellumViewerParameters {
  hfov: number;
  minHfov: number;
  maxHfov: number;
  pitch: number;
  minPitch: number;
  maxPitch: number;
  yaw: number;
  minYaw: number;
  maxYaw: number;
  roll: number;
  haov: number;
  vaov: number;
  vOffset: number;
  autoRotate: number;
  autoRotateInactivityDelay: number;
  autoRotateStopDelay: number | undefined;
  northOffset: number;
  showFullscreenCtrl: boolean;
  dynamic: boolean;
  dynamicUpdate: boolean;
  doubleClickZoom: boolean;
  keyboardZoom: boolean;
  mouseZoom: boolean;
  showZoomCtrl: boolean;
  showControls: boolean;
  orientationOnByDefault: boolean;
  hotSpotDebug: boolean;
  backgroundColor: number[];
  avoidShowingBackground: boolean;
  animationTimingFunction: any;
  draggable: boolean;
  disableKeyboardCtrl: boolean;
  touchPanSpeedCoeffFactor: number;
  capturedKeyNumbers: number[];
  friction: number;
  compass: boolean;
  horizonPitch: number;
  horizonRoll: number;
  sceneFadeDuration: number;
  title: string | undefined;
  author: string | undefined;
  authorURL: string | undefined;
  hotSpots: PannellumHotSpot[] | undefined;
  escapeKeyFunc: EscapeFunc | undefined;
}

export class PannellumViewer {
  private _config: PannellumViewerParameters;
  private _initialConfig: PannellumViewerConfig | undefined;
  private _renderer: PannellumRenderer | undefined;
  private _preview: HTMLElement | undefined;
  private _isUserInteracting: boolean = false;
  private _latestInteraction: number = Date.now();
  private _onPointerDownPointerX: number = 0;
  private _onPointerDownPointerY: number = 0;
  private _onPointerDownPointerDist: number = -1;
  private _onPointerDownYaw: number = 0;
  private _onPointerDownPitch: number = 0;
  private _keysDown: boolean[] = new Array(10);
  private _fullscreenActive: boolean = false;
  private _loaded: boolean | undefined;
  private _error: boolean = false;
  private _listenersAdded: boolean = false;
  private _panoImage: HTMLImageElement | undefined;
  private _prevTime: number | undefined = Date.now();
  private _speed: Speed = { yaw: 0, pitch: 0, hfov: 0 };
  private _animating: boolean = false;
  private _orientation: boolean | number = false;
  private _orientationYawOffset: number = 0;
  private _autoRotateStart: any | undefined;
  private _autoRotateSpeed: number = 0;
  private _origHfov: number;
  private _origPitch: number;
  private _animatedMove: Move = this.noMove();
  private _animationStoppedForNewPanorama: boolean = false;
  private _externalEventListeners: any = {};
  private _specifiedPhotoSphereExcludes: string[] = [];
  private _eps: number = 1e-6;
  private _infoDisplay: any;
  private _destroyed = false;
  private _container: HTMLElement;
  private _uiContainer: HTMLDivElement;
  private _dragFix: HTMLDivElement;
  private _renderContainer: HTMLDivElement;
  private _aboutMsg: HTMLSpanElement;
  private _hotSpotDebugIndicator: HTMLDivElement;
  private _compass: HTMLDivElement;
  private _controls: any;
  private _pointerIDs: Array<number | undefined> = [];
  private _pointerCoordinates: PointerCoordinates[] = [];
  private _orientationSupport: boolean;
  private _startOrientationIfSupported: boolean;
  private _hotSpotsCreated: boolean = false;
  private _i18n: I18N;

  private _defaultConfig: PannellumViewerParameters = {
    hfov: 100,
    minHfov: 50,
    maxHfov: 120,
    pitch: 0,
    minPitch: -90,
    maxPitch: 90,
    yaw: 0,
    minYaw: -180,
    maxYaw: 180,
    roll: 0,
    haov: 360,
    vaov: 180,
    vOffset: 0,
    autoRotate: 0,
    autoRotateInactivityDelay: -1,
    autoRotateStopDelay: undefined,
    northOffset: 0,
    showFullscreenCtrl: true,
    dynamic: false,
    dynamicUpdate: false,
    doubleClickZoom: true,
    keyboardZoom: true,
    mouseZoom: true,
    showZoomCtrl: true,
    showControls: true,
    orientationOnByDefault: false,
    hotSpotDebug: false,
    backgroundColor: [0, 0, 0],
    avoidShowingBackground: false,
    animationTimingFunction: this.timingFunction,
    draggable: true,
    disableKeyboardCtrl: false,
    touchPanSpeedCoeffFactor: 1,
    capturedKeyNumbers: [16, 17, 27, 37, 38, 39, 40, 61, 65, 68, 83, 87, 107, 109, 173, 187, 189],
    friction: 0.15,
    compass: false,
    horizonPitch: 0,
    horizonRoll: 0,
    sceneFadeDuration: 1000,
    title: undefined,
    author: undefined,
    authorURL: undefined,
    hotSpots: undefined,
    escapeKeyFunc: undefined,
  };

  /**
   * Creates a new panorama viewer.
   * @constructor
   * @param {HTMLElement|string} container - The container (div) element for the
   *      viewer, or its ID.
   * @param {I18n} i18n - the internationalization provider.
   * @param {Object} initialConfig - Inital configuration for viewer.
   */
  constructor(container: HTMLElement | string | null, i18n: I18N, initialConfig?: PannellumViewerConfig) {

    // initialize config;
    this._config = Object.assign(this._defaultConfig);
    this._initialConfig = initialConfig;
    this._i18n = i18n;
    this._origHfov = this._config.hfov;
    this._origPitch = this._config.pitch;

    // Initialize container
    container = typeof container === "string" ? document.getElementById(container) : container;
    if (!container)
      throw new Error("container specification invalid");

    this._container = container;

    this._container.classList.add("pnlm-this._container");
    this._container.tabIndex = 0;

    this._uiContainer = document.createElement("div");

    // Create container for ui
    this._uiContainer.className = "pnlm-ui";
    this._container.appendChild(this._uiContainer);

    // Create container for renderer
    this._renderContainer = document.createElement("div");
    this._renderContainer.className = "pnlm-render-container";
    this._container.appendChild(this._renderContainer);

    this._dragFix = document.createElement("div");
    this._dragFix.className = "pnlm-dragfix";
    this._uiContainer.appendChild(this._dragFix);

    // Display about information on right click
    this._aboutMsg = document.createElement("span");
    this._aboutMsg.className = "pnlm-about-msg";
    this._aboutMsg.innerHTML = '<a href="https://pannellum.org/" target="_blank">Pannellum</a>';
    this._uiContainer.appendChild(this._aboutMsg);
    this._dragFix.addEventListener("contextmenu", this.aboutMessage.bind(this));

    // Create info display
    this._infoDisplay = {};

    // Hot spot debug indicator
    this._hotSpotDebugIndicator = document.createElement("div");
    this._hotSpotDebugIndicator.className = "pnlm-sprite pnlm-hot-spot-debug-indicator";
    this._uiContainer.appendChild(this._hotSpotDebugIndicator);

    // Panorama info
    this._infoDisplay.container = document.createElement("div");
    this._infoDisplay.container.className = "pnlm-panorama-info";
    this._infoDisplay.title = document.createElement("div");
    this._infoDisplay.title.className = "pnlm-title-box";
    this._infoDisplay.container.appendChild(this._infoDisplay.title);
    this._infoDisplay.author = document.createElement("div");
    this._infoDisplay.author.className = "pnlm-author-box";
    this._infoDisplay.container.appendChild(this._infoDisplay.author);
    this._uiContainer.appendChild(this._infoDisplay.container);

    /* ------------- We don't need the load stuff - we are always autoloading.
    // Load box
    this._infoDisplay.load = {};
    this._infoDisplay.load.box = document.createElement("div");
    this._infoDisplay.load.box.className = "pnlm-load-box";
    this._infoDisplay.load.boxp = document.createElement("p");
    this._infoDisplay.load.box.appendChild(this._infoDisplay.load.boxp);
    this._infoDisplay.load.lbox = document.createElement("div");
    this._infoDisplay.load.lbox.className = "pnlm-lbox";
    this._infoDisplay.load.lbox.innerHTML = '<div class="pnlm - loading"></div>';
    this._infoDisplay.load.box.appendChild(this._infoDisplay.load.lbox);
    this._infoDisplay.load.lbar = document.createElement("div");
    this._infoDisplay.load.lbar.className = "pnlm-lbar";
    this._infoDisplay.load.lbarFill = document.createElement("div");
    this._infoDisplay.load.lbarFill.className = "pnlm-lbar-fill";
    this._infoDisplay.load.lbar.appendChild(this._infoDisplay.load.lbarFill);
    this._infoDisplay.load.box.appendChild(this._infoDisplay.load.lbar);
    this._infoDisplay.load.msg = document.createElement("p");
    this._infoDisplay.load.msg.className = "pnlm-lmsg";
    this._infoDisplay.load.box.appendChild(this._infoDisplay.load.msg);
    this._uiContainer.appendChild(this._infoDisplay.load.box);
    -------------------------------------------------------------------- */

    // Error message
    this._infoDisplay.errorMsg = document.createElement("div");
    this._infoDisplay.errorMsg.className = "pnlm-error-msg pnlm-info-box";
    this._uiContainer.appendChild(this._infoDisplay.errorMsg);

    // Create controls
    this._controls = {};
    this._controls.container = document.createElement("div");
    this._controls.container.className = "pnlm-controls-container";
    this._uiContainer.appendChild(this._controls.container);

    /* ----- we don't need a load button - we always autoload. ----
    // Load button
    this._controls.load = document.createElement("div");
    this._controls.load.className = "pnlm-load-button";
    this._controls.load.addEventListener("click", () => {
      this.processOptions();
      this.load();
    });
    this._uiContainer.appendChild(this._controls.load);
    -------------------------------- */

    // Zoom controls
    this._controls.zoom = document.createElement("div");
    this._controls.zoom.className = "pnlm-zoom-controls pnlm-controls";
    this._controls.zoomIn = document.createElement("div");
    this._controls.zoomIn.className = "pnlm-zoom-in pnlm-sprite pnlm-control";
    this._controls.zoomIn.addEventListener("click", this.zoomIn.bind(this));
    this._controls.zoom.appendChild(this._controls.zoomIn);
    this._controls.zoomOut = document.createElement("div");
    this._controls.zoomOut.className = "pnlm-zoom-out pnlm-sprite pnlm-control";
    this._controls.zoomOut.addEventListener("click", this.zoomOut.bind(this));
    this._controls.zoom.appendChild(this._controls.zoomOut);
    this._controls.container.appendChild(this._controls.zoom);

    // Fullscreen toggle
    this._controls.fullscreen = document.createElement("div");
    this._controls.fullscreen.addEventListener("click", this.toggleFullscreen.bind(this));
    this._controls.fullscreen.className = "pnlm-fullscreen-toggle-button pnlm-sprite pnlm-fullscreen-toggle-button-inactive pnlm-controls pnlm-control";
    if (document.fullscreenEnabled)
      this._controls.container.appendChild(this._controls.fullscreen);

    // Device orientation toggle
    this._controls.orientation = document.createElement("div");
    this._controls.orientation.addEventListener("click", () => {
      if (this._orientation)
        this.stopOrientation();
      else
        this.startOrientation();
    });
    this._controls.orientation.addEventListener("mousedown", (e: Event) => { e.stopPropagation(); });
    this._controls.orientation.addEventListener("touchstart", (e: Event) => { e.stopPropagation(); });
    this._controls.orientation.addEventListener("pointerdown", (e: Event) => { e.stopPropagation(); });
    this._controls.orientation.className = "pnlm-orientation-button pnlm-orientation-button-inactive pnlm-sprite pnlm-controls pnlm-control";

    this._orientationSupport = false;
    this._startOrientationIfSupported = false;

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", this.deviceOrientationTest.bind(this));
    } else {
      this._orientationSupport = false;
    }

    // Compass
    this._compass = document.createElement("div");
    this._compass.className = "pnlm-compass pnlm-controls pnlm-control";
    this._uiContainer.appendChild(this._compass);

    // Load and process configuration
    this.mergeConfig();
    this.processOptions();
  }

  /* uses event to test for orientationSupport */
  private deviceOrientationTest(e: DeviceOrientationEvent) {
    window.removeEventListener("deviceorientation", this.deviceOrientationTest);
    if (e && e.alpha !== null && e.beta !== null && e.gamma !== null) {
      this._controls.container.appendChild(this._controls.orientation);
      this._orientationSupport = true;
      if (this._startOrientationIfSupported)
        this.startOrientation();
    } else {
      this._orientationSupport = false;
    }
  }

  /**
   * Initializes viewer.
   * @private
   */
  public initialView(panoBlob: Blob): void {

    this._origHfov = this._config.hfov;
    this._origPitch = this._config.pitch;

    this.parseGPanoXMP(panoBlob);

    if (this._config.draggable)
      this._uiContainer.classList.add("pnlm-grab");
    this._uiContainer.classList.remove("pnlm-grabbing");
  }

  public newPanorama(panoBlob: Blob, config: PannellumViewerConfig) {
    // leave yaw alone, but
    this._animationStoppedForNewPanorama = true;
    this.stopMovement();
    this.destroyHotSpots();
    this._config.hotSpots = config.hotSpots;
    this.createHotSpots();
    this._config.title = config.title;
    this.processDisplayedOptions();
    this.parseGPanoXMP(panoBlob);
    this._animationStoppedForNewPanorama = false;
  }

  /**
   * Create renderer and initialize event listeners once image is loaded.
   * @private
   */
  private onImageLoad() {
    if (undefined === this._panoImage) {
      this.anError(this._i18n.translate("geoPhoto:pannellum.noPanoramaError"));
      return;
    }

    if (!this._renderer)
      this._renderer = new PannellumRenderer(this._renderContainer);

    // Only add event listeners once
    if (!this._listenersAdded) {
      this._listenersAdded = true;
      this._dragFix.addEventListener("mousedown", this.onDocumentMouseDown.bind(this), false);
      document.addEventListener("mousemove", this.onDocumentMouseMove.bind(this), false);
      document.addEventListener("mouseup", this.onDocumentMouseUp.bind(this), false);
      if (this._config.mouseZoom) {
        this._uiContainer.addEventListener("wheel", this.onDocumentMouseWheel.bind(this), false);
      }
      if (this._config.doubleClickZoom) {
        this._dragFix.addEventListener("dblclick", this.onDocumentDoubleClick.bind(this), false);
      }
      this._container.addEventListener("webkitfullscreenchange", this.onFullScreenChange.bind(this), false);
      this._container.addEventListener("fullscreenchange", this.onFullScreenChange.bind(this), false);
      window.addEventListener("resize", this.onDocumentResize.bind(this), false);
      window.addEventListener("orientationchange", this.onDocumentResize.bind(this), false);
      if (!this._config.disableKeyboardCtrl) {
        this._container.addEventListener("keydown", this.onDocumentKeyPress.bind(this), false);
        this._container.addEventListener("keyup", this.onDocumentKeyUp.bind(this), false);
        this._container.addEventListener("blur", this.clearKeys.bind(this), false);
      }
      document.addEventListener("mouseleave", this.onDocumentMouseUp.bind(this), false);
      if (document.documentElement.style.touchAction === "") {
        this._dragFix.addEventListener("pointerdown", this.onDocumentPointerDown.bind(this), false);
        this._dragFix.addEventListener("pointermove", this.onDocumentPointerMove.bind(this), false);
        this._dragFix.addEventListener("pointerup", this.onDocumentPointerUp.bind(this), false);
        this._dragFix.addEventListener("pointerleave", this.onDocumentPointerUp, false);
      } else {
        this._dragFix.addEventListener("touchstart", this.onDocumentTouchStart.bind(this), false);
        this._dragFix.addEventListener("touchmove", this.onDocumentTouchMove.bind(this), false);
        this._dragFix.addEventListener("touchend", this.onDocumentTouchEnd.bind(this), false);
      }

      // Deal with MS pointer events
      if (window.navigator.pointerEnabled)
        this._container.style.touchAction = "none";
    }

    this.renderInit();
    this.setHfovInternal(this._config.hfov); // possibly adapt hfov after configuration and canvas is complete; prevents empty space on top or bottom by zooming out too much
  }

  /**
   * Parses Google Photo Sphere XMP Metadata.
   * https://developers.google.com/photo-sphere/metadata/
   * @private
   * @param {Image} imageBlob - Image to read XMP metadata from.
   */
  private parseGPanoXMP(imageBlob: Blob) {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      if (typeof reader.result !== "string")
        throw new Error("couldn't read string from imageBlob");

      const img: string = reader.result as string;

      const start = img!.indexOf("<x:xmpmeta");
      if (start > -1) {
        const xmpData = img!.substring(start, img.indexOf("</x:xmpmeta>") + 12);

        // Extract the requested tag from the XMP data
        const getTag = (tag: string) => {
          let result;
          if (xmpData.indexOf(tag + '="') >= 0) {
            result = xmpData.substring(xmpData.indexOf(tag + '="') + tag.length + 2);
            result = result.substring(0, result.indexOf('"'));
          } else if (xmpData.indexOf(tag + ">") >= 0) {
            result = xmpData.substring(xmpData.indexOf(tag + ">") + tag.length + 1);
            result = result.substring(0, result.indexOf("<"));
          }
          if (result !== undefined) {
            return Number(result);
          }
          return null;
        };

        // Relevant XMP data
        const xmp = {
          fullWidth: getTag("GPano:FullPanoWidthPixels"),
          croppedWidth: getTag("GPano:CroppedAreaImageWidthPixels"),
          fullHeight: getTag("GPano:FullPanoHeightPixels"),
          croppedHeight: getTag("GPano:CroppedAreaImageHeightPixels"),
          topPixels: getTag("GPano:CroppedAreaTopPixels"),
          heading: getTag("GPano:PoseHeadingDegrees"),
          horizonPitch: getTag("GPano:PosePitchDegrees"),
          horizonRoll: getTag("GPano:PoseRollDegrees"),
        };

        if (xmp.fullWidth !== null && xmp.croppedWidth !== null &&
          xmp.fullHeight !== null && xmp.croppedHeight !== null &&
          xmp.topPixels !== null) {

          // Set up viewer using GPano XMP data
          if (this._specifiedPhotoSphereExcludes.indexOf("haov") < 0)
            this._config.haov = xmp.croppedWidth / xmp.fullWidth * 360;
          if (this._specifiedPhotoSphereExcludes.indexOf("vaov") < 0)
            this._config.vaov = xmp.croppedHeight / xmp.fullHeight * 180;
          if (this._specifiedPhotoSphereExcludes.indexOf("vOffset") < 0)
            this._config.vOffset = ((xmp.topPixels + xmp.croppedHeight / 2) / xmp.fullHeight - 0.5) * -180;
          if (xmp.heading !== null && this._specifiedPhotoSphereExcludes.indexOf("northOffset") < 0) {
            // TODO: make sure this works correctly for partial panoramas
            this._config.northOffset = xmp.heading;
          }
        }
        if (xmp.horizonPitch !== null && xmp.horizonRoll !== null) {
          if (this._specifiedPhotoSphereExcludes.indexOf("horizonPitch") < 0)
            this._config.horizonPitch = xmp.horizonPitch;
          if (this._specifiedPhotoSphereExcludes.indexOf("horizonRoll") < 0)
            this._config.horizonRoll = xmp.horizonRoll;
        }
        // TODO: add support for initial view settings
      }
      // Load panorama
      this._panoImage = new Image();
      this._panoImage.onload = this.onImageLoad.bind(this);
      this._panoImage.src = window.URL.createObjectURL(imageBlob);
    });

    reader.readAsBinaryString(imageBlob);
  }

  /**
   * Displays an error message.
   * @private
   * @param {string} errorMsg - Error message to display. If not specified, a
   *      generic WebGL error is displayed.
   */
  private anError(errorMsg?: string) {
    if (errorMsg === undefined)
      errorMsg = this._i18n.translate("geoPhoto:pannellum.genericWebGLError");
    this._infoDisplay.errorMsg.innerHTML = "<p>" + errorMsg + "</p>";
    /* ---- load not used -----
    this._controls.load.style.display = "none";
    this._infoDisplay.load.box.style.display = "none";
    ---- */
    this._infoDisplay.errorMsg.style.display = "table";
    this._error = true;
    this._loaded = undefined;
    this._renderContainer.style.display = "none";
    this.fireEvent("error", errorMsg);
  }

  /**
   * Hides error message display.
   * @private
   */
  private clearError() {
    if (this._error) {
      /* ----- load not used -----
      this._infoDisplay.load.box.style.display = "none";
      ---------------------------- */
      this._infoDisplay.errorMsg.style.display = "none";
      this._error = false;
      this._renderContainer.style.display = "block";
      this.fireEvent("errorcleared");
    }
  }

  /**
   * Displays about message.
   * @private
   * @param {MouseEvent} event - Right click location
   */
  private aboutMessage(event: MouseEvent) {
    const pos = this.mousePosition(event);
    this._aboutMsg.style.left = pos.x + "px";
    this._aboutMsg.style.top = pos.y + "px";
    clearTimeout((this.aboutMessage as any).t1);
    clearTimeout((this.aboutMessage as any).t2);
    this._aboutMsg.style.display = "block";
    this._aboutMsg.style.opacity = "1";
    (this.aboutMessage as any).at1 = setTimeout(() => { this._aboutMsg.style.opacity = "0"; }, 2000);
    (this.aboutMessage as any).t2 = setTimeout(() => { this._aboutMsg.style.display = "none"; }, 2500);
    event.preventDefault();
  }

  /**
   * Calculate mouse position relative to top left of viewer container.
   * @private
   * @param {MouseEvent} event - Mouse event to use in calculation
   * @returns {Object} Calculated X and Y coordinates
   */
  private mousePosition(event: MouseEvent): any {
    const bounds = this._container.getBoundingClientRect();
    const pos: any = {};
    // pageX / pageY needed for iOS
    pos.x = (event.clientX || event.pageX) - bounds.left;
    pos.y = (event.clientY || event.pageY) - bounds.top;
    return pos;
  }

  /**
   * Event handler for mouse clicks. Initializes panning. Prints center and click
   * location coordinates when hot spot debugging is enabled.
   * @private
   * @param {MouseEvent} event - Document mouse down event.
   */
  private onDocumentMouseDown(event: MouseEvent) {
    // Override default action
    event.preventDefault();
    // But not all of it
    this._container.focus();

    // Only do something if the panorama is loaded
    if (!this._loaded || !this._config.draggable) {
      return;
    }

    // Calculate mouse position relative to top left of viewer container
    const pos = this.mousePosition(event);

    // Log pitch / yaw of mouse click when debugging / placing hot spots
    if (this._config.hotSpotDebug) {
      const coords = this.mouseEventToCoords(event);
      console.log("Pitch: " + coords[0] + ", Yaw: " + coords[1] + ", Center Pitch: " +
        this._config.pitch + ", Center Yaw: " + this._config.yaw + ", HFOV: " + this._config.hfov);
    }

    // Turn off auto-rotation if enabled
    this.stopAnimation();

    this.stopOrientation();
    this._config.roll = 0;

    this._speed.hfov = 0;

    this._isUserInteracting = true;
    this._latestInteraction = Date.now();

    this._onPointerDownPointerX = pos.x;
    this._onPointerDownPointerY = pos.y;

    this._onPointerDownYaw = this._config.yaw;
    this._onPointerDownPitch = this._config.pitch;

    this._uiContainer.classList.add("pnlm-grabbing");
    this._uiContainer.classList.remove("pnlm-grab");

    this.fireEvent("mousedown", event);
    this.animateInit();
  }

  /**
   * Event handler for double clicks. Zooms in at clicked location
   * @private
   * @param {MouseEvent} event - Document mouse down event.
   */
  private onDocumentDoubleClick(event: MouseEvent) {
    if (this._config.minHfov === this._config.hfov) {
      this.setHfov(this._origHfov, 1000);
    } else {
      const coords = this.mouseEventToCoords(event);
      this.lookAt(coords[0], coords[1], this._config.minHfov, 1000);
    }
  }

  /**
   * Calculate panorama pitch and yaw from location of mouse event.
   * @private
   * @param {MouseEvent} event - Document mouse down event.
   * @returns {number[]} [pitch, yaw]
   */
  private mouseEventToCoords(event: MouseEvent) {
    const pos = this.mousePosition(event);
    const canvas = this._renderer!.canvas;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const x = pos.x / canvasWidth * 2 - 1;
    const y = (1 - pos.y / canvasHeight * 2) * canvasHeight / canvasWidth;
    const focal = 1 / Math.tan(this._config.hfov * Math.PI / 360);
    const s = Math.sin(this._config.pitch * Math.PI / 180);
    const c = Math.cos(this._config.pitch * Math.PI / 180);
    const a = focal * c - y * s;
    const root = Math.sqrt(x * x + a * a);
    const pitch = Math.atan((y * c + focal * s) / root) * 180 / Math.PI;
    let yaw = Math.atan2(x / root, a / root) * 180 / Math.PI + this._config.yaw;
    if (yaw < -180)
      yaw += 360;
    if (yaw > 180)
      yaw -= 360;
    return [pitch, yaw];
  }

  /**
   * Event handler for mouse moves. Pans center of view.
   * @private
   * @param {MouseEvent} event - Document mouse move event.
   */
  private onDocumentMouseMove(event: MouseEvent) {
    if (this._isUserInteracting && this._loaded) {
      this._latestInteraction = Date.now();
      const canvas = this._renderer!.canvas;
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const pos = this.mousePosition(event);
      // TODO: This still isn't quite right
      const yaw = ((Math.atan(this._onPointerDownPointerX / canvasWidth * 2 - 1) - Math.atan(pos.x / canvasWidth * 2 - 1)) * 180 / Math.PI * this._config.hfov / 90) + this._onPointerDownYaw;
      this._speed.yaw = (yaw - this._config.yaw) % 360 * 0.2;
      this._config.yaw = yaw;

      const vfov = 2 * Math.atan(Math.tan(this._config.hfov / 360 * Math.PI) * canvasHeight / canvasWidth) * 180 / Math.PI;

      const pitch = ((Math.atan(pos.y / canvasHeight * 2 - 1) - Math.atan(this._onPointerDownPointerY / canvasHeight * 2 - 1)) * 180 / Math.PI * vfov / 90) + this._onPointerDownPitch;
      this._speed.pitch = (pitch - this._config.pitch) * 0.2;
      this._config.pitch = pitch;
    }
  }

  /**
   * Event handler for mouse up events. Stops panning.
   * @private
   */
  private onDocumentMouseUp(event: Event) {
    if (!this._isUserInteracting) {
      return;
    }
    this._isUserInteracting = false;
    if (Date.now() - this._latestInteraction > 15) {
      // Prevents jump when user rapidly moves mouse, stops, and then
      // releases the mouse button
      this._speed.pitch = this._speed.yaw = 0;
    }
    this._uiContainer.classList.add("pnlm-grab");
    this._uiContainer.classList.remove("pnlm-grabbing");
    this._latestInteraction = Date.now();

    this.fireEvent("mouseup", event);
  }

  /**
   * Event handler for touches. Initializes panning if one touch or zooming if
   * two touches.
   * @private
   * @param {TouchEvent} event - Document touch start event.
   */
  private onDocumentTouchStart(event: TouchEvent) {
    // Only do something if the panorama is loaded
    if (!this._loaded || !this._config.draggable) {
      return;
    }

    // Turn off auto-rotation if enabled
    this.stopAnimation();

    this.stopOrientation();
    this._config.roll = 0;

    this._speed.hfov = 0;

    // Calculate touch position relative to top left of viewer container
    const pos0 = this.mousePosition((event.targetTouches[0] as any) as MouseEvent);

    this._onPointerDownPointerX = pos0.x;
    this._onPointerDownPointerY = pos0.y;

    if (event.targetTouches.length === 2) {
      // Down pointer is the center of the two fingers
      const pos1 = this.mousePosition((event.targetTouches[1] as any) as MouseEvent);
      this._onPointerDownPointerX += (pos1.x - pos0.x) * 0.5;
      this._onPointerDownPointerY += (pos1.y - pos0.y) * 0.5;
      this._onPointerDownPointerDist = Math.sqrt((pos0.x - pos1.x) * (pos0.x - pos1.x) +
        (pos0.y - pos1.y) * (pos0.y - pos1.y));
    }
    this._isUserInteracting = true;
    this._latestInteraction = Date.now();

    this._onPointerDownYaw = this._config.yaw;
    this._onPointerDownPitch = this._config.pitch;

    this.fireEvent("touchstart", event);
    this.animateInit();
  }

  /**
   * Event handler for touch movements. Pans center of view if one touch or
   * adjusts zoom if two touches.
   * @private
   * @param {TouchEvent} event - Document touch move event.
   */
  private onDocumentTouchMove(event: TouchEvent) {
    if (!this._config.draggable) {
      return;
    }

    // Override default action
    event.preventDefault();
    if (this._loaded) {
      this._latestInteraction = Date.now();
    }
    if (this._isUserInteracting && this._loaded) {
      const pos0: any = this.mousePosition((event.targetTouches[0] as any) as MouseEvent);
      let clientX = pos0.x;
      let clientY = pos0.y;

      if (event.targetTouches.length === 2 && this._onPointerDownPointerDist !== -1) {
        const pos1 = this.mousePosition((event.targetTouches[1] as any) as MouseEvent);
        clientX += (pos1.x - pos0.x) * 0.5;
        clientY += (pos1.y - pos0.y) * 0.5;
        const clientDist = Math.sqrt((pos0.x - pos1.x) * (pos0.x - pos1.x) + (pos0.y - pos1.y) * (pos0.y - pos1.y));
        this.setHfovInternal(this._config.hfov + (this._onPointerDownPointerDist - clientDist) * 0.1);
        this._onPointerDownPointerDist = clientDist;
      }

      // The smaller the this._config.hfov value (the more zoomed-in the user is), the faster
      // yaw/pitch are perceived to change on one-finger touchmove (panning) events and vice versa.
      // To improve usability at both small and large zoom levels (this._config.hfov values)
      // we introduce a dynamic pan speed coefficient.
      //
      // Currently this seems to *roughly* keep initial drag/pan start position close to
      // the user's finger while panning regardless of zoom level / this._config.hfov value.
      const touchmovePanSpeedCoeff = (this._config.hfov / 360) * this._config.touchPanSpeedCoeffFactor;

      const yaw = (this._onPointerDownPointerX - clientX) * touchmovePanSpeedCoeff + this._onPointerDownYaw;
      this._speed.yaw = (yaw - this._config.yaw) % 360 * 0.2;
      this._config.yaw = yaw;

      const pitch = (clientY - this._onPointerDownPointerY) * touchmovePanSpeedCoeff + this._onPointerDownPitch;
      this._speed.pitch = (pitch - this._config.pitch) * 0.2;
      this._config.pitch = pitch;
    }
  }

  /**
   * Event handler for end of touches. Stops panning and/or zooming.
   * @private
   */
  private onDocumentTouchEnd(event: Event) {
    this._isUserInteracting = false;
    if (Date.now() - this._latestInteraction > 150) {
      this._speed.pitch = this._speed.yaw = 0;
    }
    this._onPointerDownPointerDist = -1;
    this._latestInteraction = Date.now();

    this.fireEvent("touchend", event);
  }

  /**
   * Event handler for touch starts in IE / Edge.
   * @private
   * @param {PointerEvent} event - Document pointer down event.
   */
  private onDocumentPointerDown(event: PointerEvent) {
    if (event.pointerType === "touch") {
      // Only do something if the panorama is loaded
      if (!this._loaded || !this._config.draggable)
        return;
      this._pointerIDs.push(event.pointerId);
      this._pointerCoordinates.push({ clientX: event.clientX, clientY: event.clientY });
      (event as any).targetTouches = this._pointerCoordinates;
      this.onDocumentTouchStart((event as any) as TouchEvent);
      event.preventDefault();
    }
  }

  /**
   * Event handler for touch moves in IE / Edge.
   * @private
   * @param {PointerEvent} event - Document pointer move event.
   */
  private onDocumentPointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") {
      if (!this._config.draggable)
        return;
      for (let iPoint = 0; iPoint < this._pointerIDs.length; iPoint++) {
        if (event.pointerId === this._pointerIDs[iPoint]) {
          this._pointerCoordinates[iPoint].clientX = event.clientX;
          this._pointerCoordinates[iPoint].clientY = event.clientY;
          (event as any).targetTouches = this._pointerCoordinates;
          this.onDocumentTouchMove((event as any) as TouchEvent);
          event.preventDefault();
          return;
        }
      }
    }
  }

  /**
   * Event handler for touch ends in IE / Edge.
   * @private
   * @param {PointerEvent} event - Document pointer up event.
   */
  private onDocumentPointerUp(event: PointerEvent) {
    if (event.pointerType === "touch") {
      let defined = false;
      for (let iPoint = 0; iPoint < this._pointerIDs.length; iPoint++) {
        if (event.pointerId === this._pointerIDs[iPoint])
          this._pointerIDs[iPoint] = undefined;
        if (this._pointerIDs[iPoint])
          defined = true;
      }
      if (!defined) {
        this._pointerIDs = [];
        this._pointerCoordinates = [];
        this.onDocumentTouchEnd(event);
      }
      event.preventDefault();
    }
  }

  /**
   * Event handler for mouse wheel. Changes zoom.
   * @private
   * @param {WheelEvent} event - Document mouse wheel event.
   */
  private onDocumentMouseWheel(event: WheelEvent) {
    // Only do something if the panorama is loaded and mouse wheel zoom is enabled
    if (!this._loaded || !this._config.mouseZoom) {
      return;
    }

    event.preventDefault();

    // Turn off auto-rotation if enabled
    this.stopAnimation();
    this._latestInteraction = Date.now();

    if (event.deltaY) {
      console.log("wheel event deltay = " + event.deltaY);
      this.setHfovInternal(this._config.hfov + event.deltaY * 0.05);
      this._speed.hfov = event.deltaY < 0 ? -1 : 1;
    }
    this.animateInit();
  }

  /**
   * Event handler for key presses. Updates list of currently pressed keys.
   * @private
   * @param {KeyboardEvent} event - Document key press event.
   */
  private async onDocumentKeyPress(event: KeyboardEvent) {
    // Turn off auto-rotation if enabled
    this.stopAnimation();
    this._latestInteraction = Date.now();

    this.stopOrientation();
    this._config.roll = 0;

    // Record key pressed
    const keyNumber = event.keyCode;

    // Override default action for keys that are used
    if (this._config.capturedKeyNumbers.indexOf(keyNumber) < 0)
      return;
    event.preventDefault();

    // If escape key is pressed
    if (keyNumber === 27) {
      // If in fullscreen mode
      if (this._fullscreenActive) {
        await this.toggleFullscreen();
      } else {
        if (this._config.escapeKeyFunc) {
          this._config.escapeKeyFunc();
        }
      }
    } else {
      // Change key
      this.changeKey(keyNumber, true);
    }
  }

  /**
   * Clears list of currently pressed keys.
   * @private
   */
  private clearKeys() {
    for (let iKey = 0; iKey < 10; iKey++) {
      this._keysDown[iKey] = false;
    }
  }

  /**
   * Event handler for key releases. Updates list of currently pressed keys.
   * @private
   * @param {KeyboardEvent} event - Document key up event.
   */
  private onDocumentKeyUp(event: KeyboardEvent) {
    // Record key pressed
    const keyNumber = event.keyCode;

    // Override default action for keys that are used
    if (this._config.capturedKeyNumbers.indexOf(keyNumber) < 0)
      return;
    event.preventDefault();

    // Change key
    this.changeKey(keyNumber, false);
  }

  /**
   * Updates list of currently pressed keys.
   * @private
   * @param {number} keyNumber - Key number.
   * @param {boolean} value - Whether or not key is pressed.
   */
  private changeKey(keyNumber: number, value: boolean) {
    let keyChanged = false;
    switch (keyNumber) {
      // If minus key is released
      case 109: case 189: case 17: case 173:
        if (this._keysDown[0] !== value) { keyChanged = true; }
        this._keysDown[0] = value; break;

      // If plus key is released
      case 107: case 187: case 16: case 61:
        if (this._keysDown[1] !== value) { keyChanged = true; }
        this._keysDown[1] = value; break;

      // If up arrow is released
      case 38:
        if (this._keysDown[2] !== value) { keyChanged = true; }
        this._keysDown[2] = value; break;

      // If "w" is released
      case 87:
        if (this._keysDown[6] !== value) { keyChanged = true; }
        this._keysDown[6] = value; break;

      // If down arrow is released
      case 40:
        if (this._keysDown[3] !== value) { keyChanged = true; }
        this._keysDown[3] = value; break;

      // If "s" is released
      case 83:
        if (this._keysDown[7] !== value) { keyChanged = true; }
        this._keysDown[7] = value; break;

      // If left arrow is released
      case 37:
        if (this._keysDown[4] !== value) { keyChanged = true; }
        this._keysDown[4] = value; break;

      // If "a" is released
      case 65:
        if (this._keysDown[8] !== value) { keyChanged = true; }
        this._keysDown[8] = value; break;

      // If right arrow is released
      case 39:
        if (this._keysDown[5] !== value) { keyChanged = true; }
        this._keysDown[5] = value; break;

      // If "d" is released
      case 68:
        if (this._keysDown[9] !== value) { keyChanged = true; }
        this._keysDown[9] = value;
    }

    if (keyChanged && value) {
      if (typeof performance !== "undefined" && performance.now()) {
        this._prevTime = performance.now();
      } else {
        this._prevTime = Date.now();
      }
      this.animateInit();
    }
  }

  /**
   * Pans and/or zooms panorama based on currently pressed keys. Also handles
   * panorama "inertia" and auto rotation.
   * @private
   */
  private keyRepeat() {
    // Only do something if the panorama is loaded
    if (!this._loaded) {
      return;
    }

    let isKeyDown = false;

    let prevPitch = this._config.pitch;
    let prevYaw = this._config.yaw;
    let prevZoom = this._config.hfov;

    let newTime;
    if (typeof performance !== "undefined" && performance.now()) {
      newTime = performance.now();
    } else {
      newTime = Date.now();
    }
    if (this._prevTime === undefined) {
      this._prevTime = newTime;
    }
    let diff = (newTime - this._prevTime) * this._config.hfov / 1700;
    diff = Math.min(diff, 1.0);

    // If minus key is down
    if (this._keysDown[0] && this._config.keyboardZoom === true) {
      this.setHfovInternal(this._config.hfov + (this._speed.hfov * 0.8 + 0.5) * diff);
      isKeyDown = true;
    }

    // If plus key is down
    if (this._keysDown[1] && this._config.keyboardZoom === true) {
      this.setHfovInternal(this._config.hfov + (this._speed.hfov * 0.8 - 0.2) * diff);
      isKeyDown = true;
    }

    // If up arrow or "w" is down
    if (this._keysDown[2] || this._keysDown[6]) {
      // Pan up
      this._config.pitch += (this._speed.pitch * 0.8 + 0.2) * diff;
      isKeyDown = true;
    }

    // If down arrow or "s" is down
    if (this._keysDown[3] || this._keysDown[7]) {
      // Pan down
      this._config.pitch += (this._speed.pitch * 0.8 - 0.2) * diff;
      isKeyDown = true;
    }

    // If left arrow or "a" is down
    if (this._keysDown[4] || this._keysDown[8]) {
      // Pan left
      this._config.yaw += (this._speed.yaw * 0.8 - 0.2) * diff;
      isKeyDown = true;
    }

    // If right arrow or "d" is down
    if (this._keysDown[5] || this._keysDown[9]) {
      // Pan right
      this._config.yaw += (this._speed.yaw * 0.8 + 0.2) * diff;
      isKeyDown = true;
    }

    if (isKeyDown)
      this._latestInteraction = Date.now();

    // If auto-rotate
    if (this._config.autoRotate) {
      // Pan
      if (newTime - this._prevTime > 0.001) {
        const timeDiff = (newTime - this._prevTime) / 1000;
        let yawDiff = (this._speed.yaw / timeDiff * diff - this._config.autoRotate * 0.2) * timeDiff;
        yawDiff = (-this._config.autoRotate > 0 ? 1 : -1) * Math.min(Math.abs(this._config.autoRotate * timeDiff), Math.abs(yawDiff));
        this._config.yaw += yawDiff;
      }

      // Deal with stopping auto rotation after a set delay
      if (this._config.autoRotateStopDelay) {
        this._config.autoRotateStopDelay -= newTime - this._prevTime;
        if (this._config.autoRotateStopDelay <= 0) {
          this._config.autoRotateStopDelay = -1;
          this._autoRotateSpeed = this._config.autoRotate;
          this._config.autoRotate = 0;
        }
      }
    }

    // Animated moves
    if (this._animatedMove.pitch) {
      this.animateMove("pitch");
      prevPitch = this._config.pitch;
    }
    if (this._animatedMove.yaw) {
      this.animateMove("yaw");
      prevYaw = this._config.yaw;
    }
    if (this._animatedMove.hfov) {
      this.animateMove("hfov");
      prevZoom = this._config.hfov;
    }

    // "Inertia"
    if (diff > 0 && !this._config.autoRotate) {
      // "Friction"
      const slowDownFactor = 1 - this._config.friction;

      // Yaw
      if (!this._keysDown[4] && !this._keysDown[5] && !this._keysDown[8] && !this._keysDown[9] && !this._animatedMove.yaw) {
        this._config.yaw += this._speed.yaw * diff * slowDownFactor;
      }
      // Pitch
      if (!this._keysDown[2] && !this._keysDown[3] && !this._keysDown[6] && !this._keysDown[7] && !this._animatedMove.pitch) {
        this._config.pitch += this._speed.pitch * diff * slowDownFactor;
      }
      // Zoom
      if (!this._keysDown[0] && !this._keysDown[1] && !this._animatedMove.hfov) {
        this.setHfovInternal(this._config.hfov + this._speed.hfov * diff * slowDownFactor);
      }
    }

    this._prevTime = newTime;
    if (diff > 0) {
      this._speed.yaw = this._speed.yaw * 0.8 + (this._config.yaw - prevYaw) / diff * 0.2;
      this._speed.pitch = this._speed.pitch * 0.8 + (this._config.pitch - prevPitch) / diff * 0.2;
      this._speed.hfov = this._speed.hfov * 0.8 + (this._config.hfov - prevZoom) / diff * 0.2;

      // Limit speed
      const maxSpeed = this._config.autoRotate ? Math.abs(this._config.autoRotate) : 5;
      this._speed.yaw = Math.min(maxSpeed, Math.max(this._speed.yaw, -maxSpeed));
      this._speed.pitch = Math.min(maxSpeed, Math.max(this._speed.pitch, -maxSpeed));
      this._speed.hfov = Math.min(maxSpeed, Math.max(this._speed.hfov, -maxSpeed));
    }

    // Stop movement if opposite controls are pressed
    if (this._keysDown[0] && this._keysDown[1]) {
      this._speed.hfov = 0;
    }
    if ((this._keysDown[2] || this._keysDown[6]) && (this._keysDown[3] || this._keysDown[7])) {
      this._speed.pitch = 0;
    }
    if ((this._keysDown[4] || this._keysDown[8]) && (this._keysDown[5] || this._keysDown[9])) {
      this._speed.yaw = 0;
    }
  }

  /**
   * Animates moves.
   * @param {string} axis - Axis to animate
   * @private
   */
  private animateMove(axis: string) {
    const t = (this._animatedMove as any)[axis];
    const normTime = Math.min(1, Math.max((Date.now() - t.startTime) / 1000 / (t.duration / 1000), 0));
    let result = t.startPosition + this._config.animationTimingFunction(normTime) * (t.endPosition - t.startPosition);
    if ((t.endPosition > t.startPosition && result >= t.endPosition) ||
      (t.endPosition < t.startPosition && result <= t.endPosition) ||
      t.endPosition === t.startPosition) {
      result = t.endPosition;
      (this._speed as any)[axis] = 0;
      delete (this._animatedMove as any)[axis];
    }
    (this._config as any)[axis] = result;
  }

  /**
   * @param {number} t - Normalized time in animation
   * @return {number} Position in animation
   * @private
   */
  private timingFunction(t: number) {
    // easeInOutQuad from https://gist.github.com/gre/1650294
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Event handler for document resizes. Updates viewer size and rerenders view.
   * @private
   */
  private onDocumentResize() {
    // Resize panorama renderer (moved to onFullScreenChange)
    // renderer.resize();
    // animateInit();
  }

  /**
   * Initializes animation.
   * @private
   */
  private animateInit() {
    if (this._animating) {
      return;
    }
    this._animating = true;
    this.animate();
  }

  /**
   * Animates view, using requestAnimationFrame to trigger rendering.
   * @private
   */
  private animate() {
    if (this._destroyed || this._animationStoppedForNewPanorama)
      return;

    this.render();
    if (this._autoRotateStart)
      clearTimeout(this._autoRotateStart);
    if (this._isUserInteracting || this._orientation === true) {
      requestAnimationFrame(this.animate.bind(this));
    } else if (this._keysDown[0] || this._keysDown[1] || this._keysDown[2] || this._keysDown[3] ||
      this._keysDown[4] || this._keysDown[5] || this._keysDown[6] || this._keysDown[7] ||
      this._keysDown[8] || this._keysDown[9] || this._config.autoRotate ||
      this._animatedMove.pitch || this._animatedMove.yaw || this._animatedMove.hfov ||
      Math.abs(this._speed.yaw) > 0.01 || Math.abs(this._speed.pitch) > 0.01 ||
      Math.abs(this._speed.hfov) > 0.01) {

      this.keyRepeat();
      if (this._config.autoRotateInactivityDelay >= 0 && this._autoRotateSpeed &&
        Date.now() - this._latestInteraction > this._config.autoRotateInactivityDelay &&
        !this._config.autoRotate) {
        this._config.autoRotate = this._autoRotateSpeed;
        this.lookAt(this._origPitch, undefined, this._origHfov, 3000);
      }
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.fireEvent("animatefinished", { pitch: this.getPitch(), yaw: this.getYaw(), hfov: this.getHfov() });
      this._animating = false;
      this._prevTime = undefined;
      const autoRotateStartTime = this._config.autoRotateInactivityDelay - (Date.now() - this._latestInteraction);
      if (autoRotateStartTime > 0) {
        this._autoRotateStart = setTimeout(() => {
          this._config.autoRotate = this._autoRotateSpeed;
          this.lookAt(this._origPitch, undefined, this._origHfov, 3000);
          this.animateInit();
        }, autoRotateStartTime);
      } else if (this._config.autoRotateInactivityDelay >= 0 && this._autoRotateSpeed) {
        this._config.autoRotate = this._autoRotateSpeed;
        this.lookAt(this._origPitch, undefined, this._origHfov, 3000);
        this.animateInit();
      }
    }
  }

  /**
   * Renders panorama view.
   * @private
   */
  private render() {
    let tmpYaw;

    if (this._loaded) {
      const canvas = this._renderer!.canvas;

      if (this._config.autoRotate === 0) {
        // When auto-rotating this check needs to happen first (see issue #764)
        if (this._config.yaw > 180) {
          this._config.yaw -= 360;
        } else if (this._config.yaw < -180) {
          this._config.yaw += 360;
        }
      }

      // Keep a tmp value of yaw for autoRotate comparison later
      tmpYaw = this._config.yaw;

      // Optionally avoid showing background (empty space) on left or right by adapting min/max yaw
      let hoffcut = 0;
      if (this._config.avoidShowingBackground) {
        const hfov2 = this._config.hfov / 2;
        const vfov2 = Math.atan2(Math.tan(hfov2 / 180 * Math.PI), (canvas.width / canvas.height)) * 180 / Math.PI;
        const transposed = this._config.vaov > this._config.haov;
        if (transposed) {
          hoffcut = vfov2 * (1 - Math.min(Math.cos((this._config.pitch - hfov2) / 180 * Math.PI),
            Math.cos((this._config.pitch + hfov2) / 180 * Math.PI)));
        } else {
          hoffcut = hfov2 * (1 - Math.min(Math.cos((this._config.pitch - vfov2) / 180 * Math.PI),
            Math.cos((this._config.pitch + vfov2) / 180 * Math.PI)));
        }
      }

      // Ensure the yaw is within min and max allowed
      const yawRange = this._config.maxYaw - this._config.minYaw;
      let minYaw = -180;
      let maxYaw = 180;
      if (yawRange < 360) {
        minYaw = this._config.minYaw + this._config.hfov / 2 + hoffcut;
        maxYaw = this._config.maxYaw - this._config.hfov / 2 - hoffcut;
        if (yawRange < this._config.hfov) {
          // Lock yaw to average of min and max yaw when both can be seen at once
          minYaw = maxYaw = (minYaw + maxYaw) / 2;
        }
        this._config.yaw = Math.max(minYaw, Math.min(maxYaw, this._config.yaw));
      }

      if (this._config.autoRotate === 0) {
        // When not auto-rotating, this check needs to happen after the
        // previous check (see issue #698)
        if (this._config.yaw > 180) {
          this._config.yaw -= 360;
        } else if (this._config.yaw < -180) {
          this._config.yaw += 360;
        }
      }

      // Check if we autoRotate in a limited by min and max yaw
      // If so reverse direction
      if (this._config.autoRotate !== 0 && tmpYaw !== this._config.yaw &&
        this._prevTime !== undefined) { // this condition prevents changing the direction initially
        this._config.autoRotate *= -1;
      }

      // Ensure the calculated pitch is within min and max allowed
      const vfov = 2 * Math.atan(Math.tan(this._config.hfov / 180 * Math.PI * 0.5) / (canvas.width / canvas.height)) / Math.PI * 180;
      let minPitch = this._config.minPitch + vfov / 2;
      let maxPitch = this._config.maxPitch - vfov / 2;
      const pitchRange = this._config.maxPitch - this._config.minPitch;
      if (pitchRange < vfov) {
        // Lock pitch to average of min and max pitch when both can be seen at once
        minPitch = maxPitch = (minPitch + maxPitch) / 2;
      }
      if (isNaN(minPitch))
        minPitch = -90;
      if (isNaN(maxPitch))
        maxPitch = 90;
      this._config.pitch = Math.max(minPitch, Math.min(maxPitch, this._config.pitch));

      this._renderer!.render(this._config.pitch * Math.PI / 180, this._config.yaw * Math.PI / 180, this._config.hfov * Math.PI / 180, { roll: this._config.roll * Math.PI / 180 });

      this.renderHotSpots();

      // Update compass
      if (this._config.compass) {
        this._compass.style.transform = "rotate(" + (-this._config.yaw - this._config.northOffset) + "deg) ";
      }
    }
  }

  /**
   * Converts device orientation API Tait-Bryan angles to a quaternion.
   * @private
   * @param {Number} alpha - Alpha angle (in degrees)
   * @param {Number} beta - Beta angle (in degrees)
   * @param {Number} gamma - Gamma angle (in degrees)
   * @returns {Quaternion} Orientation quaternion
   */
  private taitBryanToQuaternion(alpha: number | null, beta: number | null, gamma: number | null) {
    const r = [beta ? beta * Math.PI / 180 / 2 : 0, gamma ? gamma * Math.PI / 180 / 2 : 0, alpha ? alpha * Math.PI / 180 / 2 : 0];
    const c = [Math.cos(r[0]), Math.cos(r[1]), Math.cos(r[2])];
    const s = [Math.sin(r[0]), Math.sin(r[1]), Math.sin(r[2])];

    return new Quaternion(c[0] * c[1] * c[2] - s[0] * s[1] * s[2],
      s[0] * c[1] * c[2] - c[0] * s[1] * s[2],
      c[0] * s[1] * c[2] + s[0] * c[1] * s[2],
      c[0] * c[1] * s[2] + s[0] * s[1] * c[2]);
  }

  /**
   * Computes current device orientation quaternion from device orientation API
   * Tait-Bryan angles.
   * @private
   * @param {Number} alpha - Alpha angle (in degrees)
   * @param {Number} beta - Beta angle (in degrees)
   * @param {Number} gamma - Gamma angle (in degrees)
   * @returns {Quaternion} Orientation quaternion
   */
  private computeQuaternion(alpha: number | null, beta: number | null, gamma: number | null) {
    // Convert Tait-Bryan angles to quaternion
    let quaternion = this.taitBryanToQuaternion(alpha, beta, gamma);
    // Apply world transform
    quaternion = quaternion.multiply(new Quaternion(Math.sqrt(0.5), -Math.sqrt(0.5), 0, 0));
    // Apply screen transform
    const angle = window.orientation ? -window.orientation * Math.PI / 180 / 2 : 0;
    return quaternion.multiply(new Quaternion(Math.cos(angle), 0, -Math.sin(angle), 0));
  }

  /**
   * Event handler for device orientation API. Controls pointing.
   * @private
   * @param {DeviceOrientationEvent} event - Device orientation event.
   */
  private orientationListener(e: DeviceOrientationEvent) {
    if (e.hasOwnProperty("requestPermission"))
      (e as any).requestPermission();
    const q = this.computeQuaternion(e.alpha, e.beta, e.gamma).toEulerAngles();
    if (typeof (this._orientation) === "number" && this._orientation < 10) {
      // This kludge is necessary because iOS sometimes provides a few stale
      // device orientation events when the listener is removed and then
      // re-added. Thus, we skip the first 10 events to prevent this from
      // causing problems.
      this._orientation += 1;
    } else if (this._orientation === 10) {
      // Record starting yaw to prevent jumping
      this._orientationYawOffset = q[2] / Math.PI * 180 + this._config.yaw;
      this._orientation = true;
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this._config.pitch = q[0] / Math.PI * 180;
      this._config.roll = -q[1] / Math.PI * 180;
      this._config.yaw = -q[2] / Math.PI * 180 + this._orientationYawOffset;
    }
  }

  /**
   * Initializes renderer.
   * @private
   */
  private renderInit() {
    try {
      const params: any = {};
      if (this._config.horizonPitch !== undefined)
        params.horizonPitch = this._config.horizonPitch * Math.PI / 180;
      if (this._config.horizonRoll !== undefined)
        params.horizonRoll = this._config.horizonRoll * Math.PI / 180;
      if (this._config.backgroundColor !== undefined)
        params.backgroundColor = this._config.backgroundColor;
      this._renderer!.init(this._panoImage!, this._config.dynamic, this._config.haov * Math.PI / 180, this._config.vaov * Math.PI / 180, this._config.vOffset * Math.PI / 180, this.renderInitCallback.bind(this), params);
      if (!this._config.dynamic) {
        // Allow image to be garbage collected
        this._panoImage = undefined;
      }
    } catch (event) {
      // Panorama not loaded

      // Display error if there is a bad texture
      if (event.type === "webgl error" || event.type === "no webgl") {
        this.anError();
      } else if (event.type === "webgl size error") {
        this.anError(this._i18n.translate("geoPhoto:pannellum:textureSizeError", { panWidth: event.width, maxWidth: event.maxWidth }));
      } else {
        this.anError(this._i18n.translate("geoPhoto:pannellum.unknownError"));
        throw event;
      }
    }
  }

  /**
   * Triggered when render initialization finishes. Handles fading between
   * scenes as well as showing the compass and hotspots and hiding the loading
   * display.
   * @private
   */
  private renderInitCallback() {
    // Fade if specified
    if (this._config.sceneFadeDuration && this._renderer!.fadeImg !== undefined) {
      this._renderer!.fadeImg.style.opacity = "0";
      // Remove image
      const fadeImg = this._renderer!.fadeImg;
      delete this._renderer!.fadeImg;
      setTimeout(() => {
        this._renderContainer.removeChild(fadeImg);
        this.fireEvent("scenechangefadedone");
      }, this._config.sceneFadeDuration);
    }

    // Show compass if applicable
    if (this._config.compass) {
      this._compass.style.display = "inline";
    } else {
      this._compass.style.display = "none";
    }

    // Show hotspots
    this.createHotSpots();

    // Hide loading display
    /* --------- load not used -----------
    this._infoDisplay.load.box.style.display = "none";
    -------------------------------------- */
    if (this._preview !== undefined) {
      this._renderContainer.removeChild(this._preview);
      this._preview = undefined;
    }
    this._loaded = true;

    this.animateInit();

    this.fireEvent("load");
  }

  /**
   * Creates hot spot element for the current scene.
   * @private
   * @param {Object} hs - The configuration for the hotSpot
   */
  private createHotSpot(hs: PannellumHotSpot) {
    const div = document.createElement("div");
    div.className = "pnlm-hotspot-base";
    if (hs.cssClassName)
      div.className += " " + hs.cssClassName;
    else
      div.className += " pnlm-hotspot pnlm-sprite pnlm-info";

    const span = document.createElement("span");
    if (hs.text)
      span.innerHTML = this.escapeHTML(hs.text);

    if (hs.video) {
      const video = document.createElement("video");
      video.src = this.sanitizeURL(hs.video);
      video.controls = true;
      if (hs.width)
        video.style.width = hs.width + "px";
      this._renderContainer.appendChild(div);
      span.appendChild(video);
    } else if (hs.image) {
      const link = document.createElement("a");
      link.href = this.sanitizeURL(hs.URL ? hs.URL : hs.image);
      link.target = "_blank";
      span.appendChild(link);
      const image = document.createElement("img");
      image.src = this.sanitizeURL(hs.image);
      if (hs.width)
        image.style.width = hs.width + "px";
      image.style.paddingTop = "5px";
      this._renderContainer.appendChild(div);
      link.appendChild(image);
      span.style.maxWidth = "initial";
    } else if (hs.URL) {
      const link = document.createElement("a");
      link.href = this.sanitizeURL(hs.URL);
      if (hs.attributes) {
        for (const key in hs.attributes) {
          if (hs.hasOwnProperty(key))
            link.setAttribute(key, hs.attributes[key]);
        }
      } else {
        link.target = "_blank";
      }
      this._renderContainer.appendChild(link);
      div.className += " pnlm-pointer";
      span.className += " pnlm-pointer";
      link.appendChild(div);
    } else {
      this._renderContainer.appendChild(div);
    }

    if (hs.createTooltipFunc) {
      hs.createTooltipFunc(div, hs.createTooltipArgs);
    } else if (hs.text || hs.video || hs.image) {
      div.classList.add("pnlm-tooltip");
      div.appendChild(span);
      span.style.width = span.scrollWidth - 20 + "px";
      span.style.marginLeft = -(span.scrollWidth - div.offsetWidth) / 2 + "px";
      span.style.marginTop = -span.scrollHeight - 12 + "px";
    }
    if (hs.clickHandlerFunc) {
      div.addEventListener("click", ((e) => { hs.clickHandlerFunc!(e, [this, ...hs.clickHandlerArgs]); }), false);
      div.className += " pnlm-pointer";
      span.className += " pnlm-pointer";
    }
    hs.div = div;
  }

  /**
   * Creates hot spot elements for the current scene.
   * @private
   */
  private createHotSpots() {
    if (this._hotSpotsCreated)
      return;

    if (!this._config.hotSpots) {
      this._config.hotSpots = [];
    } else {
      // Sort by pitch so tooltip is never obscured by another hot spot
      this._config.hotSpots = this._config.hotSpots.sort((a: PannellumHotSpot, b: PannellumHotSpot) => a.pitch - b.pitch);
      this._config.hotSpots.forEach(this.createHotSpot.bind(this));
    }
    this._hotSpotsCreated = true;
  }

  /**
   * Destroys currently created hot spot elements.
   * @private
   */
  private destroyHotSpots() {
    const hotSpots = this._config.hotSpots;
    this._hotSpotsCreated = false;
    delete this._config.hotSpots;
    if (hotSpots) {
      for (const hs of hotSpots) {
        let current: Node | undefined | null = hs.div;
        if (current) {
          while ((undefined !== current!.parentNode) && current!.parentNode !== this._renderContainer) {
            current = current!.parentNode;
          }
          this._renderContainer.removeChild(current!);
        }
        delete hs.div;
      }
    }
  }

  /**
   * Renders hot spot, updating its position and visibility.
   * @private
   */
  private renderHotSpot(hs: PannellumHotSpot) {
    const hsPitchSin = Math.sin(hs.pitch * Math.PI / 180);
    const hsPitchCos = Math.cos(hs.pitch * Math.PI / 180);
    const config = this._config;
    const configPitchSin = Math.sin(config.pitch * Math.PI / 180);
    const configPitchCos = Math.cos(config.pitch * Math.PI / 180);
    const yawCos = Math.cos((-hs.yaw + config.yaw) * Math.PI / 180);
    const z = hsPitchSin * configPitchSin + hsPitchCos * yawCos * configPitchCos;
    if (!hs.div) {
      // tslint:disable-next-line:no-debugger
      debugger;
    }
    if ((hs.yaw <= 90 && hs.yaw > -90 && z <= 0) || ((hs.yaw > 90 || hs.yaw <= -90) && z <= 0)) {
      hs.div!.style.visibility = "hidden";
    } else {
      const yawSin = Math.sin((-hs.yaw + config.yaw) * Math.PI / 180);
      const hfovTan = Math.tan(config.hfov * Math.PI / 360);
      hs.div!.style.visibility = "visible";
      // Subpixel rendering doesn't work in Firefox
      // https://bugzilla.mozilla.org/show_bug.cgi?id=739176
      const canvas = this._renderer!.canvas;
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      let coord = [-canvasWidth / hfovTan * yawSin * hsPitchCos / z / 2, -canvasWidth / hfovTan * (hsPitchSin * configPitchCos - hsPitchCos * yawCos * configPitchSin) / z / 2];
      // Apply roll
      const rollSin = Math.sin(this._config.roll * Math.PI / 180);
      const rollCos = Math.cos(this._config.roll * Math.PI / 180);
      coord = [coord[0] * rollCos - coord[1] * rollSin, coord[0] * rollSin + coord[1] * rollCos];
      // Apply transform
      coord[0] += (canvasWidth - hs.div!.offsetWidth) / 2;
      coord[1] += (canvasHeight - hs.div!.offsetHeight) / 2;
      let transform = "translate(" + coord[0] + "px, " + coord[1] + "px) translateZ(9999px) rotate(" + config.roll + "deg)";
      if (hs.scale) {
        transform += " scale(" + (this._origHfov / this._config.hfov) / z + ")";
      }
      hs.div!.style.webkitTransform = transform;
      hs.div!.style.transform = transform;
      // allow callback to affect style.
      if (hs.styleFunc)
        hs.styleFunc(hs, hs.styleArgs);
    }
  }

  /**
   * Renders hot spots, updating their positions and visibility.
   * @private
   */
  private renderHotSpots() {
    if (this._config.hotSpots) {
      for (const hs of this._config.hotSpots) {
        this.renderHotSpot(hs);
      }
    }
  }

  /**
   * Merges a scene configuration into the current configuration.
   * @private
   */
  private mergeConfig(newConfig?: PannellumViewerConfig) {
    this._config = Object.assign(this._defaultConfig);
    const photoSphereExcludes = ["haov", "vaov", "vOffset", "northOffset", "horizonPitch", "horizonRoll"];
    this._specifiedPhotoSphereExcludes = [];

    if (!newConfig)
      newConfig = this._initialConfig;

    // Merge initial this._config
    if (newConfig) {
      for (const k in this._initialConfig) {
        if (this._initialConfig.hasOwnProperty(k)) {
          (this._config as any)[k] = (this._initialConfig as any)[k];
          if (photoSphereExcludes.indexOf(k) >= 0) {
            this._specifiedPhotoSphereExcludes.push(k);
          }
        }
      }
    }
  }

  private processDisplayedOptions() {
    // Reset title / author display
    if (undefined === this._config.title)
      this._infoDisplay.title.innerHTML = "";
    else {
      this._infoDisplay.title.innerHTML = this.escapeHTML(this._config.title);
      this._infoDisplay.container.style.display = "inline";
    }

    if (undefined === this._config.author)
      this._infoDisplay.author.innerHTML = "";
    else {
      let authorText = this.escapeHTML(this._config.author);
      if (this._config.authorURL) {
        const authorLink = document.createElement("a");
        authorLink.href = this.sanitizeURL(this._config.authorURL);
        authorLink.target = "_blank";
        authorLink.innerHTML = authorText;
        authorText = authorLink.outerHTML;
      }
      this._infoDisplay.author.innerHTML = this._i18n.translate("geoPhoto:pannellum.bylineLabel", { author: authorText });
      this._infoDisplay.container.style.display = "inline";
    }

    if ((undefined === this._config.title) && (undefined === this._config.author))
      this._infoDisplay.container.style.display = "none";
  }

  /**
   * Processes configuration options.
   * @param {boolean} [isPreview] - Whether or not the preview is being displayed
   * @private
   */
  private processOptions() {
    this.processDisplayedOptions();

    /* ------------ We always autoload ------------------
    // Fill in load button label and loading box text
    this._controls.load.innerHTML = "<p>" + this._i18n.translate("geoPhoto:pannellum.loadButtonLabel") + "</p>";
    this._infoDisplay.load.boxp.innerHTML = this._i18n.translate("geoPhoto:pannellum.loadingLabel");
    ----------------------------------------------------- */

    if (this._config.showZoomCtrl) {
      this._controls.zoom.style.display = "block";
    } else {
      // Hide zoom controls
      this._controls.zoom.style.display = "none";
    }

    if (this._config.showFullscreenCtrl && ("fullscreen" in document)) {
      // Show fullscreen control
      this._controls.fullscreen.style.display = "block";
    } else {
      // Hide fullscreen control
      this._controls.fullscreen.style.display = "none";
    }

    if (this._config.hotSpotDebug)
      this._hotSpotDebugIndicator.style.display = "block";
    else
      this._hotSpotDebugIndicator.style.display = "none";

    if (!this._config.showControls) {
      this._controls.orientation.style.display = "none";
      this._controls.zoom.style.display = "none";
      this._controls.fullscreen.style.display = "none";
    }

    if (this._config.orientationOnByDefault) {
      if (this._orientationSupport === undefined)
        this._startOrientationIfSupported = true;
      else if (this._orientationSupport === true)
        this.startOrientation();
    }
  }

  /**
   * Toggles fullscreen mode.
   * @private
   */
  private async toggleFullscreen() {
    if (this._loaded && !this._error) {
      if (!this._fullscreenActive) {
        try {
          if (this._container.requestFullscreen) {
            await this._container.requestFullscreen();
          }
        } catch (event) {
          // Fullscreen doesn't work
        }
      } else {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          }
        } catch (event) {
          // do nothing.
        }
      }
    }
  }

  /**
   * Event handler for fullscreen changes.
   * @private
   */
  private onFullScreenChange(_event: any) {
    if (document.fullscreenElement) {
      this._controls.fullscreen.classList.add("pnlm-fullscreen-toggle-button-active");
      this._fullscreenActive = true;
    } else {
      this._controls.fullscreen.classList.remove("pnlm-fullscreen-toggle-button-active");
      this._fullscreenActive = false;
    }
    // Resize renderer (deal with browser quirks and fixes #155)
    this._renderer!.resize();
    this.setHfovInternal(this._config.hfov);
    this.animateInit();
  }

  /**
   * Increases panorama zoom. For use with zoom button.
   * @private
   */
  private zoomIn() {
    if (this._loaded) {
      this.setHfovInternal(this._config.hfov - 5);
      this.animateInit();
    }
  }

  /**
   * Decreases panorama zoom. For use with zoom button.
   * @private
   */
  private zoomOut() {
    if (this._loaded) {
      this.setHfovInternal(this._config.hfov + 5);
      this.animateInit();
    }
  }

  /**
   * Clamps horizontal field of view to viewer's limits.
   * @private
   * @param {number} hfov - Input horizontal field of view (in degrees)
   * @return {number} - Clamped horizontal field of view (in degrees)
   */
  private constrainHfov(hfov: number) {
    // Keep field of view within bounds
    const minHfov = this._config.minHfov;
    if (minHfov > this._config.maxHfov) {
      // Don't change view if bounds don't make sense
      console.log("HFOV bounds do not make sense (minHfov > maxHfov).");
      return this._config.hfov;
    }
    let newHfov = this._config.hfov;
    if (hfov < minHfov) {
      newHfov = minHfov;
    } else if (hfov > this._config.maxHfov) {
      newHfov = this._config.maxHfov;
    } else {
      newHfov = hfov;
    }
    // Optionally avoid showing background (empty space) on top or bottom by adapting newHfov
    if (this._config.avoidShowingBackground && this._renderer) {
      const canvas = this._renderer!.canvas;
      newHfov = Math.min(newHfov, Math.atan(Math.tan((this._config.maxPitch - this._config.minPitch) / 360 * Math.PI) /
        canvas.height * canvas.width) * 360 / Math.PI);
    }
    return newHfov;
  }

  /**
   * Sets viewer's horizontal field of view.
   * @private
   * @param {number} hfov - Desired horizontal field of view in degrees.
   */
  private setHfovInternal(hfov: number) {
    this._config.hfov = this.constrainHfov(hfov);
    this.fireEvent("zoomchange", this._config.hfov);
  }

  private noMove(): Move {
    return { pitch: undefined, yaw: undefined, hfov: undefined };
  }

  /**
   * Stops auto rotation and animated moves.
   * @private
   */
  private stopAnimation() {
    this._animatedMove = this.noMove();
    this._autoRotateSpeed = this._config.autoRotate ? this._config.autoRotate : this._autoRotateSpeed;
    this._config.autoRotate = 0;
  }

  /**
   * Loads panorama.
   * @private
   */
  private load(newPanoBlob: Blob) {
    // Since WebGL error handling is very general, first we clear any error box
    // since it is a new scene and the error from previous maybe because of lacking
    // memory etc and not because of a lack of WebGL support etc
    this.clearError();
    this._loaded = false;

    /* ------------- Load control not used
    this._controls.load.style.display = "none";
    this._infoDisplay.load.box.style.display = "inline";
    -------------------------------------- */
    this.initialView(newPanoBlob);
  }

  /**
   * Loads scene.
   * @param {string} sceneId - Identifier of scene configuration to merge in.
   * @param {number} targetPitch - Pitch viewer should be centered on once scene loads.
   * @param {number} targetYaw - Yaw viewer should be centered on once scene loads.
   * @param {number} targetYaw - Yaw viewer should be centered on once scene loads.
   * @param {number} targetHfov - HFOV viewer should use once scene loads.
   * @param {boolean} [fadeDone] - If `true`, fade setup is skipped.
   */
  private loadSceneInternal(newPanoBlob: Blob, newConfig: PannellumViewerConfig | undefined, targetPitch: string | number, targetYaw: string | number, targetHfov: string | number, fadeDone: boolean) {
    if (!this._loaded)
      fadeDone = true;    // Don't try to fade when there isn't a scene loaded
    this._loaded = false;
    this._animatedMove = this.noMove();

    // Set up fade if specified
    let fadeImg: HTMLImageElement;
    if (this._config.sceneFadeDuration && !fadeDone) {
      const data = this._renderer!.render(this._config.pitch * Math.PI / 180, this._config.yaw * Math.PI / 180, this._config.hfov * Math.PI / 180, { returnImage: true });
      if (data !== undefined) {
        fadeImg = new Image();
        fadeImg.className = "pnlm-fade-img";
        fadeImg.style.transition = "opacity " + (this._config.sceneFadeDuration / 1000) + "s";
        fadeImg.style.width = "100%";
        fadeImg.style.height = "100%";
        fadeImg.onload = () => {
          this.loadSceneInternal(newPanoBlob, newConfig, targetPitch, targetYaw, targetHfov, true);
        };
        fadeImg.src = data;
        this._renderContainer.appendChild(fadeImg);
        this._renderer!.fadeImg = fadeImg;
        return;
      }
    }

    // Set new pointing
    let workingPitch: number | undefined;
    if (targetPitch === "same") {
      workingPitch = this._config.pitch;
    } else if (typeof targetPitch === "number") {
      workingPitch = targetPitch;
    }

    let workingYaw: number | undefined;
    if (targetYaw === "same") {
      workingYaw = this._config.yaw;
    } else if (targetYaw === "sameAzimuth") {
      workingYaw = this._config.yaw + this._config.northOffset;
    } else if (typeof targetYaw === "number") {
      workingYaw = targetYaw;
    }

    let workingHfov: number | undefined;
    if (targetHfov === "same") {
      workingHfov = this._config.hfov;
    } else if (typeof targetHfov === "number") {
      workingHfov = targetHfov;
    }

    // Destroy hot spots from previous scene
    this.destroyHotSpots();

    // Create the new this._config for the scene
    this.mergeConfig(newConfig);

    // Stop motion
    this._speed.yaw = this._speed.pitch = this._speed.hfov = 0;

    // Reload scene
    this.processOptions();
    if (workingPitch !== undefined) {
      this._config.pitch = workingPitch;
    }
    if (workingYaw !== undefined) {
      this._config.yaw = workingYaw;
    }
    if (workingHfov !== undefined) {
      this._config.hfov = workingHfov;
    }
    this.fireEvent("scenechange");
    this.load(newPanoBlob);
  }

  /**
   * Stop using device orientation.
   * @private
   */
  private stopOrientation() {
    window.removeEventListener("deviceorientation", this.orientationListener);
    this._controls.orientation.classList.remove("pnlm-orientation-button-active");
    this._orientation = false;
  }

  /**
   * Start using device orientation.
   * @private
   */
  private startOrientation() {
    this._orientation = 1;
    window.addEventListener("deviceorientation", this.orientationListener.bind(this));
    this._controls.orientation.classList.add("pnlm-orientation-button-active");
  }

  /**
   * Escapes HTML string (to mitigate possible DOM XSS attacks).
   * @private
   * @param {string} s - String to escape
   * @returns {string} Escaped string
   */
  private escapeHTML(s: string) {
    return String(s).split(/&/g).join("&amp;")
      .split('"').join(" & quot; ")
      .split("'").join("&#39;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split("/").join("&#x2f;")
      .split("\n").join("<br>");  // Allow line breaks
  }

  /**
   * Removes possibility of XSS attacks with URLs.
   * The URL cannot be of protocol "javascript".
   * @private
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  private sanitizeURL(url: string) {
    if (url.trim().toLowerCase().indexOf("javascript:") === 0) {
      return "about:blank";
    }
    return url;
  }

  /**
   * Checks whether or not a panorama is loaded.
   * @memberof Viewer
   * @instance
   * @returns {boolean} `true` if a panorama is loaded, else `false`
   */
  public get isLoaded(): boolean {
    return Boolean(this._loaded);
  }

  /**
   * Returns the pitch of the center of the view.
   * @memberof Viewer
   * @instance
   * @returns {number} Pitch in degrees
   */
  public getPitch() {
    return this._config.pitch;
  }

  /**
   * Sets the pitch of the center of the view.
   * @memberof Viewer
   * @instance
   * @param {number} pitch - Pitch in degrees
   * @param {boolean|number} [animated=1000] - Animation duration in milliseconds or false for no animation
   * @param {function} [callback] - Function to call when animation finishes
   * @param {object} [callbackArgs] - Arguments to pass to callback function
   * @returns {Viewer} `this`
   */
  public setPitch(pitch: number, animated: number | undefined, callback?: (args: any[] | undefined) => void, callbackArgs?: any[]) {
    this._latestInteraction = Date.now();
    if (Math.abs(pitch - this._config.pitch) <= this._eps) {
      if (typeof callback === "function")
        callback(callbackArgs);
      return this;
    }
    animated = animated === undefined ? 1000 : Number(animated);
    if (animated) {
      this._animatedMove.pitch = {
        startTime: Date.now(),
        startPosition: this._config.pitch,
        endPosition: pitch,
        duration: animated,
      };
      if (typeof callback === "function")
        setTimeout(() => { callback(callbackArgs); }, animated);
    } else {
      this._config.pitch = pitch;
    }
    this.animateInit();
    return this;
  }

  /**
   * Returns the minimum and maximum allowed pitches (in degrees).
   * @memberof Viewer
   * @instance
   * @returns {number[]} [minimum pitch, maximum pitch]
   */
  public getPitchBounds() {
    return [this._config.minPitch, this._config.maxPitch];
  }

  /**
   * Set the minimum and maximum allowed pitches (in degrees).
   * @memberof Viewer
   * @instance
   * @param {number[]} bounds - [minimum pitch, maximum pitch]
   * @returns {Viewer} `this`
   */
  public setPitchBounds(bounds: number[]) {
    this._config.minPitch = Math.max(-90, Math.min(bounds[0], 90));
    this._config.maxPitch = Math.max(-90, Math.min(bounds[1], 90));
    return this;
  }

  /**
   * Returns the yaw of the center of the view.
   * @memberof Viewer
   * @instance
   * @returns {number} Yaw in degrees
   */
  public getYaw() {
    return this._config.yaw;
  }

  /**
   * Sets the yaw of the center of the view.
   * @memberof Viewer
   * @instance
   * @param {number} yaw - Yaw in degrees [-180, 180]
   * @param {boolean|number} [animated=1000] - Animation duration in milliseconds or false for no animation
   * @param {function} [callback] - Function to call when animation finishes
   * @param {object} [callbackArgs] - Arguments to pass to callback function
   * @returns {Viewer} `this`
   */
  public setYaw(yaw: number, animated: number, callback: (args: any[]) => void, callbackArgs: any[]) {
    this._latestInteraction = Date.now();
    if (Math.abs(yaw - this._config.yaw) <= this._eps) {
      if (typeof callback === "function")
        callback(callbackArgs);
      return this;
    }
    animated = animated === undefined ? 1000 : Number(animated);
    yaw = ((yaw + 180) % 360) - 180; // Keep in bounds
    if (animated) {
      // Animate in shortest direction
      if (this._config.yaw - yaw > 180)
        yaw += 360;
      else if (yaw - this._config.yaw > 180)
        yaw -= 360;

      this._animatedMove.yaw = {
        startTime: Date.now(),
        startPosition: this._config.yaw,
        endPosition: yaw,
        duration: animated,
      };
      if (typeof callback === "function")
        setTimeout(() => { callback(callbackArgs); }, animated);
    } else {
      this._config.yaw = yaw;
    }
    this.animateInit();
    return this;
  }

  /**
   * Returns the minimum and maximum allowed pitches (in degrees).
   * @memberof Viewer
   * @instance
   * @returns {number[]} [yaw pitch, maximum yaw]
   */
  public getYawBounds() {
    return [this._config.minYaw, this._config.maxYaw];
  }

  /**
   * Set the minimum and maximum allowed yaws (in degrees [-180, 180]).
   * @memberof Viewer
   * @instance
   * @param {number[]} bounds - [minimum yaw, maximum yaw]
   * @returns {Viewer} `this`
   */
  public setYawBounds(bounds: number[]): PannellumViewer {
    this._config.minYaw = Math.max(-180, Math.min(bounds[0], 180));
    this._config.maxYaw = Math.max(-180, Math.min(bounds[1], 180));
    return this;
  }

  /**
   * Returns the horizontal field of view.
   * @memberof Viewer
   * @instance
   * @returns {number} Horizontal field of view in degrees
   */
  public getHfov() {
    return this._config.hfov;
  }

  /**
   * Sets the horizontal field of view.
   * @memberof Viewer
   * @instance
   * @param {number} hfov - Horizontal field of view in degrees
   * @param {boolean|number} [animated=1000] - Animation duration in milliseconds or false for no animation
   * @param {function} [callback] - Function to call when animation finishes
   * @param {object} [callbackArgs] - Arguments to pass to callback function
   * @returns {Viewer} `this`
   */
  public setHfov(hfov: number, animated: number | undefined, callback?: any, callbackArgs?: any) {
    this._latestInteraction = Date.now();
    if (Math.abs(hfov - this._config.hfov) <= this._eps) {
      if (typeof callback === "function")
        callback(callbackArgs);
      return this;
    }
    animated = animated === undefined ? 1000 : Number(animated);
    if (animated) {
      this._animatedMove.hfov = {
        startTime: Date.now(),
        startPosition: this._config.hfov,
        endPosition: this.constrainHfov(hfov),
        duration: animated,
      };
      if (typeof callback === "function")
        setTimeout(() => { callback(callbackArgs); }, animated);
    } else {
      this.setHfovInternal(hfov);
    }
    this.animateInit();
    return this;
  }

  /**
   * Returns the minimum and maximum allowed horizontal fields of view
   * (in degrees).
   * @memberof Viewer
   * @instance
   * @returns {number[]} [minimum hfov, maximum hfov]
   */
  public getHfovBounds() {
    return [this._config.minHfov, this._config.maxHfov];
  }

  /**
   * Set the minimum and maximum allowed horizontal fields of view (in degrees).
   * @memberof Viewer
   * @instance
   * @param {number[]} bounds - [minimum hfov, maximum hfov]
   * @returns {Viewer} `this`
   */
  public setHfovBounds(bounds: number[]) {
    this._config.minHfov = Math.max(0, bounds[0]);
    this._config.maxHfov = Math.max(0, bounds[1]);
    return this;
  }

  /**
   * Set a new view. Any parameters not specified remain the same.
   * @memberof Viewer
   * @instance
   * @param {number} [pitch] - Target pitch
   * @param {number} [yaw] - Target yaw
   * @param {number} [hfov] - Target hfov
   * @param {boolean|number} [animated=1000] - Animation duration in milliseconds or false for no animation
   * @param {function} [callback] - Function to call when animation finishes
   * @param {object} [callbackArgs] - Arguments to pass to callback function
   * @returns {Viewer} `this`
   */
  private lookAt(pitch: number | undefined, yaw: number | undefined, hfov: number | undefined, animated: number | undefined, callback?: any, callbackArgs?: any) {
    animated = animated === undefined ? 1000 : Number(animated);
    if (pitch !== undefined && Math.abs(pitch - this._config.pitch) > this._eps) {
      this.setPitch(pitch, animated, callback, callbackArgs);
      callback = undefined;
    }
    if (yaw !== undefined && Math.abs(yaw - this._config.yaw) > this._eps) {
      this.setYaw(yaw, animated, callback, callbackArgs);
      callback = undefined;
    }
    if (hfov !== undefined && Math.abs(hfov - this._config.hfov) > this._eps) {
      this.setHfov(hfov, animated, callback, callbackArgs);
      callback = undefined;
    }
    if (typeof callback === "function")
      callback(callbackArgs);
    return this;
  }

  /**
   * Returns the panorama's north offset.
   * @memberof Viewer
   * @instance
   * @returns {number} North offset in degrees
   */
  public getNorthOffset() {
    return this._config.northOffset;
  }

  /**
   * Sets the panorama's north offset.
   * @memberof Viewer
   * @instance
   * @param {number} heading - North offset in degrees
   * @returns {Viewer} `this`
   */
  public setNorthOffset(heading: number) {
    this._config.northOffset = Math.min(360, Math.max(0, heading));
    this.animateInit();
    return this;
  }

  /**
   * Returns the panorama's horizon roll.
   * @memberof Viewer
   * @instance
   * @returns {number} Horizon roll in degrees
   */
  public getHorizonRoll() {
    return this._config.horizonRoll;
  }

  /**
   * Sets the panorama's horizon roll.
   * @memberof Viewer
   * @instance
   * @param {number} roll - Horizon roll in degrees [-90, 90]
   * @returns {Viewer} `this`
   */
  public setHorizonRoll(roll: number) {
    this._config.horizonRoll = Math.min(90, Math.max(-90, roll));
    this._renderer!.setPose(this._config.horizonPitch * Math.PI / 180, this._config.horizonRoll * Math.PI / 180);
    this.animateInit();
    return this;
  }

  /**
   * Returns the panorama's horizon pitch.
   * @memberof Viewer
   * @instance
   * @returns {number} Horizon pitch in degrees
   */
  public getHorizonPitch() {
    return this._config.horizonPitch;
  }

  /**
   * Sets the panorama's horizon pitch.
   * @memberof Viewer
   * @instance
   * @param {number} pitch - Horizon pitch in degrees [-90, 90]
   * @returns {Viewer} `this`
   */
  public setHorizonPitch(pitch: number) {
    this._config.horizonPitch = Math.min(90, Math.max(-90, pitch));
    this._renderer!.setPose(this._config.horizonPitch * Math.PI / 180, this._config.horizonRoll * Math.PI / 180);
    this.animateInit();
    return this;
  }

  /**
   * Start auto rotation.
   *
   * Before starting rotation, the viewer is panned to `pitch`.
   * @memberof Viewer
   * @instance
   * @param {number} [speed] - Auto rotation speed / direction. If not specified, previous value is used.
   * @param {number} [pitch] - The pitch to rotate at. If not specified, initial pitch is used.
   * @returns {Viewer} `this`
   */
  public startAutoRotate(speed?: number, pitch?: number) {
    speed = speed || this._autoRotateSpeed || 1;
    pitch = pitch === undefined ? this._origPitch : pitch;
    this._config.autoRotate = speed;
    this.lookAt(pitch, undefined, this._origHfov, 3000);
    this.animateInit();
    return this;
  }

  /**
   * Stop auto rotation.
   * @memberof Viewer
   * @instance
   * @returns {Viewer} `this`
   */
  public stopAutoRotate(): PannellumViewer {
    this._autoRotateSpeed = this._config.autoRotate ? this._config.autoRotate : this._autoRotateSpeed;
    this._config.autoRotate = 0;
    this._config.autoRotateInactivityDelay = -1;
    return this;
  }

  /**
   * Stops all movement.
   * @memberof Viewer
   * @instance
   */
  public stopMovement(): void {
    this.stopAnimation();
    this._speed = { yaw: 0, pitch: 0, hfov: 0 };
  }

  /**
   * Returns the panorama renderer.
   * @memberof Viewer
   * @instance
   * @returns {Renderer}
   */
  public getRenderer(): PannellumRenderer {
    return this._renderer!;
  }

  /**
   * Get configuration of current scene.
   * @memberof Viewer
   * @instance
   * @returns {Object} Configuration of current scene
   */
  public getConfig() {
    return this._config;
  }

  /**
   * Get viewer's container element.
   * @memberof Viewer
   * @instance
   * @returns {HTMLElement} Container `div` element
   */
  public getContainer() {
    return this._container;
  }

  /**
   * This method should be called if the viewer's container is resized.
   * @memberof Viewer
   * @instance
   */
  public resize() {
    if (this._renderer)
      this.onDocumentResize();
  }

  /**
   * Check if device orientation control is supported.
   * @memberof Viewer
   * @instance
   * @returns {boolean} True if supported, else false
   */
  public get isOrientationSupported() {
    return this._orientationSupport || false;
  }

  /**
   * Check if device orientation control is currently activated.
   * @memberof Viewer
   * @instance
   * @returns {boolean} True if active, else false
   */
  public get isOrientationActive() {
    return Boolean(this._orientation);
  }

  /**
   * Subscribe listener to specified event.
   * @memberof Viewer
   * @instance
   * @param {string} type - Type of event to subscribe to.
   * @param {Function} listener - Listener function to subscribe to event.
   * @returns {Viewer} `this`
   */
  public on(type: string, listener: () => void) {
    this._externalEventListeners[type] = this._externalEventListeners[type] || [];
    this._externalEventListeners[type].push(listener);
    return this;
  }

  /**
   * Remove an event listener (or listeners).
   * @memberof Viewer
   * @param {string} [type] - Type of event to remove listeners from. If not specified, all listeners are removed.
   * @param {Function} [listener] - Listener function to remove. If not specified, all listeners of specified type are removed.
   * @returns {Viewer} `this`
   */
  public off(type: string, listener: () => void) {
    if (!type) {
      // Remove all listeners if type isn't specified
      this._externalEventListeners = {};
      return this;
    }
    if (listener) {
      const i = this._externalEventListeners[type].indexOf(listener);
      if (i >= 0) {
        // Remove listener if found
        this._externalEventListeners[type].splice(i, 1);
      }
      if (this._externalEventListeners[type].length === 0) {
        // Remove category if empty
        delete this._externalEventListeners[type];
      }
    } else {
      // Remove category of listeners if listener isn't specified
      delete this._externalEventListeners[type];
    }
    return this;
  }

  /**
   * Fire listeners attached to specified event.
   * @private
   * @param {string} [type] - Type of event to fire listeners for.
   */
  private fireEvent(type: string, ...args: any[]) {
    if (type in this._externalEventListeners) {
      // Reverse iteration is useful, if event listener is removed inside its definition
      for (let i = this._externalEventListeners[type].length; i > 0; i--) {
        this._externalEventListeners[type][this._externalEventListeners[type].length - i].apply(null, [].slice.call(args, 1));
      }
    }
  }

  /**
   * Destructor.
   * @instance
   * @memberof Viewer
   */
  public destroy(): void {
    if (this._destroyed)
      return;

    this._destroyed = true;
    clearTimeout(this._autoRotateStart);

    if (this._renderer)
      this._renderer.destroy();
    if (this._listenersAdded) {
      document.removeEventListener("mousemove", this.onDocumentMouseMove, false);
      document.removeEventListener("mouseup", this.onDocumentMouseUp, false);
      this._container.removeEventListener("webkitfullscreenchange", this.onFullScreenChange, false);
      this._container.removeEventListener("fullscreenchange", this.onFullScreenChange, false);
      window.removeEventListener("resize", this.onDocumentResize, false);
      window.removeEventListener("orientationchange", this.onDocumentResize, false);
      this._container.removeEventListener("keydown", this.onDocumentKeyPress, false);
      this._container.removeEventListener("keyup", this.onDocumentKeyUp, false);
      this._container.removeEventListener("blur", this.clearKeys, false);
      document.removeEventListener("mouseleave", this.onDocumentMouseUp, false);
    }
    this._container.innerHTML = "";
    this._container.classList.remove("pnlm-container");
  }
}

class Quaternion {
  /** Creates a new quaternion.
   * @private
   * @constructor
   * @param {Number} w - W value
   * @param {Number} x - X value
   * @param {Number} y - Y value
   * @param {Number} z - Z value
   */
  constructor(public w: number, public x: number, public y: number, public z: number) {
  }

  /**
   * Multiplies quaternions.
   * @private
   * @param {Quaternion} q - Quaternion to multiply
   * @returns {Quaternion} Result of multiplication
   */
  public multiply(q: Quaternion): Quaternion {
    return new Quaternion(this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
      this.x * q.w + this.w * q.x + this.y * q.z - this.z * q.y,
      this.y * q.w + this.w * q.y + this.z * q.x - this.x * q.z,
      this.z * q.w + this.w * q.z + this.x * q.y - this.y * q.x);
  }

  /**
   * Converts quaternion to Euler angles.
   * @private
   * @returns {Number[]} [phi angle, theta angle, psi angle]
   */
  public toEulerAngles(): number[] {
    const phi = Math.atan2(2 * (this.w * this.x + this.y * this.z), 1 - 2 * (this.x * this.x + this.y * this.y));
    const theta = Math.asin(2 * (this.w * this.y - this.z * this.x));
    const psi = Math.atan2(2 * (this.w * this.z + this.x * this.y), 1 - 2 * (this.y * this.y + this.z * this.z));
    return [phi, theta, psi];
  }
}
