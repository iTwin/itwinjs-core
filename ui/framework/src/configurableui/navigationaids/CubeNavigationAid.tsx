/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";

import { Cube, Face } from "@bentley/ui-core";
import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { NavigationAidControl } from "../NavigationAidControl";
import * as classnames from "classnames";
import { Geometry, Angle, AxisIndex, Matrix3d, Point2d, YawPitchRollAngles, Vector3d } from "@bentley/geometry-core";

import "./CubeNavigationAid.scss";
import { UiFramework } from "../../UiFramework";

import { ViewRotationChangeEventArgs, ViewRotationCube } from "@bentley/ui-components";

/** NavigationAid that displays an interactive rotation cube that synchronizes with the rotation of the iModel Viewport */
export class CubeNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <CubeNavigationAid />;
  }
  public getSize(): string | undefined { return "96px"; }
}

export enum HitBoxX {
  None = 0,
  Right = 1,
  Left = -1,
}
export enum HitBoxY {
  None = 0,
  Back = 1,
  Front = -1,
}
export enum HitBoxZ {
  None = 0,
  Top = 1,
  Bottom = -1,
}

export interface RotationMap {
  up: Face;
  down: Face;
  left: Face;
  right: Face;
}

export const faceLocations: { [key: number]: Vector3d } = {
  [Face.Right]: Vector3d.create(HitBoxX.Right, HitBoxY.None, HitBoxZ.None),
  [Face.Left]: Vector3d.create(HitBoxX.Left, HitBoxY.None, HitBoxZ.None),
  [Face.Top]: Vector3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Top),
  [Face.Bottom]: Vector3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Bottom),
  [Face.Front]: Vector3d.create(HitBoxX.None, HitBoxY.Front, HitBoxZ.None),
  [Face.Back]: Vector3d.create(HitBoxX.None, HitBoxY.Back, HitBoxZ.None),
};

// data relating Up/Down/Left/Right directions relative to every surface
export const routes: { [key: number]: RotationMap } = {
  [Face.Front]: { up: Face.Top, down: Face.Bottom, left: Face.Left, right: Face.Right },
  [Face.Back]: { up: Face.Top, down: Face.Bottom, left: Face.Right, right: Face.Left },
  [Face.Top]: { up: Face.Back, down: Face.Front, left: Face.Left, right: Face.Right },
  [Face.Bottom]: { up: Face.Front, down: Face.Back, left: Face.Left, right: Face.Right },
  [Face.Right]: { up: Face.Top, down: Face.Bottom, left: Face.Front, right: Face.Back },
  [Face.Left]: { up: Face.Top, down: Face.Bottom, left: Face.Back, right: Face.Front },
};

/**
 * Rotates RotationMap object 90 degrees for every index increment.
 * 0 = 0deg, 1 = 90deg, 2 = 180deg, -1 = -90deg, etc.
 */
export const rotateRouteByIndex = (route: RotationMap, index: number): RotationMap => {
  const { up, right, down, left } = route;
  const a = [up, right, down, left];
  const l = a.length;
  return {
    up: a[Geometry.modulo(0 + index, l)],
    right: a[Geometry.modulo(1 + index, l)],
    down: a[Geometry.modulo(2 + index, l)],
    left: a[Geometry.modulo(3 + index, l)],
  };
};

export enum CubeHover {
  None = 0,
  Hover,
  Active,
}

export interface CubeNavigationState {
  dragging: boolean;
  startRotMatrix: Matrix3d;
  endRotMatrix: Matrix3d;
  animation: number;
  animationTime: number;
  hoverMap: { [key: string]: CubeHover };
}

/** A Cube Navigation Aid */
export class CubeNavigationAid extends React.Component<{}, CubeNavigationState> {
  private _start: Point2d = Point2d.createZero();
  private _then: number = 0;
  public readonly state: Readonly<CubeNavigationState> = {
    dragging: false,
    startRotMatrix: Matrix3d.createIdentity(),
    endRotMatrix: Matrix3d.createIdentity(),
    animation: 1,
    animationTime: 320,
    hoverMap: {},
  };

  public componentDidMount() {
    ViewRotationCube.viewRotationChangeEvent.addListener(this._handleViewRotationChangeEvent);
    this._then = Date.now();
  }

  public componentWillUnmount() {
    ViewRotationCube.viewRotationChangeEvent.removeListener(this._handleViewRotationChangeEvent);
  }

  // Synchronize with rotation coming from the Viewport
  private _handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const { animation, dragging, endRotMatrix } = this.state;
    const matrix = endRotMatrix;
    const newMatrix = args.viewport.rotation;

    if (!matrix.isAlmostEqual(newMatrix) && animation >= 1 && !dragging)
      this.setState({ startRotMatrix: matrix, endRotMatrix: newMatrix, animation: 1 });
  }

  private _animate = (timestamp: number) => {
    const delta = Math.max(timestamp - this._then, 0);
    this._then = timestamp;
    let { animation } = this.state;
    if (animation < 1.0)
      animation += delta / this.state.animationTime;
    if (animation > 1) {
      animation = 1;
      ViewRotationCube.setCubeMatrix(this.state.endRotMatrix, -1);
    } else
      requestAnimationFrame(this._animate);
    this.setState({ animation });
  }

  private static _easeInOut = (t: number) => {
    return -(Math.cos(t * Math.PI) - 1) / 2;
  }

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
    const visible = CubeNavigationAid._isMatrixFace(endRotMatrix) && animation >= 1.0;
    let rotMatrix = endRotMatrix;
    if (animation < 1.0) {
      if (!rotMatrix.isAlmostEqual(startRotMatrix)) {
        const startInverse = startRotMatrix.inverse();
        if (startInverse) {
          const diff = endRotMatrix.multiplyMatrixMatrix(startInverse);
          if (diff) {
            const angleAxis = diff.getAxisAndAngleOfRotation();
            if (angleAxis.ok) {
              const angle = Angle.createRadians(angleAxis.angle.radians * CubeNavigationAid._easeInOut(animation));
              const newDiff = Matrix3d.createRotationAroundVector(angleAxis.axis, angle);
              if (newDiff) {
                const newMatrix = newDiff.multiplyMatrixMatrix(startRotMatrix);
                if (newMatrix) {
                  rotMatrix = newMatrix;
                  ViewRotationCube.setCubeMatrix(rotMatrix, 0);
                }
              }
            }
          }
        }
      }
    }

    const labels: { [key: number]: string } = {
      [Face.Right]: UiFramework.i18n.translate("UiFramework:cube.right"),
      [Face.Left]: UiFramework.i18n.translate("UiFramework:cube.left"),
      [Face.Back]: UiFramework.i18n.translate("UiFramework:cube.back"),
      [Face.Front]: UiFramework.i18n.translate("UiFramework:cube.front"),
      [Face.Top]: UiFramework.i18n.translate("UiFramework:cube.top"),
      [Face.Bottom]: UiFramework.i18n.translate("UiFramework:cube.bottom"),
    };

    const faces: { [key: string]: React.ReactNode } = {};
    for (const key in labels) {
      if (labels.hasOwnProperty(key)) {
        const f = parseInt(key, 10) as Face;
        const label = labels[f];
        faces[f] = (
          <NavCubeFace
            face={f}
            label={label}
            hoverMap={this.state.hoverMap}
            onFaceCellClick={this._handleFaceCellClick}
            onFaceCellHoverChange={this._handleCellHoverChange} />
        );
      }
    }

    return (
      <div className={"cube-container"}
        onMouseDown={this._handleBoxClick} >
        <div className={"cube-element-container"}>
          <Cube
            className={classnames("nav-cube", { dragging: this.state.dragging })}
            rotMatrix={rotMatrix}
            faces={faces} />
        </div>
        <PointerButton visible={visible} pointerType={Pointer.Up} onArrowClick={this._onArrowClick} />
        <PointerButton visible={visible} pointerType={Pointer.Down} onArrowClick={this._onArrowClick} />
        <PointerButton visible={visible} pointerType={Pointer.Left} onArrowClick={this._onArrowClick} />
        <PointerButton visible={visible} pointerType={Pointer.Right} onArrowClick={this._onArrowClick} />
      </div>
    );
  }

  private _handleCellHoverChange = (vect: Vector3d, state: CubeHover) => {
    const hoverMap = this.state.hoverMap;
    hoverMap[vect.x + "|" + vect.y + "|" + vect.z] = state;
    this.setState({ hoverMap });
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
    this._animateRotation(this.state.endRotMatrix, newRotation, this.state.animationTime);
  }

  private _handleBoxClick = (event: any) => {
    event.preventDefault();
    const { endRotMatrix } = this.state;

    // only start listening after drag is confirmed. Ie. the 3D box is clicked.
    window.addEventListener("mousemove", this._onMouseDrag, false);
    window.addEventListener("mouseup", this._onMouseStopDrag, false);

    this._start.x = event.clientX;
    this._start.y = event.clientY;

    this.setState({ startRotMatrix: endRotMatrix });
  }

  private _onMouseDrag = (event: any) => {
    if (this._start.x !== event.clientX || this._start.y !== event.clientY) {
      const scale = 0.05;

      const yaw = Angle.createRadians(-(this._start.x - event.clientX) * scale);
      const pitch = Angle.createRadians(-(this._start.y - event.clientY) * scale);

      const matX = Matrix3d.createRotationAroundAxisIndex(AxisIndex.X, pitch);
      const matZ = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, yaw);

      let mat = this.state.startRotMatrix;
      if (matX && matZ)
        mat = matX.multiplyMatrixMatrix(mat).multiplyMatrixMatrix(matZ);
      this._setRotation(mat, this.state.startRotMatrix);
      if (!this.state.dragging)
        this.setState({ dragging: true });
    }
  }

  private _onMouseStopDrag = () => {
    this.setState({ dragging: false });
    // remove so event only triggers after this.on this.onMousStartDrag
    window.removeEventListener("mousemove", this._onMouseDrag);
    window.removeEventListener("mouseup", this._onMouseStopDrag);
  }

  private _handleFaceCellClick = (pos: Vector3d, face: Face = Face.None) => {
    const { endRotMatrix } = this.state;
    let rotMatrix = Matrix3d.createRigidViewAxesZTowardsEye(pos.x, pos.y, pos.z).inverse();
    if (rotMatrix) {
      const currentZ = rotMatrix.rowZ();

      if (!CubeNavigationAid._isMatrixFace(endRotMatrix) && (currentZ.isAlmostEqualXYZ(0, 0, 1) || currentZ.isAlmostEqualXYZ(0, 0, -1))) {
        const m = Matrix3d.createRigidFromMatrix3d(this.state.endRotMatrix);
        if (m) {
          const rot = YawPitchRollAngles.createFromMatrix3d(m);
          if (rot) {
            let r = 0;
            if (face === Face.Top) {
              r = rot.yaw.radians;
            } else {
              r = -rot.yaw.radians;
            }
            r = Math.round(Angle.adjustRadiansMinusPiPlusPi(r) * 2 / Math.PI) * Math.PI / 2; // round to quarter turn intervals
            const rotate = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(r));
            if (rotate)
              rotMatrix = rotate.multiplyMatrixMatrix(rotMatrix);
          }
        }
      }
      this._animateRotation(endRotMatrix, rotMatrix, 320);
    }
    window.removeEventListener("mousemove", this._onMouseDrag);
  }

  private _animateRotation = (startRotMatrix: Matrix3d, endRotMatrix: Matrix3d, animationTime: number) => {
    // set animation variables, let css transitions animate it.
    ViewRotationCube.setCubeMatrix(startRotMatrix, 0);
    this._then = Date.now();
    requestAnimationFrame(this._animate);
    this.setState({
      startRotMatrix, endRotMatrix,
      animation: 0, animationTime,
    });
  }
  private _setRotation = (endRotMatrix: Matrix3d, startRotMatrix?: Matrix3d) => {
    ViewRotationCube.setCubeMatrix(endRotMatrix, 0);
    // set variables, with animTime at 0 to prevent animation.
    this.setState({
      startRotMatrix: startRotMatrix || endRotMatrix,
      endRotMatrix,
      animation: 1,
    });
  }
}

export interface NavCubeFaceProps extends React.AllHTMLAttributes<HTMLDivElement> {
  face: Face;
  label: string;
  hoverMap: { [key: string]: CubeHover };
  onFaceCellClick: (vector: Vector3d, face?: Face) => void;
  onFaceCellHoverChange: (vector: Vector3d, state: CubeHover) => void;
}

export class NavCubeFace extends React.Component<NavCubeFaceProps> {
  public render(): React.ReactNode {
    const { face, hoverMap, onFaceCellClick, onFaceCellHoverChange, label } = this.props;
    return (
      <div className="nav-cube-face">
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
                    face={(x === 0 && y === 0 && face) || Face.None}
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
    const faceVect = faceLocations[face];
    const route = routes[face];

    const faceX = x < 0 ? route.left : x > 0 ? route.right : Face.None;
    const xVect = faceX !== Face.None ? faceLocations[faceX] : Vector3d.createZero();

    const faceY = y < 0 ? route.up : y > 0 ? route.down : Face.None;
    const yVect = faceY !== Face.None ? faceLocations[faceY] : Vector3d.createZero();

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

/** Properties for the [[FaceCell]] component. */
export interface FaceCellProps extends React.AllHTMLAttributes<HTMLDivElement> {
  center?: boolean;
  onFaceCellClick: (vector: Vector3d, face?: Face) => void;
  onFaceCellHoverChange: (vector: Vector3d, state: CubeHover) => void;
  hoverMap: { [key: string]: CubeHover };
  vector: Vector3d;
  face?: Face;
}

/** FaceCell React component. */
export class FaceCell extends React.Component<FaceCellProps> {
  private _startMouse: Point2d | undefined;
  public render(): React.ReactNode {
    const { center, children, onFaceCellClick, onFaceCellHoverChange, hoverMap, face, vector, ...props } = this.props;
    const { x, y, z } = vector;
    const hover = hoverMap[x + "|" + y + "|" + z] === CubeHover.Hover;
    const active = hoverMap[x + "|" + y + "|" + z] === CubeHover.Active;
    return <div
      onMouseDown={this._handleMouseDown}
      onMouseUp={this._handleMouseUp}
      onMouseOver={this._handleMouseOver}
      onMouseOut={this._handleMouseOut}
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
    if (this._startMouse && this._startMouse.isAlmostEqual(mouse))
      this.props.onFaceCellClick(vector, face);
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
