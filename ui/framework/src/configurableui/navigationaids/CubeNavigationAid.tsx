/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";

import { Cube, Face } from "@bentley/ui-core";
import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { NavigationAidControl } from "../NavigationAidControl";
import * as classnames from "classnames";
import { Geometry, Angle, AxisIndex, Matrix3d, Point3d, Point2d, YawPitchRollAngles } from "@bentley/geometry-core";

import "./CubeNavigationAid.scss";
import { UiFramework } from "../../UiFramework";

import { ViewportManager, ViewRotationChangeEventArgs } from "@bentley/ui-components";

/** NavigationAid that displays an interactive rotation cube that synchonizes with the rotation of the iModel Viewport */
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

export const faceLocations: { [key: number]: Point3d } = {
  [Face.Right]: Point3d.create(HitBoxX.Right, HitBoxY.None, HitBoxZ.None),
  [Face.Left]: Point3d.create(HitBoxX.Left, HitBoxY.None, HitBoxZ.None),
  [Face.Top]: Point3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Top),
  [Face.Bottom]: Point3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Bottom),
  [Face.Front]: Point3d.create(HitBoxX.None, HitBoxY.Front, HitBoxZ.None),
  [Face.Back]: Point3d.create(HitBoxX.None, HitBoxY.Back, HitBoxZ.None),
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
  currentFace: Face;
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
    currentFace: Face.Front,
    dragging: false,
    startRotMatrix: Matrix3d.createIdentity(),
    endRotMatrix: Matrix3d.createIdentity(),
    animation: 1,
    animationTime: 320,
    hoverMap: {},
  };

  public componentDidMount() {
    ViewportManager.ViewRotationChangeEvent.addListener(this._handleViewRotationChangeEvent);
    this._then = Date.now();
  }

  public componentWillUnmount() {
    ViewportManager.ViewRotationChangeEvent.removeListener(this._handleViewRotationChangeEvent);
  }

  // Synchronize with rotation coming from the Viewport
  private _handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const { animation, dragging, endRotMatrix } = this.state;
    const matrix = endRotMatrix;
    const newMatrix = args.rotMatrix;

    if (!matrix.isAlmostEqual(newMatrix) && animation >= 1 && !dragging) {
      this.setState({
        startRotMatrix: matrix, endRotMatrix: newMatrix,
        animation: 1,
        currentFace: Face.None,
      });
    }
  }

  private _animate = (timestamp: number) => {
    const delta = Math.max(timestamp - this._then, 0);
    this._then = timestamp;
    let { animation } = this.state;
    if (animation < 1.0)
      animation += delta / this.state.animationTime;
    if (animation > 1) {
      animation = 1;
      ViewportManager.setCubeMatrix3d(this.state.endRotMatrix, -1);
    } else
      requestAnimationFrame(this._animate);
    this.setState({ animation });
  }

  private static _easeInOut = (t: number) => {
    return -(Math.cos(t * Math.PI) - 1) / 2;
  }

  public render(): React.ReactNode {
    const { animation, currentFace, startRotMatrix, endRotMatrix } = this.state;
    const visible = currentFace !== Face.None && animation >= 1;
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
                  ViewportManager.setCubeMatrix3d(rotMatrix, 0);
                }
              }
            }
          }
        }
      }
    }

    const labels: {[key: number]: string} = {
      [Face.Right]: UiFramework.i18n.translate("UiFramework:cube.right"),
      [Face.Left]: UiFramework.i18n.translate("UiFramework:cube.left"),
      [Face.Back]: UiFramework.i18n.translate("UiFramework:cube.back"),
      [Face.Front]: UiFramework.i18n.translate("UiFramework:cube.front"),
      [Face.Top]: UiFramework.i18n.translate("UiFramework:cube.top"),
      [Face.Bottom]: UiFramework.i18n.translate("UiFramework:cube.bottom"),
    };

    const faces: {[key: string]: React.ReactNode} = {};
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
            onFaceCellHoverChange={this._handleCellHoverChange}/>
        );
      }
    }

    return (
      <div className={"cube-container"}
        onMouseDown={this._handleBoxClick} >
        <div className={"cube-element-container"}>
          <Cube
            className={classnames("nav-cube", {dragging: this.state.dragging})}
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

  private _handleCellHoverChange = (pos: Point3d, state: CubeHover) => {
    const hoverMap = this.state.hoverMap;
    hoverMap[pos.x + "|" + pos.y + "|" + pos.z] = state;
    this.setState({ hoverMap });
  }

  private _onArrowClick = (arrow: Pointer) => {
    const { currentFace, endRotMatrix } = this.state;
    let r = 0;
    const m = Matrix3d.createRigidFromMatrix3d(endRotMatrix);
    if (m) {
      const rot = YawPitchRollAngles.createFromMatrix3d(m);
      if (rot) {
        if (currentFace === Face.Top || currentFace === Face.Bottom) {
          r = rot.yaw.radians;
        }
      }
    }
    r = Math.round(Angle.adjustRadiansMinusPiPlusPi(r) * 2 / Math.PI); // regularize to 90deg = 1 etc.
    const direction = rotateRouteByIndex(routes[currentFace], r);
    let faceTo: Face = Face.None;

    // map different directions to particular rotation orientations
    switch (arrow) {
      case Pointer.Up:
        faceTo = direction.up;
        break;
      case Pointer.Down:
        faceTo = direction.down;
        break;
      case Pointer.Left:
        faceTo = direction.left;
        break;
      case Pointer.Right:
        faceTo = direction.right;
        break;
    }
    if (faceTo !== Face.None) {
      // map different directions to particular rotation orientations
      const pos = faceLocations[faceTo];
      let rotMatrix = Matrix3d.createRigidViewAxesZTowardsEye(pos.x, pos.y, pos.z).inverse();
      if (rotMatrix) {
        const startRotMatrix = endRotMatrix.clone();
        if (faceTo === Face.Top || faceTo === Face.Bottom) {
          const m2 = Matrix3d.createRigidFromMatrix3d(endRotMatrix);
          if (m2) {
            const rot = YawPitchRollAngles.createFromMatrix3d(m2);
            if (rot) {
              let r2 = 0;
              if (faceTo === Face.Top) {
                r2 = rot.yaw.radians;
              } else {
                r2 = -rot.yaw.radians;
              }
              r2 = Math.round(Angle.adjustRadiansMinusPiPlusPi(r2) * 2 / Math.PI) * Math.PI / 2; // round to quarter turn intervals
              const rotate = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(r2));
              if (rotate)
                rotMatrix = rotate.multiplyMatrixMatrix(rotMatrix);
            }
          }
        }
        this._animateRotation(startRotMatrix, rotMatrix, 320, faceTo);
      }
    }
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

  private _handleFaceCellClick = (pos: Point3d, face: Face = Face.None) => {
    const { currentFace, endRotMatrix } = this.state;
    let rotMatrix = Matrix3d.createRigidViewAxesZTowardsEye(pos.x, pos.y, pos.z).inverse();
    if (rotMatrix) {
      if (currentFace !== face && (face === Face.Top || face === Face.Bottom)) {
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
      this._animateRotation(endRotMatrix, rotMatrix, 320, face);
    }
    window.removeEventListener("mousemove", this._onMouseDrag);
  }

  private _animateRotation = (startRotMatrix: Matrix3d, endRotMatrix: Matrix3d, animationTime: number, currentFace: Face = Face.None) => {
    // set animation variables, let css transitions animate it.
    ViewportManager.setCubeMatrix3d(startRotMatrix, 0);
    this._then = Date.now();
    requestAnimationFrame(this._animate);
    this.setState({
      startRotMatrix, endRotMatrix,
      animation: 0, animationTime,
      currentFace, // only set visible when currentFace is an actual face
    });
  }
  private _setRotation = (endRotMatrix: Matrix3d, startRotMatrix?: Matrix3d, currentFace: Face = Face.None) => {
    ViewportManager.setCubeMatrix3d(endRotMatrix, 0);
    // set variables, with animTime at 0 to prevent animation.
    this.setState({
      startRotMatrix: startRotMatrix || endRotMatrix,
      endRotMatrix,
      animation: 1,
      currentFace, // only set visible when currentFace is an actual face
    });
  }
}

export interface NavCubeFaceProps extends React.AllHTMLAttributes<HTMLDivElement> {
  face: Face;
  label: string;
  hoverMap: { [key: string]: CubeHover };
  onFaceCellClick: (position: Point3d, face?: Face) => void;
  onFaceCellHoverChange: (position: Point3d, state: CubeHover) => void;
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
                    position={NavCubeFace.faceCellToPos(face, x, y)}
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
    const facePos = faceLocations[face];
    const route = routes[face];

    const faceX = x < 0 ? route.left : x > 0 ? route.right : Face.None;
    const xPoint = faceX !== Face.None ? faceLocations[faceX] : Point3d.createZero();

    const faceY = y < 0 ? route.up : y > 0 ? route.down : Face.None;
    const yPoint = faceY !== Face.None ? faceLocations[faceY] : Point3d.createZero();

    const position = facePos.plus(xPoint).plus(yPoint);
    // const newFace = faceX === Face.None && faceY === Face.None ? this.props.face : Face.None;
    return position;
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

export interface FaceCellProps extends React.AllHTMLAttributes<HTMLDivElement> {
  center?: boolean;
  onFaceCellClick: (position: Point3d, face?: Face) => void;
  onFaceCellHoverChange: (position: Point3d, state: CubeHover) => void;
  hoverMap: { [key: string]: CubeHover };
  position: Point3d;
  face?: Face;
}

export class FaceCell extends React.Component<FaceCellProps> {
  private _startMouse: Point2d | undefined;
  public render(): React.ReactNode {
    const { center, children, onFaceCellClick, onFaceCellHoverChange, hoverMap, face, position, ...props } = this.props;
    const { x, y, z } = position;
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
    const { position } = this.props;
    this.props.onFaceCellHoverChange(position, CubeHover.Hover);
  }
  private _handleMouseOut = () => {
    const { position } = this.props;
    this.props.onFaceCellHoverChange(position, CubeHover.None);
  }
  private _handleMouseDown = (event: React.MouseEvent) => {
    const { position } = this.props;
    const { clientX, clientY } = event;
    this._startMouse = Point2d.create(clientX, clientY);
    this.props.onFaceCellHoverChange(position, CubeHover.Active);
  }
  private _handleMouseUp = (event: React.MouseEvent) => {
    const { position, face } = this.props;
    const { clientX, clientY } = event;
    this.props.onFaceCellHoverChange(position, CubeHover.None);
    const mouse = Point2d.create(clientX, clientY);
    if (this._startMouse && this._startMouse.isAlmostEqual(mouse))
      this.props.onFaceCellClick(position, face);
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
