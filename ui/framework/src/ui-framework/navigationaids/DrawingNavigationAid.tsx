/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import { NavigationAidControl } from "./NavigationAidControl";
import { ViewRotationChangeEventArgs, ViewportComponentEvents } from "@bentley/ui-components";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { Geometry, Constant, Point2d, Point3d, Vector3d, Matrix3d, Point4d } from "@bentley/geometry-core";
import { IModelConnection, Viewport, ScreenViewport, ViewState, IModelApp, ViewManager } from "@bentley/imodeljs-frontend";
import { ContentViewManager } from "../content/ContentViewManager";
import { UiFramework } from "../UiFramework";
import "./DrawingNavigationAid.scss";
import { ContentControl } from "../content/ContentControl";
import { CommonProps } from "@bentley/ui-core";

/**
 * A Drawing Navigation Aid control.
 * @alpha
 */
export class DrawingNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <DrawingNavigationAid iModelConnection={options.imodel} />;
  }
  public getSize(): string | undefined { return "96px"; }
}

/**
 * Enum for mode that minimap is currently in
 * @alpha
 */
export enum MapMode {
  Opened = "map-opened",
  Closed = "map-closed",
}

// used only in testing
/** @internal */
export interface DrawingNavigationAidProps extends CommonProps {
  iModelConnection: IModelConnection;
  animationTime?: number;
  openSize?: Vector3d;
  closeSize?: Vector3d;
  initialMapMode?: MapMode;
  onAnimationEnd?: () => void;
  contentControlOverride?: ContentControl | undefined;
  initialRotateMinimapWithView?: boolean;
}

/** @internal */
export interface DrawingNavigationAidState {
  startOrigin: Point3d;
  origin: Point3d;
  extents: Vector3d;
  startRotation: Matrix3d;
  rotation: Matrix3d;

  startMapOrigin: Point3d;
  mapOrigin: Point3d;
  startMapExtents: Vector3d;
  mapExtents: Vector3d;

  mouseStart: Point2d;
  panningDirection: Vector3d;
  startDrawingZoom: number;
  drawingZoom: number;

  mode: MapMode;
  animation: number;

  isMoving: boolean;
  isPanning: boolean;

  rotateMinimapWithView: boolean;
}

/**
 * A Drawing Navigation Aid.
 * @alpha
 */
export class DrawingNavigationAid extends React.Component<DrawingNavigationAidProps, DrawingNavigationAidState> {
  private _rootElement: HTMLDivElement | null = null;
  private _viewContainerElement: HTMLDivElement | null = null;
  private _viewElement: HTMLDivElement | null = null;
  private _rootOffset: ClientRect = { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 };
  private _viewport: Viewport | undefined;
  private _animationFrame: any;
  private _view?: ViewState;
  private _mounted: boolean = false;

  /** @hidden */
  public readonly state: Readonly<DrawingNavigationAidState>;

  constructor(props: DrawingNavigationAidProps) {
    super(props);
    const mode = props.initialMapMode || MapMode.Closed;
    const mapExtents = mode === MapMode.Closed ? this._getClosedMapSize() : this._getOpenedMapSize();
    const startMapExtents = mapExtents;

    this.state = {
      startOrigin: Point3d.createZero(),
      origin: Point3d.createZero(),
      extents: Vector3d.create(1, 1, 1),
      startRotation: Matrix3d.createIdentity(),
      rotation: Matrix3d.createIdentity(),

      startMapOrigin: Point3d.createZero(),
      mapOrigin: Point3d.createZero(),
      startMapExtents,
      mapExtents,

      mouseStart: Point2d.createZero(),
      panningDirection: Vector3d.createZero(),
      startDrawingZoom: 1.0,
      drawingZoom: 1.0,

      mode,
      animation: 1.0,

      isMoving: false,
      isPanning: false,
      rotateMinimapWithView: props.initialRotateMinimapWithView !== undefined ? props.initialRotateMinimapWithView : false,
    };
  }

  /** @hidden */
  public render(): React.ReactNode {
    const {
      startOrigin, origin, extents,
      startRotation, rotation,
      startMapOrigin, mapOrigin,
      startMapExtents, mapExtents,
      startDrawingZoom, drawingZoom,
      animation,
      mode, rotateMinimapWithView,
    } = this.state;

    const a = DrawingNavigationAid._animationFn(animation);
    const rot = Matrix3d.createFromQuaternion(Point4d.interpolateQuaternions(startRotation.toQuaternion(), a, rotation.toQuaternion()));
    const or = startOrigin.interpolate(a, origin);
    const map = startMapOrigin.interpolate(a, mapOrigin);
    const sz = startMapExtents.interpolate(a, mapExtents);
    const dz = Geometry.interpolate(startDrawingZoom, a, drawingZoom);

    const rootStyle: React.CSSProperties = {
      width: sz.x, height: sz.y,
      ...this.props.style,
    };
    const tOr = rotateMinimapWithView ? rotation.multiplyVector(Vector3d.createFrom(or)) : Vector3d.createFrom(or);
    const tMap = rotateMinimapWithView ? rotation.multiplyVector(Vector3d.createFrom(map)) : Vector3d.createFrom(map);

    const tPosX = (tOr.x - extents.x / 2 - tMap.x) * dz + sz.x / 2;
    const tPosY = (-tOr.y - extents.y / 2 + tMap.y) * dz + sz.y / 2;
    const viewWindowStyle = {
      transform: `matrix(1, 0, 0, 1, ${tPosX}, ${tPosY})`,
      height: extents.y * dz,
      width: extents.x * dz,
    };
    if (!rotateMinimapWithView)
      viewWindowStyle.transform = `matrix(${rot.at(0, 0)}, ${rot.at(1, 0)}, ${rot.at(0, 1)}, ${rot.at(1, 1)}, ${tPosX}, ${tPosY})`;
    const isAnimating = animation !== 1 && !startMapExtents.isExactEqual(mapExtents);
    if (mode === MapMode.Opened || isAnimating) {
      rootStyle.position = "fixed";
      rootStyle.right = window.innerWidth - this._rootOffset.right;
      rootStyle.top = this._rootOffset.top;
    }

    const halfExtents = extents.scale(.5);
    const offset = rotateMinimapWithView ? Vector3d.createZero() : rotation.multiplyTransposeVector(halfExtents).minus(halfExtents);

    const unrotateLabel = UiFramework.i18n.translate("UiFramework:drawing.unrotate");
    const e = sz.scale(1 / dz);
    const halfMapExtents = e.scale(.5);
    const mapOffset = rotateMinimapWithView ? rotation.multiplyTransposeVector(halfMapExtents) : halfMapExtents;
    const nodes = (
      <div className={classnames("drawing-navigation-aid", this.props.className)}
        data-testid="drawing-navigation-aid"
        ref={this._rootElementRef}
        onWheel={this._handleWheel}
        onMouseDown={this._handleDrawingMouseDown}
        style={rootStyle}>
        <DrawingNavigationCanvas view={this._view} origin={map.plus(offset).minus(mapOffset)} extents={e} zoom={dz} rotation={rotateMinimapWithView ? rotation : Matrix3d.createIdentity()} />
        <div className="drawing-container"
          data-testid="drawing-container"
          ref={this._viewContainerElementRef}>
          <div className="drawing-view-window"
            data-testid="drawing-view-window"
            onMouseDown={this._handleWindowMouseDown}
            style={viewWindowStyle}
            ref={this._viewElementRef} />
          <div className={classnames("toggle-rotate-style", "icon", "icon-rotate-left", { checked: rotateMinimapWithView })} data-testid="toggle-rotate-style"
            style={mode === MapMode.Closed && !isAnimating ? { bottom: 2, left: 2 } : {}}
            title={UiFramework.i18n.translate("UiFramework:drawing.rotateStyle")}
            onClick={this._toggleRotationMode} />
          {!rot.isIdentity &&
            <div className="unrotate-button" data-testid="drawing-unrotate-button" style={mode === MapMode.Closed && !isAnimating ? { top: 2 } : {}} onClick={this._handleUnrotate}>{unrotateLabel}</div>}
          {mode === MapMode.Opened && !isAnimating && <>
            <div className="close" data-testid="drawing-close-button" onClick={this._closeLargeMap}>
              <div className="close-icon icon icon-sort-up" />
            </div>
            <div className="zoom">
              <div className="zoom-button icon icon-add" data-testid="drawing-zoom-in-button" onClick={this._handleZoomIn} />
              <div className="zoom-button icon icon-remove-2" data-testid="drawing-zoom-out-button" onClick={this._handleZoomOut} />
            </div>
          </>}
        </div>
      </div>
    );
    if (mode === MapMode.Closed && (animation === 1.0 || startMapExtents.isExactEqual(mapExtents))) {
      return nodes;
    } else {
      let drawingPortal = document.querySelector("#drawing-portal");
      if (!drawingPortal) {
        drawingPortal = document.createElement("div");
        drawingPortal.id = "drawing-portal";
        document.body.appendChild(drawingPortal);
      }
      return ReactDOM.createPortal(nodes, drawingPortal);
    }
  }

  private _rootElementRef = (el: HTMLDivElement | null) => {
    this._rootElement = el;
  }

  private _viewElementRef = (el: HTMLDivElement | null) => {
    this._viewElement = el;
  }

  private _viewContainerElementRef = (el: HTMLDivElement | null) => {
    this._viewContainerElement = el;
  }

  private _lastTime: number | undefined;

  private static _animationFn = (t: number) => t < .5 ? 2 * t ** 2 : -1 + (4 - 2 * t) * t;
  private _animation = () => {
    const t = Date.now();
    const delta = this._lastTime ? t - this._lastTime : 16;
    this._lastTime = t;
    if (this.state.animation !== 1) {
      const animation = Math.min(1, this.state.animation + delta / (1000 * (this.props.animationTime || 0.4)));
      this._updateFrustum();

      // istanbul ignore next
      if (this._mounted) {
        this.setState({ animation }, () => {
          this._animationFrame = setTimeout(this._animation, 16.667);
        });
      }
    } else {
      this._lastTime = undefined;
      this._animationEnd();
    }
  }

  private _animationEnd = () => {
    const startMapOrigin = Point3d.createFrom(this.state.mapOrigin);
    const startMapExtents = Vector3d.createFrom(this.state.mapExtents);
    const startDrawingZoom = this.state.drawingZoom;
    const startOrigin = this.state.origin;
    const startRotation = this.state.rotation;
    // istanbul ignore next
    if (this._mounted) {
      this.setState({ startMapOrigin, startDrawingZoom, startOrigin, startRotation, startMapExtents }, () => {
        // istanbul ignore else
        if (this.props.onAnimationEnd)
          this.props.onAnimationEnd();
        this._updateFrustum();
      });
    }
  }

  private _lastPanTime: number | undefined;

  private _panAnimation = () => {
    const t = Date.now();
    if (this._lastPanTime === undefined)
      this._lastPanTime = t - 16.667;
    const delta = t - this._lastPanTime;
    this._lastPanTime = t;
    if (!this.state.panningDirection.isAlmostZero && this.state.isMoving) {
      const { panningDirection } = this.state;
      const offset = panningDirection.scale(delta / 1000 / this.state.drawingZoom);
      const mapOrigin = this.state.mapOrigin.plus(offset);

      const origin = this.state.origin.plus(offset);
      this._updateFrustum();
      // istanbul ignore next
      if (this._mounted) {
        this.setState({ mapOrigin, origin, panningDirection }, () => {
          this._animationFrame = setTimeout(this._panAnimation, 16.667);
        });
      }
    } else {
      this._lastPanTime = undefined;
    }
  }

  public componentDidMount() {
    this._mounted = true;
    ViewportComponentEvents.onViewRotationChangeEvent.addListener(this._handleViewRotationChangeEvent);
    window.addEventListener("mousedown", this._handleMouseDown as any);
    window.addEventListener("mouseup", this._handleMouseDragEnd as any);
    window.addEventListener("mousemove", this._handleMouseDrag as any);
    window.addEventListener("keyup", this._handleKeyUp as any);
  }

  public componentWillUnmount() {
    ViewportComponentEvents.onViewRotationChangeEvent.removeListener(this._handleViewRotationChangeEvent);
    window.removeEventListener("mousedown", this._handleMouseDown as any);
    window.removeEventListener("mouseup", this._handleMouseDragEnd as any);
    window.removeEventListener("mousemove", this._handleMouseDrag as any);
    window.removeEventListener("keyup", this._handleKeyUp as any);
    clearTimeout(this._animationFrame);
    if (this.props.onAnimationEnd)
      this.props.onAnimationEnd();

    const rt = document.getElementById("drawing-portal") as HTMLDivElement;
    if (rt && rt.parentElement !== null && rt.children.length === 0) {
      rt.parentElement.removeChild(rt);
    }
    this._mounted = false;
  }

  // Synchronize with rotation coming from the Viewport
  private _handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const activeContentControl = this.props.contentControlOverride !== undefined ? this.props.contentControlOverride : /* istanbul ignore next */ ContentViewManager.getActiveContentControl();
    if (!this.state.isMoving && !this.state.isPanning && activeContentControl && activeContentControl.isViewport && activeContentControl.viewport === args.viewport) {
      const extents = args.viewport.view.getExtents();
      const rotation = args.viewport.view.getRotation();
      const halfExtents = extents.scale(.5);
      const offset = this.state.rotateMinimapWithView ? rotation.multiplyTransposeVector(halfExtents) : halfExtents;
      const origin = args.viewport.view.getOrigin().plus(offset);
      const deltaZoom = (this.state.extents.x - extents.x) / this.state.extents.x;
      let drawingZoom = this.state.drawingZoom / (1 - deltaZoom);
      const deltaOrigin = origin.minus(this.state.origin);
      let mapOrigin = this.state.mapOrigin.plus(deltaOrigin);
      mapOrigin = mapOrigin.plus(Vector3d.createFrom(origin.minus(mapOrigin)).scale(deltaZoom));
      if (this._viewport !== args.viewport) {
        const rect = DrawingNavigationAid.findRotatedWindowDimensions(extents, rotation);
        const maxRectDim = Math.max(rect.y, rect.x);
        const maxExtentDim = Math.max(this.state.mapExtents.x, this.state.mapExtents.y);
        drawingZoom = maxExtentDim / (3 * maxRectDim);
        mapOrigin = origin.clone();
        this._viewport = args.viewport;
        this._view = this._viewport.view.clone();
      }
      // istanbul ignore next
      if (this._mounted) {
        this.setState({
          startOrigin: origin, origin, extents,
          startRotation: rotation, rotation,
          startMapOrigin: mapOrigin, mapOrigin,
          startDrawingZoom: drawingZoom, drawingZoom,
        });
      }
    }
  }

  private _updateFrustum = () => {
    const halfExtents = this.state.extents.scale(.5);
    const offset = this.state.rotateMinimapWithView ? this.state.rotation.multiplyTransposeVector(halfExtents) : halfExtents;
    const origin = this.state.origin.minus(offset);
    ViewportComponentEvents.setDrawingViewportState(origin, this.state.rotation);
  }

  private _toggleRotationMode = () => {
    const rotateMinimapWithView = !this.state.rotateMinimapWithView;
    this.setState({ rotateMinimapWithView }, () => {
      if (this._viewport)
        this._handleViewRotationChangeEvent({ viewport: this._viewport });
    });
  }

  private _handleKeyUp = (event: React.KeyboardEvent) => {
    if ((event.key === "Escape" || event.key === "Esc") && this.state.mode === MapMode.Opened) {
      this._closeLargeMap();
    }
  }

  private _lastClientXY: Point2d = Point2d.createZero();
  private _handleMouseDown = (event: React.MouseEvent) => {
    // Used only to determine if mouse was moved between mousedown and mouseup
    const mouseStart = Point2d.create(event.clientX, event.clientY);
    this.setState({ mouseStart });
    this._lastClientXY = Point2d.create(event.clientX, event.clientY);
  }
  private _handleDrawingMouseDown = (event: React.MouseEvent) => {
    if (this.state.mode === MapMode.Opened) {
      event.preventDefault();
      this.setState({ isPanning: true });
    }
  }

  private _handleWindowMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    this.setState({ isMoving: true });
  }

  private _handleMouseDrag = (event: React.MouseEvent) => {
    const mouse = Point2d.create(event.clientX, event.clientY);
    const movement = mouse.minus(this._lastClientXY);
    if (this.state.isMoving) {
      // add scaled mouse movement
      const vect = Vector3d.create(movement.x / this.state.drawingZoom, -movement.y / this.state.drawingZoom, 0);
      const offset = this.state.rotateMinimapWithView ? this.state.rotation.multiplyTransposeVector(vect) : vect;
      const origin = this.state.origin.plus(offset);
      const panningDirection = this._getPanVector();
      const wasAlmostZero = this.state.panningDirection.isAlmostEqual;
      this.setState({ startOrigin: origin, origin, panningDirection, isPanning: false }, () => {
        this._updateFrustum();
        if (wasAlmostZero && !this.state.panningDirection.isAlmostZero) {
          this._animationFrame = setTimeout(this._panAnimation, 16.667);
        }
      });
    } else if (this.state.isPanning) {
      if (this.state.mode === MapMode.Opened) {
        const vect = Vector3d.create(movement.x / this.state.drawingZoom, -movement.y / this.state.drawingZoom, 0);
        const offset = this.state.rotateMinimapWithView ? this.state.rotation.multiplyTransposeVector(vect) : vect;
        const mapOrigin = this.state.mapOrigin.minus(offset);
        this.setState({ startMapOrigin: mapOrigin, mapOrigin });
      }
    }
    this._lastClientXY = Point2d.create(event.clientX, event.clientY);
  }

  private _handleMouseDragEnd = (event: React.MouseEvent) => {
    const mouse = Point2d.create(event.clientX, event.clientY);
    if (mouse.isAlmostEqual(this.state.mouseStart) &&
      this.state.mode === MapMode.Closed &&
      (event.target === this._viewContainerElement || event.target === this._viewElement)) {
      this._openLargeMap();
    } else if (this.state.isMoving) {
      this.setState({ isMoving: false });
      clearInterval(this._animationFrame);
      if (this.state.mode === MapMode.Closed) {
        setTimeout(() => {
          const startMapOrigin = this.state.mapOrigin;
          const mapOrigin = this.state.origin.clone();
          // istanbul ignore next
          if (this._mounted) {
            this.setState({ startMapOrigin, mapOrigin, animation: 0 }, () => {
              this._animationFrame = setTimeout(this._animation, 16.667);
            });
          }
        }, 0);
      }
    } else if (this.state.isPanning) {
      if (this.state.mode === MapMode.Opened) {
        event.stopPropagation();
        this.setState({ isPanning: false });
      }
    } else if ((!(event.target instanceof Node) || this._rootElement && !this._rootElement.contains(event.target)) && mouse.isAlmostEqual(this.state.mouseStart)) {
      this._closeLargeMap();
    }
    this._lastClientXY = Point2d.create(event.clientX, event.clientY);
  }

  /** @internal */
  public static getDefaultClosedMapSize = (): Vector3d => {
    return Vector3d.create(96, 96);
  }

  /** @internal */
  public static getDefaultOpenedMapSize = (paddingX: number = 0, paddingY: number = 0): Vector3d => {
    return Vector3d.create(window.innerWidth / 3 - 2 * (window.innerWidth - paddingX), window.innerHeight / 3 - 2 * paddingY);
  }

  private _getClosedMapSize = (): Vector3d => {
    if (this.props.closeSize === undefined)
      return DrawingNavigationAid.getDefaultClosedMapSize();
    return this.props.closeSize;
  }
  private _getOpenedMapSize = (): Vector3d => {
    if (this.props.openSize === undefined)
      return DrawingNavigationAid.getDefaultOpenedMapSize(this._rootOffset.right, this._rootOffset.top);
    return this.props.openSize;
  }

  private _openLargeMap = () => {
    if (this.state.mode === MapMode.Closed && this.state.animation === 1.0) {
      if (this._rootElement) {
        const rect = this._rootElement.getBoundingClientRect();
        this._rootOffset = rect;
      }
      const startMapExtents = Vector3d.createFrom(this.state.mapExtents);
      const mapExtents = this._getOpenedMapSize();
      this.setState({
        mode: MapMode.Opened,
        isMoving: false, isPanning: false,
        mapExtents, startMapExtents,
        animation: 0,
      }, () => {
        this._animationFrame = setTimeout(this._animation);
      });
    }
  }

  private _closeLargeMap = () => {
    if (this.state.mode === MapMode.Opened && this.state.animation === 1.0) {
      const startMapOrigin = this.state.mapOrigin;
      const mapOrigin = this.state.origin.clone();
      const startMapExtents = Vector3d.createFrom(this.state.mapExtents);
      const mapExtents = this._getClosedMapSize();
      const rect = DrawingNavigationAid.findRotatedWindowDimensions(this.state.extents, this.state.rotation);
      const maxRectDim = Math.max(rect.y, rect.x);
      const maxExtentDim = Math.max(mapExtents.x, mapExtents.y);
      const drawingZoom = maxExtentDim / (3 * maxRectDim);
      const startDrawingZoom = this.state.drawingZoom;
      this.setState({
        mode: MapMode.Closed,
        startMapOrigin, mapOrigin,
        startDrawingZoom, drawingZoom,
        isMoving: false, isPanning: false,
        startMapExtents, mapExtents,
        panningDirection: Vector3d.createZero(),
        animation: 0,
      }, () => {
        this._animationFrame = setTimeout(this._animation, 16.667);
      });
    }
  }

  private _getPanVector = () => {
    const rect = this.state.rotateMinimapWithView ? this.state.extents : DrawingNavigationAid.findRotatedWindowDimensions(this.state.extents, this.state.rotation);

    const mapExtents = this.state.mapExtents.scale(1 / this.state.drawingZoom);

    const maxMagnitude = 80; // maximum acceleration
    const magnitudeTravel = 30; // How far, in pixels, that magnitude increases from 0 to max acceleration

    const diff = Vector3d.createFrom(this.state.origin.minus(this.state.mapOrigin));
    const diffVector = this.state.rotateMinimapWithView ? this.state.rotation.multiplyVector(diff) : diff;

    // capture any values
    const magnitudeVector = Vector3d.create(
      Math.max(0, Math.abs(diffVector.x) - (mapExtents.x - rect.x) / 2),
      Math.max(0, Math.abs(diffVector.y) - (mapExtents.y - rect.y) / 2),
    );
    if (magnitudeVector.isAlmostZero)
      return Vector3d.createZero();
    const magnitude = Math.min(magnitudeVector.magnitude() * this.state.drawingZoom, magnitudeTravel) / magnitudeTravel * maxMagnitude;

    const vect = Vector3d.createFrom(this.state.origin.minus(this.state.mapOrigin)); // vect will never be zero or magnitude would also be zero
    const norm = vect.normalize();
    return norm!.scale(magnitude); // norm is only undefined when vect is zero, in which it would have returned at magnitudeVector.isAlmostZero
  }

  private _handleWheel = (event: React.WheelEvent) => {
    if (this.state.mode === MapMode.Opened && this.state.animation === 1) {
      const { mapOrigin, drawingZoom } = this.state;
      const mapSize = this._getOpenedMapSize();

      const mouseX = event.clientX - this._rootOffset.right + mapSize.x / 2;
      const mouseY = event.clientY - this._rootOffset.top - mapSize.y / 2;
      if (event.deltaY < 0) {
        const zoom = drawingZoom * 1.1;
        const vect = Vector3d.create(mouseX * 0.1 / zoom, -mouseY * 0.1 / zoom, 0);
        const offset = this.state.rotateMinimapWithView ? this.state.rotation.multiplyTransposeVector(vect) : vect;
        const m = mapOrigin.plus(offset);
        this.setState({ mapOrigin: m, drawingZoom: zoom });
      }
      if (event.deltaY > 0) {
        const zoom = drawingZoom / 1.1;
        const vect = Vector3d.create(mouseX * 0.1 / drawingZoom, -mouseY * 0.1 / drawingZoom, 0);
        const offset = this.state.rotateMinimapWithView ? this.state.rotation.multiplyTransposeVector(vect) : vect;
        const m = mapOrigin.minus(offset);
        this.setState({ mapOrigin: m, drawingZoom: zoom });
      }
    }
  }

  private _handleZoomIn = () => {
    const zoom = this.state.drawingZoom * 1.4;
    this.setState({ drawingZoom: zoom });
  }

  private _handleZoomOut = () => {
    const zoom = this.state.drawingZoom / 1.4;
    this.setState({ drawingZoom: zoom });
  }

  private _handleUnrotate = () => {
    const startRotation = this.state.rotation;
    const halfExtents = this.state.extents.scale(.5);
    const offset = this.state.rotateMinimapWithView ? Vector3d.createZero() : this.state.rotation.multiplyTransposeVector(halfExtents).minus(halfExtents);
    const startOrigin = this.state.origin;
    const origin = this.state.origin.plus(offset);
    const startMapOrigin = this.state.mapOrigin;
    const mapOrigin = this.state.mapOrigin.plus(offset);
    this.setState({ animation: 0, startOrigin, origin, startMapOrigin, mapOrigin, startRotation, rotation: Matrix3d.createIdentity() }, () => {
      this._animationFrame = setTimeout(this._animation, 16.667);
    });
  }

  /** @internal */
  public static findRotatedWindowDimensions = (extents: Vector3d, rotation: Matrix3d) => {
    const cos = rotation.at(0, 0);
    const sin = rotation.at(1, 0);
    // extents.x/y should be divided in half, but we don't have to do that immediately.
    const cosWidth = cos * extents.x;
    const sinHeight = sin * extents.y;

    const sinWidth = cos * extents.x;
    const cosHeight = sin * extents.y;

    const a = Math.atan2(sin, cos);

    if (a % Math.PI >= 0 && a % Math.PI < Math.PI / 2) {
      const y1 = -cosHeight - sinWidth;
      const x2 = cosWidth + sinHeight;
      const y3 = cosHeight + sinWidth;
      const x4 = -cosWidth - sinHeight;
      // Instead, divide total difference
      return Vector3d.create(Math.abs(x2 - x4) / 2, Math.abs(y1 - y3) / 2);
    } else {
      const x1 = -cosWidth + sinHeight;
      const y2 = -cosHeight + sinWidth;
      const x3 = cosWidth - sinHeight;
      const y4 = cosHeight - sinWidth;
      return Vector3d.create(Math.abs(x1 - x3) / 2, Math.abs(y2 - y4) / 2);
    }
  }
}

/** @internal */
export interface DrawingNavigationCanvasProps {
  view: ViewState | undefined;
  origin: Point3d;
  extents: Vector3d;
  zoom: number;
  rotation: Matrix3d;
  viewManagerOverride?: ViewManager;
  screenViewportOverride?: typeof ScreenViewport;
}

/** @internal */
export class DrawingNavigationCanvas extends React.Component<DrawingNavigationCanvasProps> {
  private _canvasElement: HTMLDivElement | null = null;
  private _vp?: ScreenViewport;
  public render(): React.ReactNode {
    return (
      <div className="drawing-canvas"
        data-testid="drawing-canvas"
        ref={this._canvasElementRef}>
      </div>
    );
  }
  public componentDidMount() {
    if (this._canvasElement && this.props.view !== undefined) {
      const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
      /* istanbul ignore next */
      const screenViewport = this.props.screenViewportOverride ? this.props.screenViewportOverride : /* istanbul ignore next */ ScreenViewport;
      const previousView = viewManager.selectedView;
      this._vp = screenViewport.create(this._canvasElement, this.props.view);
      viewManager.addViewport(this._vp);
      viewManager.setSelectedView(previousView); // switch to original viewport
      this._update();
    }
  }

  private _update = () => {
    if (this._vp) {
      const max = Math.max(this.props.extents.x, this.props.extents.y);
      this._vp.view.extentLimits = { max, min: Constant.oneMillimeter };
      this._vp.view.setOrigin(this.props.origin);
      this._vp.view.setRotation(this.props.rotation);
      this._vp.view.setExtents(this.props.extents);
      this._vp.applyViewState(this._vp.view);
    }
  }

  public componentDidUpdate(oldProps: DrawingNavigationCanvasProps) {
    const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
    if (this.props.view !== undefined) {
      if (oldProps.view !== this.props.view) {
        const screenViewport = this.props.screenViewportOverride ? this.props.screenViewportOverride : /* istanbul ignore next */ ScreenViewport;
        /* needs fixed to reconstruct when view is changed
        if (oldProps.view !== undefined && this.props.view.id !== oldProps.view.id && this._vp !== undefined) {
          viewManager.dropViewport(this._vp, true);
        } */
        if (this._canvasElement) {
          const previousView = viewManager.selectedView;
          this._vp = screenViewport.create(this._canvasElement, this.props.view);
          viewManager.addViewport(this._vp);
          viewManager.setSelectedView(previousView); // switch to original viewport
          this._update();
        }
      } else if (!this.props.origin.isExactEqual(oldProps.origin) || !this.props.extents.isExactEqual(oldProps.extents) || this.props.zoom !== oldProps.zoom || !this.props.rotation.isExactEqual(oldProps.rotation)) {
        this._update();
      }
    }
  }

  public componentWillUnmount() {
    if (this._vp) {
      const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
      viewManager.dropViewport(this._vp, false);
    }
  }

  private _canvasElementRef = (el: HTMLDivElement | null) => {
    this._canvasElement = el;
  }

}
