/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NavigationAids
 */

import "./CubeNavigationAid.scss";
import classnames from "classnames";
import * as React from "react";
import { Angle, AxisIndex, AxisOrder, Geometry, Matrix3d, Point2d, Vector2d, Vector3d, XYAndZ } from "@itwin/core-geometry";
import { IModelApp, IModelConnection, Viewport } from "@itwin/core-frontend";
import { CommonProps } from "@itwin/core-react";
import { UiIModelComponents } from "../UiIModelComponents";
import { ViewportComponentEvents, ViewRotationChangeEventArgs } from "../viewport/ViewportComponentEvents";
import { Cube, Face } from "./Cube";

/** @public */
export enum CubeNavigationHitBoxX {
  None = 0,
  Right = 1,
  Left = -1,
}
/** @internal
 * @deprecated in 2.x. Use [[CubeNavigationHitBoxX]] */
export enum HitBoxX {
  None = 0,
  Right = 1,
  Left = -1,
}

/** @public */
export enum CubeNavigationHitBoxY {
  None = 0,
  Back = 1,
  Front = -1,
}
/** @internal
 * @deprecated in 2.x. Use [[CubeNavigationHitBoxY]] */
export enum HitBoxY {
  None = 0,
  Back = 1,
  Front = -1,
}

/** @public */
export enum CubeNavigationHitBoxZ {
  None = 0,
  Top = 1,
  Bottom = -1,
}
/** @internal
 * @deprecated in 2.x. [[CubeNavigationHitBoxZ]] */
export enum HitBoxZ {
  None = 0,
  Top = 1,
  Bottom = -1,
}

interface CubeNavigationRotationMap {
  up: Face;
  down: Face;
  left: Face;
  right: Face;
}

const cubeNavigationFaceLocs: { [key: string]: Vector3d } = {
  [Face.Left]: Vector3d.create(CubeNavigationHitBoxX.Left, CubeNavigationHitBoxY.None, CubeNavigationHitBoxZ.None),
  [Face.Right]: Vector3d.create(CubeNavigationHitBoxX.Right, CubeNavigationHitBoxY.None, CubeNavigationHitBoxZ.None),
  [Face.Back]: Vector3d.create(CubeNavigationHitBoxX.None, CubeNavigationHitBoxY.Back, CubeNavigationHitBoxZ.None),
  [Face.Front]: Vector3d.create(CubeNavigationHitBoxX.None, CubeNavigationHitBoxY.Front, CubeNavigationHitBoxZ.None),
  [Face.Bottom]: Vector3d.create(CubeNavigationHitBoxX.None, CubeNavigationHitBoxY.None, CubeNavigationHitBoxZ.Bottom),
  [Face.Top]: Vector3d.create(CubeNavigationHitBoxX.None, CubeNavigationHitBoxY.None, CubeNavigationHitBoxZ.Top),
};

const cubeNavigationFaceRotations: { [key: string]: Matrix3d } = {
  [Face.Left]: Matrix3d.createRowValues(0, -1, 0, 0, 0, 1, -1, 0, 0),
  [Face.Right]: Matrix3d.createRowValues(0, 1, 0, 0, 0, 1, 1, 0, 0),
  [Face.Back]: Matrix3d.createRowValues(-1, 0, 0, 0, 0, 1, 0, 1, 0),
  [Face.Front]: Matrix3d.createRowValues(1, 0, 0, 0, 0, 1, 0, -1, 0),
  [Face.Bottom]: Matrix3d.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, -1),
  [Face.Top]: Matrix3d.createRowValues(1, 0, 0, 0, 1, 0, 0, 0, 1),
};

// data relating Up/Down/Left/Right directions relative to every surface
const cubeNavigationRoutes: { [key: string]: CubeNavigationRotationMap } = {
  [Face.Front]: { up: Face.Top, down: Face.Bottom, left: Face.Left, right: Face.Right },
  [Face.Back]: { up: Face.Top, down: Face.Bottom, left: Face.Right, right: Face.Left },
  [Face.Top]: { up: Face.Back, down: Face.Front, left: Face.Left, right: Face.Right },
  [Face.Bottom]: { up: Face.Front, down: Face.Back, left: Face.Left, right: Face.Right },
  [Face.Right]: { up: Face.Top, down: Face.Bottom, left: Face.Front, right: Face.Back },
  [Face.Left]: { up: Face.Top, down: Face.Bottom, left: Face.Back, right: Face.Front },
};

/** The default tolerance (1.0e-6) is appropriate if very dirty viewing operations are expected. */
const DEFAULT_TOLERANCE = 1.0e-6;

/** @internal */
export enum CubeHover {
  None = 0,
  Hover,
  Active,
}

/** Properties for the [[CubeNavigationAid]] component
 * @public
 */
export interface CubeNavigationAidProps extends CommonProps {
  iModelConnection: IModelConnection;
  viewport?: Viewport;

  // used only in testing

  /** @internal */
  onAnimationEnd?: () => void;
  /** @internal */
  animationTime?: number;
}

/** @public */
interface CubeNavigationAidState {
  dragging: boolean;
  startRotMatrix: Matrix3d;
  endRotMatrix: Matrix3d;
  animation: number;
  hoverMap: { [key: string]: CubeHover };
  face: Face;
}

/** Cube Navigation Aid Component
 * @public
 */
export class CubeNavigationAid extends React.Component<CubeNavigationAidProps, CubeNavigationAidState> {
  private _start: Vector2d = Vector2d.createZero();
  /** @internal */
  public override readonly state: Readonly<CubeNavigationAidState> = {
    dragging: false,
    startRotMatrix: Matrix3d.createIdentity(),
    endRotMatrix: Matrix3d.createIdentity(),
    animation: 1,
    hoverMap: {},
    face: Face.Top,
  };

  private _lastTime: number | undefined;
  private _animationFrame: any;
  private _mounted: boolean = false;
  private _labels: { [key: string]: string } = {
    [Face.Right]: UiIModelComponents.translate("cube.right"),
    [Face.Left]: UiIModelComponents.translate("cube.left"),
    [Face.Back]: UiIModelComponents.translate("cube.back"),
    [Face.Front]: UiIModelComponents.translate("cube.front"),
    [Face.Top]: UiIModelComponents.translate("cube.top"),
    [Face.Bottom]: UiIModelComponents.translate("cube.bottom"),
  };

  /** @internal */
  public override componentDidMount() {
    this._mounted = true;
    ViewportComponentEvents.onViewRotationChangeEvent.addListener(this._handleViewRotationChangeEvent);

    // set initial rotation
    if (this.props.viewport) {
      const newMatrix = this.props.viewport.view.getRotation().clone();
      this.setState({ startRotMatrix: newMatrix, endRotMatrix: newMatrix, animation: 1 });
    }
  }

  /** @internal */
  public override componentWillUnmount() {
    ViewportComponentEvents.onViewRotationChangeEvent.removeListener(this._handleViewRotationChangeEvent);
    clearTimeout(this._animationFrame);
    this._mounted = false;
  }

  // Synchronize with rotation coming from the Viewport
  private _handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const { animation, dragging, endRotMatrix } = this.state;
    // istanbul ignore else
    if (this.props.viewport === args.viewport && animation >= 1 && !dragging) {
      const newMatrix = this.props.viewport.view.getRotation().clone();
      if (!endRotMatrix.isAlmostEqual(newMatrix)) {
        this.setState({ startRotMatrix: newMatrix, endRotMatrix: newMatrix, animation: 1, face: Face.None });
      }
    }
  };

  private _animation = () => {
    const t = Date.now();
    const delta = this._lastTime ? t - this._lastTime : 16;
    this._lastTime = t;
    if (this.state.animation !== 1) {
      const animation = Math.min(1, this.state.animation + delta / (1000 * (this.props.animationTime || /* istanbul ignore next */ 0.4)));

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
  };

  private _animationEnd = () => {
    ViewportComponentEvents.setCubeMatrix(this.state.endRotMatrix, this.state.face, true);
    const startRotMatrix = this.state.endRotMatrix.clone();
    // istanbul ignore next
    if (this._mounted) {
      this.setState({ startRotMatrix }, () => {
        // istanbul ignore else
        if (this.props.onAnimationEnd)
          this.props.onAnimationEnd();
      });
    }
  };

  public override render(): React.ReactNode {
    const { startRotMatrix, endRotMatrix } = this.state;
    const rotMatrix = endRotMatrix;
    if (rotMatrix !== startRotMatrix && rotMatrix !== endRotMatrix)
      ViewportComponentEvents.setCubeMatrix(rotMatrix, Face.None);

    const faces: { [key: string]: React.ReactNode } = {};
    for (const key in this._labels) {
      // istanbul ignore else
      if (this._labels.hasOwnProperty(key)) {
        const f = key as Face;
        const label = this._labels[f];
        faces[f] =
          <NavCubeFace
            face={f}
            label={label}
            hoverMap={this.state.hoverMap}
            onFaceCellClick={this._handleFaceCellClick}
            onFaceCellHoverChange={this._handleCellHoverChange} />;
      }
    }

    const cubeClassNames = classnames(
      "nav-cube",
      this.state.dragging && "cube-dragging",
    );

    return (
      <div className={classnames("components-cube-container", this.props.className)}
        style={this.props.style}
        data-testid="components-cube-navigation-aid"
        onMouseDown={this._handleBoxMouseDown}
        onTouchStart={this._handleBoxTouchStart}
        role="presentation"
      >
        <div className={"cube-element-container"}>
          <Cube
            className={cubeClassNames}
            rotMatrix={rotMatrix}
            faces={faces} />
        </div>
      </div>
    );
  }

  private _handleCellHoverChange = (vect: Vector3d, state: CubeHover) => {
    if (this._isInteractionLocked()) {
      this.props.onAnimationEnd?.();
      return;
    }
    const hoverMap = this.state.hoverMap;
    hoverMap[`${vect.x}-${vect.y}-${vect.z}`] = state;
    this.setState({ hoverMap });
  };

  private _isInteractionLocked = () => {
    // Locked by markup-+
    if(undefined !== this.props.viewport && this.props.viewport === IModelApp.toolAdmin.markupView) {
      return true;
    }
    return false;
  };

  private _lastClientXY: Vector2d = Vector2d.createZero();
  private _processDrag(mousePos: Vector2d) {
    // istanbul ignore else
    if (!this._start.isAlmostEqual(mousePos)) {
      const movement = mousePos.minus(this._lastClientXY);
      const diff = movement.scale(0.05);

      const yaw = Angle.createRadians(diff.x);
      const pitch = Angle.createRadians(diff.y);

      const matX = Matrix3d.createRotationAroundAxisIndex(AxisIndex.X, pitch);
      const matZ = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, yaw);

      const mat = matX.multiplyMatrixMatrix(this.state.startRotMatrix).multiplyMatrixMatrix(matZ);
      this._setRotation(mat, Face.None);
      if (!this.state.dragging)
        this.setState({ dragging: true });
    }
    this._lastClientXY = mousePos;
  }

  private _handleBoxMouseDown = (event: any) => {
    if (this._isInteractionLocked()) {
      this.props.onAnimationEnd?.();
      return;
    }
    event.preventDefault();
    // only start listening after drag is confirmed. Ie. the 3D box is clicked.
    window.addEventListener("mousemove", this._onMouseMove, false);
    window.addEventListener("mouseup", this._onMouseUp, false);
    this._lastClientXY = Vector2d.create(event.clientX, event.clientY);
    this._start = this._lastClientXY;
  };

  private _onMouseMove = (event: MouseEvent) => {
    const mousePos = Vector2d.create(event.clientX, event.clientY);
    this._processDrag(mousePos);
  };

  private _onMouseUp = () => {
    if (this.state.dragging) {
      this.setState({ dragging: false });
      ViewportComponentEvents.setCubeMatrix(this.state.endRotMatrix, Face.None, true);
    }

    // remove so event only triggers after this.onMouseStartDrag
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
  };

  // istanbul ignore next - unable to test touch
  private _handleBoxTouchStart = (event: any) => {
    if (this._isInteractionLocked()) {
      this.props.onAnimationEnd?.();
      return;
    }
    if (1 !== event.targetTouches.length)
      return;
    window.addEventListener("touchmove", this._onTouchMove, false);
    window.addEventListener("touchend", this._onTouchEnd, false);
    this._lastClientXY = Vector2d.create(event.targetTouches[0].clientX, event.targetTouches[0].clientY);
    this._start = this._lastClientXY;
  };

  // istanbul ignore next - unable to test touch
  private _onTouchMove = (event: TouchEvent) => {
    if (1 !== event.targetTouches.length)
      return;
    const mousePos = Vector2d.create(event.targetTouches[0].clientX, event.targetTouches[0].clientY);
    this._processDrag(mousePos);
  };

  // istanbul ignore next - unable to test touch
  private _onTouchEnd = (event: TouchEvent) => {
    if (0 !== event.targetTouches.length)
      return;

    if (this.state.dragging) {
      this.setState({ dragging: false });
      ViewportComponentEvents.setCubeMatrix(this.state.endRotMatrix, Face.None, true);
    }

    window.removeEventListener("touchmove", this._onTouchMove);
    window.removeEventListener("touchend", this._onTouchEnd);
  };

  private _handleFaceCellClick = (pos: Vector3d, face: Face) => {
    if (this._isInteractionLocked()) {
      this.props.onAnimationEnd?.();
      return;
    }
    const rotMatrix = Matrix3d.createRigidViewAxesZTowardsEye(pos.x, pos.y, pos.z).inverse();
    // istanbul ignore else
    if (rotMatrix)
      this._animateRotation(rotMatrix, face);
    window.removeEventListener("mousemove", this._onMouseMove);
  };

  private _animateRotation = (endRotMatrix: Matrix3d, face: Face) => {
    if (this.state.endRotMatrix.isAlmostEqual(endRotMatrix))
      return;
    // set animation variables, let css transitions animate it.
    this._animationFrame = setTimeout(this._animation, 16.667);
    this.setState((prevState) => ({
      startRotMatrix: prevState.endRotMatrix, endRotMatrix,
      animation: 0,
      face,
    }));
  };

  private _setRotation = (endRotMatrix: Matrix3d, face: Face) => {
    ViewportComponentEvents.setCubeMatrix(endRotMatrix, face);
    // set variables, with animTime at 0 to prevent animation.
    this.setState({
      startRotMatrix: endRotMatrix,
      endRotMatrix,
      animation: 1,
      face,
    });
  };
}

/** @internal */
export interface NavCubeFaceProps extends React.AllHTMLAttributes<HTMLDivElement> {
  face: Face;
  label: string;
  hoverMap: { [key: string]: CubeHover };
  onFaceCellClick: (vector: Vector3d, face: Face) => void;
  onFaceCellHoverChange: (vector: Vector3d, state: CubeHover) => void;
}

/** @internal */
export class NavCubeFace extends React.Component<NavCubeFaceProps> {
  public override render(): React.ReactNode {
    const { face, hoverMap, onFaceCellClick, onFaceCellHoverChange, label } = this.props;
    return (
      <div className="nav-cube-face" data-testid={"nav-cube-face"}>
        <FaceRow key={0} center={true}>
          <FaceCell
            key={0}
            onFaceCellHoverChange={onFaceCellHoverChange}
            onFaceCellClick={onFaceCellClick}
            hoverMap={hoverMap}
            vector={NavCubeFace.faceCellToPos(face, 0, 0)}
            face={face}
            center={true}>
            {label}
          </FaceCell>
        </FaceRow>
      </div>
    );
  }
  public static faceCellToPos = (face: Face, x: number, y: number) => {
    const faceVect = cubeNavigationFaceLocs[face];
    const route = cubeNavigationRoutes[face];

    const faceX = x < 0 ? route.left : x > 0 ? route.right : Face.None;
    const xVect = faceX !== Face.None ? cubeNavigationFaceLocs[faceX] : Vector3d.createZero();

    const faceY = y < 0 ? route.up : y > 0 ? route.down : Face.None;
    const yVect = faceY !== Face.None ? cubeNavigationFaceLocs[faceY] : Vector3d.createZero();

    return faceVect.plus(xVect).plus(yVect);
  };
}

interface FaceRowProps extends React.AllHTMLAttributes<HTMLDivElement> {
  center?: boolean;
}

class FaceRow extends React.Component<FaceRowProps> {
  public override render(): React.ReactNode {
    const { center, children, ...props } = this.props;
    const classNames = classnames(
      "face-row",
      center && "cube-center",
    );
    return <div className={classNames} {...props}>{children}</div>;
  }
}

/** @internal */
export interface FaceCellProps extends React.AllHTMLAttributes<HTMLDivElement> {
  center?: boolean;
  onFaceCellClick: (vector: Vector3d, face: Face) => void;
  onFaceCellHoverChange: (vector: Vector3d, state: CubeHover) => void;
  hoverMap: { [key: string]: CubeHover };
  vector: Vector3d;
  face: Face;
}

/** @internal */
export class FaceCell extends React.Component<FaceCellProps> {
  private _startMouse: Point2d | undefined;
  public override render(): React.ReactNode {
    const { center, children, onFaceCellClick, onFaceCellHoverChange, hoverMap, face, vector, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars
    const { x, y, z } = vector;
    const n = `${x}-${y}-${z}`;
    const hover = hoverMap[n] === CubeHover.Hover;
    const active = hoverMap[n] === CubeHover.Active;
    const classNames = classnames(
      "face-cell",
      center && "cube-center",
      hover && "cube-hover",
      active && "cube-active",
    );

    // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
    return <div
      onMouseDown={this._handleMouseDown}
      onMouseUp={this._handleMouseUp}
      onMouseOver={this._handleMouseOver}
      onMouseOut={this._handleMouseOut}
      onTouchStart={this._handleTouchStart}
      onTouchEnd={this._handleTouchEnd}
      data-testid={`nav-cube-face-cell-${face}-${n}`}
      className={classNames}
      role="presentation"
      {...props}
    >
      {children}
    </div>;
  }
  private _handleMouseOver = () => {
    const { vector } = this.props;
    this.props.onFaceCellHoverChange(vector, CubeHover.Hover);
  };
  private _handleMouseOut = () => {
    const { vector } = this.props;
    this.props.onFaceCellHoverChange(vector, CubeHover.None);
  };
  private _handleMouseDown = (event: React.MouseEvent) => {
    const { clientX, clientY } = event;
    this.handlePointerDown(clientX, clientY);
  };
  private _handleMouseUp = (event: React.MouseEvent) => {
    const { clientX, clientY } = event;
    this.handlePointerUp(clientX, clientY);
  };

  private _handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.targetTouches.length === 1 && this.handlePointerDown(event.targetTouches[0].clientX, event.targetTouches[0].clientY);
  };

  private _handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.changedTouches.length === 1 && this.handlePointerUp(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
  };

  private handlePointerDown(x: number, y: number) {
    const { vector } = this.props;
    this._startMouse = Point2d.create(x, y);
    this.props.onFaceCellHoverChange(vector, CubeHover.Active);
  }

  private handlePointerUp(x: number, y: number) {
    const { vector, face } = this.props;
    this.props.onFaceCellHoverChange(vector, CubeHover.None);
    const mouse = Point2d.create(x, y);
    if (this._startMouse && this._startMouse.isAlmostEqual(mouse)) {
      const isFace = Math.abs(vector.x) + Math.abs(vector.y) + Math.abs(vector.z) === 1;
      this.props.onFaceCellClick(vector, isFace ? face : Face.None);
    }
  }
}

enum Pointer {
  None = 0,
  Up,
  Down,
  Left,
  Right,
}
