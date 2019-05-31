/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";

import { Cube, Face, CommonProps } from "@bentley/ui-core";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { NavigationAidControl } from "./NavigationAidControl";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import * as classnames from "classnames";
import { Geometry, Angle, AxisIndex, Matrix3d, Point2d, Vector2d, Vector3d } from "@bentley/geometry-core";

import "./CubeNavigationAid.scss";
import { UiFramework } from "../UiFramework";

import { ViewRotationChangeEventArgs, ViewportComponentEvents } from "@bentley/ui-components";
import { ContentViewManager } from "../content/ContentViewManager";
import { ContentControl } from "../content/ContentControl";

/** NavigationAid that displays an interactive rotation cube that synchronizes with the rotation of the iModel Viewport
 * @alpha
 */
export class CubeNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <CubeNavigationAid iModelConnection={options.imodel} />;
  }
  public getSize(): string | undefined { return "96px"; }
}

/** @internal */
export enum HitBoxX {
  None = 0,
  Right = 1,
  Left = -1,
}

/** @internal */
export enum HitBoxY {
  None = 0,
  Back = 1,
  Front = -1,
}

/** @internal */
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
  [Face.Left]: Vector3d.create(HitBoxX.Left, HitBoxY.None, HitBoxZ.None),
  [Face.Right]: Vector3d.create(HitBoxX.Right, HitBoxY.None, HitBoxZ.None),
  [Face.Back]: Vector3d.create(HitBoxX.None, HitBoxY.Back, HitBoxZ.None),
  [Face.Front]: Vector3d.create(HitBoxX.None, HitBoxY.Front, HitBoxZ.None),
  [Face.Bottom]: Vector3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Bottom),
  [Face.Top]: Vector3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Top),
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

/** @internal */
export enum CubeHover {
  None = 0,
  Hover,
  Active,
}

/** Properties for the [[CubeNavigationAid]] component
 * @alpha
 */
export interface CubeNavigationAidProps extends CommonProps {
  iModelConnection: IModelConnection;

  // used only in testing

  /** @internal */
  onAnimationEnd?: () => void;
  /** @internal */
  animationTime?: number;
  /** @internal */
  contentControlOverride?: ContentControl | undefined;
}

/** @internal */
interface CubeNavigationAidState {
  dragging: boolean;
  startRotMatrix: Matrix3d;
  endRotMatrix: Matrix3d;
  animation: number;
  hoverMap: { [key: string]: CubeHover };
  face: Face;
}

/** Cube Navigation Aid Component
 * @alpha
 */
export class CubeNavigationAid extends React.Component<CubeNavigationAidProps, CubeNavigationAidState> {
  private _start: Vector2d = Vector2d.createZero();
  public readonly state: Readonly<CubeNavigationAidState> = {
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

  /** @internal */
  public componentDidMount() {
    this._mounted = true;
    ViewportComponentEvents.onViewRotationChangeEvent.addListener(this._handleViewRotationChangeEvent);

    // set initial rotation
    const activeContentControl = this.props.contentControlOverride !== undefined ? this.props.contentControlOverride : /* istanbul ignore next */ ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      const newMatrix = activeContentControl.viewport.view.getRotation().clone();
      this.setState({ startRotMatrix: newMatrix, endRotMatrix: newMatrix, animation: 1 });
    }
  }

  /** @internal */
  public componentWillUnmount() {
    ViewportComponentEvents.onViewRotationChangeEvent.removeListener(this._handleViewRotationChangeEvent);
    clearTimeout(this._animationFrame);
    this._mounted = false;
  }

  // Synchronize with rotation coming from the Viewport
  private _handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const { animation, dragging, endRotMatrix } = this.state;
    const activeContentControl = this.props.contentControlOverride !== undefined ? this.props.contentControlOverride : /* istanbul ignore next */ ContentViewManager.getActiveContentControl();
    // istanbul ignore else
    if (activeContentControl && activeContentControl.isViewport && activeContentControl.viewport === args.viewport && animation >= 1 && !dragging) {
      const newMatrix = activeContentControl.viewport.view.getRotation().clone();
      if (!endRotMatrix.isAlmostEqual(newMatrix)) {
        this.setState({ startRotMatrix: newMatrix, endRotMatrix: newMatrix, animation: 1, face: Face.None });
      }
    }
  }

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
  }

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
  }

  private static _animationFn = (t: number) => t < .5 ? 2 * t ** 2 : -1 + (4 - 2 * t) * t;

  private static _isMatrixFace = (matrix: Matrix3d): boolean => {
    let sum = 0;
    for (const coff of matrix.coffs) {
      if (Geometry.isAlmostEqualNumber(Math.abs(coff), 1))
        sum++;
    }
    // Assuming matrix is a proper rotation matrix:
    // if matrix viewing a face, there will be a total of 3 values either almost -1, or almost 1.
    return sum === 3;
  }

  public render(): React.ReactNode {
    const { animation, startRotMatrix, endRotMatrix } = this.state;
    const visible = CubeNavigationAid._isMatrixFace(endRotMatrix) && animation === 1.0;
    const rotMatrix = CubeNavigationAid._interpolateRotMatrix(startRotMatrix, animation, endRotMatrix);
    if (rotMatrix !== startRotMatrix && rotMatrix !== endRotMatrix)
      ViewportComponentEvents.setCubeMatrix(rotMatrix, Face.None);

    const labels: { [key: string]: string } = {
      [Face.Right]: UiFramework.translate("cube.right"),
      [Face.Left]: UiFramework.translate("cube.left"),
      [Face.Back]: UiFramework.translate("cube.back"),
      [Face.Front]: UiFramework.translate("cube.front"),
      [Face.Top]: UiFramework.translate("cube.top"),
      [Face.Bottom]: UiFramework.translate("cube.bottom"),
    };

    const faces: { [key: string]: React.ReactNode } = {};
    for (const key in labels) {
      // istanbul ignore else
      if (labels.hasOwnProperty(key)) {
        const f = key as Face;
        const label = labels[f];
        faces[f] =
          <NavCubeFace
            face={f}
            label={label}
            hoverMap={this.state.hoverMap}
            onFaceCellClick={this._handleFaceCellClick}
            onFaceCellHoverChange={this._handleCellHoverChange} />;
      }
    }

    return (
      <div className={classnames("uifw-cube-container", this.props.className)}
        style={this.props.style}
        data-testid="cube-navigation-aid"
        onMouseDown={this._handleBoxMouseDown}
        onTouchStart={this._handleBoxTouchStart} >
        <div className={"cube-element-container"}>
          <Cube
            className={classnames("nav-cube", { dragging: this.state.dragging })}
            rotMatrix={rotMatrix}
            faces={faces} />
        </div>
        <PointerButton data-testid="cube-pointer-button-up" visible={visible} pointerType={Pointer.Up} onArrowClick={this._onArrowClick} />
        <PointerButton data-testid="cube-pointer-button-down" visible={visible} pointerType={Pointer.Down} onArrowClick={this._onArrowClick} />
        <PointerButton data-testid="cube-pointer-button-left" visible={visible} pointerType={Pointer.Left} onArrowClick={this._onArrowClick} />
        <PointerButton data-testid="cube-pointer-button-right" visible={visible} pointerType={Pointer.Right} onArrowClick={this._onArrowClick} />
      </div>
    );
  }

  private _handleCellHoverChange = (vect: Vector3d, state: CubeHover) => {
    const hoverMap = this.state.hoverMap;
    hoverMap[`${vect.x}-${vect.y}-${vect.z}`] = state;
    this.setState({ hoverMap });
  }

  private static _getMatrixFace = (rotMatrix: Matrix3d): Face => {
    if (!CubeNavigationAid._isMatrixFace(rotMatrix)) {
      return Face.None;
    }
    for (const face in cubeNavigationFaceRotations) {
      // istanbul ignore else
      if (face in cubeNavigationFaceRotations) {
        const loc = cubeNavigationFaceRotations[face];
        if (rotMatrix.isAlmostEqual(loc)) {
          return face as Face;
        }
      }
    }
    // matrix is in a non-standard rotation of face
    return Face.None;
  }

  private static _interpolateRotMatrix = (start: Matrix3d, anim: number, end: Matrix3d): Matrix3d => {
    if (anim === 0)
      return start;
    if (anim === 1 || start.isAlmostEqual(end))
      return end;
    const startInverse = start.transpose();
    const diff = end.multiplyMatrixMatrix(startInverse);
    const angleAxis = diff.getAxisAndAngleOfRotation();
    // istanbul ignore else
    if (angleAxis.ok) {
      const angle = Angle.createRadians(angleAxis.angle.radians * CubeNavigationAid._animationFn(anim));
      const newDiff = Matrix3d.createRotationAroundVector(angleAxis.axis, angle);
      // istanbul ignore else
      if (newDiff) {
        const newMatrix = newDiff.multiplyMatrixMatrix(start);
        return newMatrix;
      }
    }
    // istanbul ignore next
    return end;
  }

  private _onArrowClick = (arrow: Pointer) => {
    const localRotationAxis = Vector3d.create(0, 0, 0);
    switch (arrow) {
      case Pointer.Up:
        localRotationAxis.x = -1.0;
        break;
      case Pointer.Down:
        localRotationAxis.x = 1.0;
        break;
      case Pointer.Left:
        localRotationAxis.y = -1.0;
        break;
      default:
        localRotationAxis.y = 1.0;
        break;
    }
    const localRotation = Matrix3d.createRotationAroundVector(localRotationAxis, Angle.createDegrees(-90))!;
    const newRotation = localRotation.multiplyMatrixMatrix(this.state.endRotMatrix);
    const face = CubeNavigationAid._getMatrixFace(newRotation);
    this._animateRotation(newRotation, face);
    // const zRow = newRotation.rowZ();
    // const rotMatrix = Matrix3d.createRigidViewAxesZTowardsEye(zRow.x, zRow.y, zRow.z).transpose();
    // const face = CubeNavigationAid._getMatrixFace(rotMatrix);
    // this._animateRotation(this.state.endRotMatrix.clone(), rotMatrix, face);
  }

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
      this._setRotation(mat, CubeNavigationAid._getMatrixFace(mat));
      if (!this.state.dragging)
        this.setState({ dragging: true });
    }
    this._lastClientXY = mousePos;
  }

  private _handleBoxMouseDown = (event: any) => {
    event.preventDefault();
    // only start listening after drag is confirmed. Ie. the 3D box is clicked.
    window.addEventListener("mousemove", this._onMouseMove, false);
    window.addEventListener("mouseup", this._onMouseUp, false);
    this._lastClientXY = Vector2d.create(event.clientX, event.clientY);
    this._start = this._lastClientXY;
  }

  private _onMouseMove = (event: MouseEvent) => {
    const mousePos = Vector2d.create(event.clientX, event.clientY);
    this._processDrag(mousePos);
  }

  private _onMouseUp = () => {
    this.setState({ dragging: false });
    ViewportComponentEvents.setCubeMatrix(this.state.endRotMatrix, CubeNavigationAid._getMatrixFace(this.state.endRotMatrix), true);
    // remove so event only triggers after this.onMouseStartDrag
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

  private _handleBoxTouchStart = (event: any) => {
    if (1 !== event.targetTouches.length)
      return;
    window.addEventListener("touchmove", this._onTouchMove, false);
    window.addEventListener("touchend", this._onTouchEnd, false);
    this._lastClientXY = Vector2d.create(event.targetTouches[0].clientX, event.targetTouches[0].clientY);
    this._start = this._lastClientXY;
  }

  private _onTouchMove = (event: TouchEvent) => {
    if (1 !== event.targetTouches.length)
      return;
    const mousePos = Vector2d.create(event.targetTouches[0].clientX, event.targetTouches[0].clientY);
    this._processDrag(mousePos);
  }

  private _onTouchEnd = (event: TouchEvent) => {
    if (0 !== event.targetTouches.length)
      return;
    this.setState({ dragging: false });
    ViewportComponentEvents.setCubeMatrix(this.state.endRotMatrix, CubeNavigationAid._getMatrixFace(this.state.endRotMatrix), true);
    window.removeEventListener("touchmove", this._onTouchMove);
    window.removeEventListener("touchend", this._onTouchEnd);
  }

  private _handleFaceCellClick = (pos: Vector3d, face: Face) => {
    const { endRotMatrix } = this.state;
    let rotMatrix = Matrix3d.createRigidViewAxesZTowardsEye(pos.x, pos.y, pos.z).inverse();
    // istanbul ignore else
    if (rotMatrix) {
      // if isMatrixFace and user is clicking on top/bottom, the current matrix face must be top or bottom
      if (!CubeNavigationAid._isMatrixFace(endRotMatrix) && (face === Face.Top || face === Face.Bottom)) {
        const angleAxis = endRotMatrix.getAxisAndAngleOfRotation();
        // istanbul ignore else
        if (angleAxis.ok) {
          const xAx = endRotMatrix.columnX();
          const a = Math.atan2(xAx.y, xAx.x);
          const r = Math.round(a * 2 / Math.PI) * Math.PI / 2; // round to quarter turn intervals
          const rot = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(r));
          rotMatrix = rot.multiplyMatrixMatrix(rotMatrix);
        }
      }
      this._animateRotation(rotMatrix, face);
    }
    window.removeEventListener("mousemove", this._onMouseMove);
  }

  private _animateRotation = (endRotMatrix: Matrix3d, face: Face) => {
    if (this.state.endRotMatrix.isAlmostEqual(endRotMatrix))
      return;
    // set animation variables, let css transitions animate it.
    this._animationFrame = setTimeout(this._animation, 16.667);
    this.setState({
      startRotMatrix: this.state.endRotMatrix, endRotMatrix,
      animation: 0,
      face,
    });
  }

  private _setRotation = (endRotMatrix: Matrix3d, face: Face) => {
    ViewportComponentEvents.setCubeMatrix(endRotMatrix, face);
    // set variables, with animTime at 0 to prevent animation.
    this.setState({
      startRotMatrix: endRotMatrix,
      endRotMatrix,
      animation: 1,
      face,
    });
  }
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
  public render(): React.ReactNode {
    const { face, hoverMap, onFaceCellClick, onFaceCellHoverChange, label } = this.props;
    return (
      <div className="nav-cube-face" data-testid="nav-cube-face">
        {[-1, 0, 1].map((y: number) => {
          return (
            <FaceRow key={y} center={y === 0}>
              {[-1, 0, 1].map((x: number) => {
                return (
                  <FaceCell
                    key={x}
                    onFaceCellHoverChange={onFaceCellHoverChange}
                    onFaceCellClick={onFaceCellClick}
                    hoverMap={hoverMap}
                    vector={NavCubeFace.faceCellToPos(face, x, y)}
                    face={face}
                    center={x === 0}>
                    {x === 0 && y === 0 &&
                      label}
                  </FaceCell>
                );
              })}
            </FaceRow>
          );
        })}
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
  }
}

interface FaceRowProps extends React.AllHTMLAttributes<HTMLDivElement> {
  center?: boolean;
}

class FaceRow extends React.Component<FaceRowProps> {
  public render(): React.ReactNode {
    const { center, children, ...props } = this.props;
    return <div className={classnames("face-row", { center })} {...props}>{children}</div>;
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
  public render(): React.ReactNode {
    const { center, children, onFaceCellClick, onFaceCellHoverChange, hoverMap, face, vector, ...props } = this.props;
    const { x, y, z } = vector;
    const n = `${x}-${y}-${z}`;
    const hover = hoverMap[n] === CubeHover.Hover;
    const active = hoverMap[n] === CubeHover.Active;
    return <div
      onMouseDown={this._handleMouseDown}
      onMouseUp={this._handleMouseUp}
      onMouseOver={this._handleMouseOver}
      onMouseOut={this._handleMouseOut}
      data-testid={"nav-cube-face-cell-" + face + "-" + n}
      className={classnames("face-cell", { center, hover, active })}
      {...props}>{children}</div>;
  }
  private _handleMouseOver = () => {
    const { vector } = this.props;
    this.props.onFaceCellHoverChange(vector, CubeHover.Hover);
  }
  private _handleMouseOut = () => {
    const { vector } = this.props;
    this.props.onFaceCellHoverChange(vector, CubeHover.None);
  }
  private _handleMouseDown = (event: React.MouseEvent) => {
    const { vector } = this.props;
    const { clientX, clientY } = event;
    this._startMouse = Point2d.create(clientX, clientY);
    this.props.onFaceCellHoverChange(vector, CubeHover.Active);
  }
  private _handleMouseUp = (event: React.MouseEvent) => {
    const { vector, face } = this.props;
    const { clientX, clientY } = event;
    this.props.onFaceCellHoverChange(vector, CubeHover.None);
    const mouse = Point2d.create(clientX, clientY);
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

const pointerIconClass: { [key: number]: string } = {
  [Pointer.Up]: "icon-caret-down",
  [Pointer.Down]: "icon-caret-up",
  [Pointer.Left]: "icon-caret-right",
  [Pointer.Right]: "icon-caret-left",
};

const pointerClass: { [key: number]: string } = {
  [Pointer.Up]: "up",
  [Pointer.Down]: "down",
  [Pointer.Left]: "left",
  [Pointer.Right]: "right",
};

interface PointerProps extends React.AllHTMLAttributes<HTMLDivElement> {
  visible: boolean;
  pointerType: Pointer;
  onArrowClick(pointer: Pointer): void;
  ["data-testid"]?: string;
}

class PointerButton extends React.Component<PointerProps> {
  public render(): React.ReactNode {
    const { visible, pointerType, onArrowClick, ...props } = this.props;
    const classes = classnames(
      "cube-pointer", "icon",
      pointerClass[pointerType],
      pointerIconClass[pointerType],
      { visible },
    );
    return (
      <div className={classes} {...props}
        onClick={this._handleClick} />
    );
  }
  private _handleClick = (event: React.MouseEvent) => {
    const { pointerType } = this.props;
    event.preventDefault();
    this.props.onArrowClick(pointerType);
  }
}
