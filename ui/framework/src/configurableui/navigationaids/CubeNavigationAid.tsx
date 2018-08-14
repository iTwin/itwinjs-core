/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { NavigationAidControl } from "../NavigationAidControl";
import * as classnames from "classnames";
import { Geometry, RotMatrix, Point3d, Point2d, Angle, YawPitchRollAngles } from "@bentley/geometry-core";

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
  Left = 1,
  Right = 2,
}
export enum HitBoxY {
  None = 0,
  Top = 1,
  Bottom = 2,
}
export enum HitBoxZ {
  None = 0,
  Front = 1,
  Back = 2,
}

export enum Face {
    None = 0,
    Left,
    Right,
    Back,
    Front,
    Bottom,
    Top,
}

interface RotationMap {
  up: Face;
  down: Face;
  left: Face;
  right: Face;
}
const faceLocations: {[key: number]: Point3d} = {
  [Face.Right]: Point3d.create(HitBoxX.Right, HitBoxY.None, HitBoxZ.None),
  [Face.Left]: Point3d.create(HitBoxX.Left, HitBoxY.None, HitBoxZ.None),
  [Face.Top]: Point3d.create(HitBoxX.None, HitBoxY.Top, HitBoxZ.None),
  [Face.Bottom]: Point3d.create(HitBoxX.None, HitBoxY.Bottom, HitBoxZ.None),
  [Face.Front]: Point3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Front),
  [Face.Back]: Point3d.create(HitBoxX.None, HitBoxY.None, HitBoxZ.Back),
};

// data relating Up/Down/Left/Right directions relative to every surface
const routes: {[key: number]: RotationMap} = {
  [Face.Front]: { up: Face.Top, down: Face.Bottom, left: Face.Left, right: Face.Right },
  [Face.Back]: { up: Face.Top, down: Face.Bottom, left: Face.Right, right: Face.Left },
  [Face.Top]: { up: Face.Back, down: Face.Front, left: Face.Left, right: Face.Right },
  [Face.Bottom]: { up: Face.Front, down: Face.Back, left: Face.Left, right: Face.Right },
  [Face.Right]: { up: Face.Top, down: Face.Bottom, left: Face.Front, right: Face.Back },
  [Face.Left]: { up: Face.Top, down: Face.Bottom, left: Face.Back, right: Face.Front },
};
export interface CubeNavigationState {
  currentFace: Face;
  dragging: boolean;
  rotation: YawPitchRollAngles;
  startRot: YawPitchRollAngles;
  animTime: number;
}

/** A Cube Navigation Aid */
export class CubeNavigationAid extends React.Component<{}, CubeNavigationState> {

  public static loopMs = 10;
  private start: Point2d = Point2d.createZero();

  public readonly state: Readonly<CubeNavigationState> = {
    currentFace: Face.Front,
    dragging: false,
    rotation: YawPitchRollAngles.createRadians(0, 0, 0),
    startRot: YawPitchRollAngles.createRadians(0, 0, 0),
    animTime: 0,
  };

  public ComponentDidMount() {
    ViewportManager.ViewRotationChangeEvent.addListener(this.handleViewRotationChangeEvent);
  }

  public componentWillUnmount() {
    ViewportManager.ViewRotationChangeEvent.removeListener(this.handleViewRotationChangeEvent);
  }

  /** Converts from threeJS Euler angles to iModelJS YawPitchRollAngles */
  public static cubeToIModelJS = (a: YawPitchRollAngles) => {
    return YawPitchRollAngles.createRadians(-a.yaw.radians, -a.pitch.radians + Math.PI / 2, 0);
  }

  /** Converts from iModelJS YawPitchRollAngles to threeJS Euler angles */
  public static iModelJSToCube = (a: YawPitchRollAngles) => {
    return YawPitchRollAngles.createRadians(a.yaw.radians, -a.pitch.radians - Math.PI / 2, 0);
  }

  // Synchronize with rotation coming from the Viewport
  private handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const v = CubeNavigationAid.iModelJSToCube(args.rotation);
    const c = this.state.rotation;

    if (!v.isAlmostEqual(c) && this.state.animTime === 0 && !this.state.dragging) {
      this.setState({
        startRot: v, rotation: v,
        currentFace: Face.None,
      });
    }
  }

  public render(): React.ReactNode {
    const visible = this.state.currentFace !== Face.None && this.state.animTime === 0;
    return (
      <div className={"cube-container"}
        onMouseDown={this.handleBoxClick} >
        <div className={"cube-element-container"}>
          <Cube
            dragging={this.state.dragging}
            rotation={this.state.rotation}
            onFaceCellClick={this.handleFaceCellClick}
            onTransitionEnd={this.handleTransitionEnd}
            onRotationTransitionUpdate={this.handleRotationTransitionUpdate}
            animTime={this.state.animTime}
            animInterval={CubeNavigationAid.loopMs}/>
        </div>
        <PointerButton visible={visible} pointerType={Pointer.Up} onArrowClick={this.onArrowClick} />
        <PointerButton visible={visible} pointerType={Pointer.Down} onArrowClick={this.onArrowClick} />
        <PointerButton visible={visible} pointerType={Pointer.Left} onArrowClick={this.onArrowClick} />
        <PointerButton visible={visible} pointerType={Pointer.Right} onArrowClick={this.onArrowClick} />
      </div>
    );
  }

  private posToRot = (point: Point3d) => { // Determine rotation for a given rotation
    const m = [0, 1, -1]; // map enum indices into [-1, 0, 1] values
    const x = m[point.x], y = m[point.y], z = m[point.z];
    const p = YawPitchRollAngles.createRadians(0, 0, 0);
    let n = 0;
    if (x) n++;
    if (y) n++;
    if (z) n++;
    if (n >= 1) {
      switch (n) {
        case 1: // 1 face connection, must be face
          if (x)
            p.yaw.setRadians(x * Math.PI / 2);
          if (y)
            p.pitch.setRadians(y * Math.PI / 2);
          if (z) // 0 when z = 1, pi when z = -1
            p.yaw.setRadians((z - 1) * Math.PI / 2);
          break;
        case 2: // 2 face connection, must be edge
          p.pitch.setRadians(y * Math.PI / 4);
          if (x) // x must be non-zero to determine angle sign for [-pi, pi] angle
            p.yaw.setRadians(x * (2 - z) * Math.PI / 4);
          else // else, use same yaw as front/back (z) configuration
            p.yaw.setRadians((z - 1) * Math.PI / 2);
          break;
        case 3: // 3 face connection, must be corner
          // pitch = +/- pi/5, depending on top/bottom corner location.
          // use pi/5 instead of pi/4 because it visually looks better for corners.
          p.pitch.setRadians(y * Math.PI / 5);
          // x(left/right) determines angle sign.
          // (2 - z)pi/4 translates to pi/2 +/- pi/4;
          // Start at 90deg either side(according to left/right), add or subtract 45deg(according to front/back)
          p.yaw.setRadians(x * (2 - z) * Math.PI / 4);
          break;
      }
    }
    return p;
  }

  /**
   * Rotates RotationMap object 90 degrees for every index increment.
   * 0 = 0deg, 1 = 90deg, 2 = 180deg, -1 = -90deg, etc.
   */
  private static indexRotateRoute = (route: RotationMap, index: number): RotationMap => {
    const {up, right, down, left} = route;
    const a = [up, right, down, left];
    const l = a.length;
    return {
      up:    a[Geometry.modulo(0 + index, l)],
      right: a[Geometry.modulo(1 + index, l)],
      down:  a[Geometry.modulo(2 + index, l)],
      left:  a[Geometry.modulo(3 + index, l)],
    };
  }

  private onArrowClick = (arrow: Pointer) => {
    // integer value representing integer orientations. Finds closest orientation to allow for slight rounding errors in this.state.rotation.y
    let r = 0;
    if (this.state.currentFace === Face.Top)
      r = this.state.rotation.yaw.radians;
    if (this.state.currentFace === Face.Bottom)
      r = -this.state.rotation.yaw.radians;
    r = Math.round(Angle.adjustRadiansMinusPiPlusPi(r) * 2 / Math.PI); // regularize to 90deg = 1 etc.

    const direction = CubeNavigationAid.indexRotateRoute(routes[this.state.currentFace], r);
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
      const pos = faceLocations[faceTo];
      let rot = this.posToRot(pos);

      const startRot = this.state.rotation.clone();
      const {rotation} = this.state;

      if (faceTo === Face.Top || faceTo === Face.Bottom) {
        const yaw = Math.round(rotation.yaw.radians / (Math.PI / 2)) * (Math.PI / 2);
        const pitch = rot.pitch.radians;
        rot = YawPitchRollAngles.createRadians(yaw, pitch, 0);
      } else {
        const yaw = rotation.yaw.radians;
        const yawDiff = Angle.adjustRadiansMinusPiPlusPi(rot.yaw.radians - yaw);
        const pitch = rot.pitch.radians;
        rot = YawPitchRollAngles.createRadians(yaw + yawDiff, pitch, 0);
      }
      this.animateRotation(500, startRot, rot, faceTo);
    }
  }

  private handleBoxClick = (event: any) => {
    event.preventDefault();

    // only start listening after drag is confirmed. Ie. the 3D box is clicked.
    window.addEventListener("mousemove", this.onMouseDrag, false);
    window.addEventListener("mouseup", this.onMouseStopDrag, false);

    this.start.x = event.clientX;
    this.start.y = event.clientY;

    const rot = this.state.rotation.clone();
    this.setState({
      startRot: rot,
    });
  }

  private onMouseDrag = (event: any) => {
    if (this.start.x !== event.clientX || this.start.y !== event.clientY) {
      const scale = 0.05;

      const yaw = this.state.startRot.yaw.radians - (this.start.x - event.clientX) * scale;
      const pitch = Geometry.clampToStartEnd(
        this.state.startRot.pitch.radians - (this.start.y - event.clientY) * scale,
        -Math.PI / 2, Math.PI / 2);

      const rot = YawPitchRollAngles.createRadians(yaw, pitch, 0);

      this.setRotation(rot, this.state.startRot);
      if (!this.state.dragging)
        this.setState({dragging: true});
    }
  }

  private onMouseStopDrag = () => {
    this.setState({ dragging: false });
    // remove so event only triggers after this.on this.onMousStartDrag
    window.removeEventListener("mousemove", this.onMouseDrag);
    window.removeEventListener("mouseup", this.onMouseStopDrag);
  }

  private handleFaceCellClick = (pos: Point3d, face: Face = Face.None) => {
    const {rotation} = this.state;
    let rot = this.posToRot(pos);

    const startRot = this.state.rotation.clone();
    if ((face === Face.Top || face === Face.Bottom) && Geometry.modulo(rotation.yaw.radians, Math.PI / 2) !== 0) {
      const yaw = Math.round(rotation.yaw.radians / (Math.PI / 2)) * (Math.PI / 2);
      const pitch = rot.pitch.radians;
      rot = YawPitchRollAngles.createRadians(yaw, pitch, 0);
    } else {
      const yaw = rotation.yaw.radians;
      const yawDiff = Angle.adjustRadiansMinusPiPlusPi(rot.yaw.radians - yaw);
      const pitch = rot.pitch.radians;
      rot = YawPitchRollAngles.createRadians(yaw + yawDiff, pitch, 0);
    }
    this.animateRotation(500, startRot, rot, face);
    window.removeEventListener("mousemove", this.onMouseDrag);
  }

  private handleTransitionEnd = () => {
    this.setState({animTime: 0});
  }

  private handleRotationTransitionUpdate = (rotation: YawPitchRollAngles) => {
    ViewportManager.setCubeRotation(CubeNavigationAid.cubeToIModelJS(rotation));
  }

  private animateRotation = (animTime: number, startRot: YawPitchRollAngles, rotation: YawPitchRollAngles, currentFace: Face = Face.None) => {
    const time = rotation.isAlmostEqual(this.state.rotation) ? 0 : animTime;
    // set animation variables, let css transitions animate it.
    this.setState({
      startRot, rotation,
      animTime: time,
      currentFace, // only set visible when currentFace is an actual face
    });
  }
  private setRotation = (rot: YawPitchRollAngles, startRot?: YawPitchRollAngles, currentFace: Face = Face.None) => {
    ViewportManager.setCubeRotation(CubeNavigationAid.cubeToIModelJS(rot));
    // set variables, with animTime at 0 to prevent animation.
    this.setState({
      startRot: startRot || rot, rotation: rot,
      animTime: 0,
      currentFace, // only set visible when currentFace is an actual face
    });
  }
}

interface CubeProps extends React.AllHTMLAttributes<HTMLDivElement> {
  dragging: boolean;
  rotation: YawPitchRollAngles;
  onFaceCellClick: (position: Point3d, face?: Face) => void;
  onRotationTransitionUpdate: (rotation: YawPitchRollAngles) => void;
  animTime: number;
  animInterval: number;
}

enum Hover {
  None = 0,
  Hover,
  Active,
}

interface CubeState {
  hoverMap: {[key: string]: Hover};
}

class Cube extends React.Component<CubeProps, CubeState> {
  private frontComputedStyle: CSSStyleDeclaration | undefined;
  private timer: any = null;
  public readonly state: CubeState = {
    hoverMap: {},
  };
  public render(): React.ReactNode {
    const {dragging, rotation, onFaceCellClick, onRotationTransitionUpdate, animTime, animInterval, ...props} = this.props;
    const {hoverMap} = this.state;
    const animationStyle: React.CSSProperties = {
      transition: `${this.props.animTime}ms`,
    };
    return (
      <div className={classnames("cube-nav-cube", {dragging})} style={animationStyle} {...props}>
        {[Face.Front, Face.Back, Face.Right, Face.Left, Face.Top, Face.Bottom]
        .map((face: Face) => {
          const ref = face === Face.Front ? (el: CubeFace) => {
            const div = ReactDOM.findDOMNode(el) as HTMLDivElement;
            if (div instanceof HTMLDivElement) {
              const computedStyle = window.getComputedStyle(div);
              if (computedStyle instanceof CSSStyleDeclaration) {
                this.frontComputedStyle = computedStyle;
              }
            }
          } : undefined;
          const onTransitionEnd = face === Face.Front ? this.handleTransitionEnd : undefined;
          return (
            <CubeFace
              key={face}
              rotation={rotation}
              onFaceCellClick={onFaceCellClick}
              onFaceCellHoverChange={this.handleCellHoverChange}
              onTransitionEnd={onTransitionEnd}
              hoverMap={hoverMap}
              ref={ref}
              face={face} />
          );
        })}
      </div>
    );
  }

  public componentDidUpdate(prevProps: CubeProps) {
    if (prevProps.animTime !== this.props.animTime && this.props.animTime > 0) {
      this.timer = setInterval(this.rotationUpdate, this.props.animInterval);
    }
  }

  public handleTransitionEnd = () => {
    clearInterval(this.timer);
    this.rotationUpdate();
  }

  private static parse3DMatrix = (matrix: string) => {
    const out: number[] = [];
    if (/matrix3d/.test(matrix)) {
      const str = matrix.substring(8); // length of "matrix3d".
      const mat = str.match(/[-+]?\d*\.?\d+/g); // Match only valid floats
      if (mat)
        for (const n of mat)
          out.push(parseFloat(n));
    }
    return out;
  }

  private rotationUpdate = () => {
    if (this.frontComputedStyle !== undefined && this.frontComputedStyle.transform !== null) {
      const transform = this.frontComputedStyle.transform;
      const v = Cube.parse3DMatrix(transform);
      if (v.length > 0) {
        // Extract rotMatrix from transformation matrix
        const matrix = RotMatrix.createRowValues(
          v[0], v[1], v[2],
          v[8], v[9], v[10],
          v[4], v[5], v[6],
        );
        const rotation = YawPitchRollAngles.createFromRotMatrix(matrix);
        console.log(matrix.toJSON(), rotation && rotation.toJSON());
        if (rotation) {
          this.props.onRotationTransitionUpdate(rotation);
        }
      }
    }
  }

  private handleCellHoverChange = (pos: Point3d, state: Hover) => {
    let hoverMap = this.state.hoverMap;
    if (!this.props.dragging) {
      hoverMap[pos.x + "-" + pos.y + "-" + pos.z] = state;
    } else {
      hoverMap = {};
    }
    this.setState({hoverMap});
  }
}

const faceNames: {[key: number]: string} = {
  [Face.None]: "",
  [Face.Front]: "front",
  [Face.Back]: "back",
  [Face.Right]: "right",
  [Face.Left]: "left",
  [Face.Top]: "top",
  [Face.Bottom]: "bottom",
};

interface CubeFaceProps extends React.AllHTMLAttributes<HTMLDivElement> {
  rotation: YawPitchRollAngles;
  face: Face;
  hoverMap: {[key: string]: Hover};
  onFaceCellClick: (position: Point3d, face?: Face) => void;
  onFaceCellHoverChange: (position: Point3d, state: Hover) => void;
}

class CubeFace extends React.Component<CubeFaceProps> {
  private _faceWidth: number = 0;
  public render(): React.ReactNode {
    const {rotation, face, hoverMap, onFaceCellClick, onFaceCellHoverChange, style, ...props} = this.props;
    if (face === Face.None)
      return null;
    const name = faceNames[face];
    const classes = classnames("face", name);
    const label = UiFramework.i18n.translate(`UiFramework:cube.${name}`);

    let rot = "";
    switch (this.props.face) {
      case Face.Back:
        rot = " rotateY(.5turn)";
        break;
      case Face.Right:
        rot = " rotateY(.25turn)";
        break;
      case Face.Left:
        rot = " rotateY(-.25turn)";
        break;
      case Face.Top:
        rot = " rotateX(.25turn)";
        break;
      case Face.Bottom:
        rot = " rotateX(-.25turn)";
        break;
    }
    const transform = `translateZ(-${this._faceWidth}px) rotateX(${-rotation.pitch.radians}rad) rotateY(${rotation.yaw.radians}rad) ${rot} translateZ(${this._faceWidth}px)`;
    const s: React.CSSProperties = {
      transform,
      WebkitTransform: transform,
      ...style,
    };

    return (
      <div style={s}
        className={classes}
        ref={(e) => { this._faceWidth = (e && e.clientWidth / 2) || 0; }}
        {...props}>
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
                    position={this.faceCellToPos(face, x, y)}
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
  private faceCellToPos = (face: Face, x: number, y: number) => {
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
    const {center, children, ...props} = this.props;
    return <div className={classnames("face-row", {center})} {...props}>{children}</div>;
  }
}

interface FaceCellProps extends React.AllHTMLAttributes<HTMLDivElement> {
  center?: boolean;
  onFaceCellClick: (position: Point3d, face?: Face) => void;
  onFaceCellHoverChange: (position: Point3d, state: Hover) => void;
  hoverMap: {[key: string]: Hover};
  position: Point3d;
  face?: Face;
}

class FaceCell extends React.Component<FaceCellProps> {
  private _startMouse: Point2d | undefined;
  public render(): React.ReactNode {
    const {center, children, onFaceCellClick, onFaceCellHoverChange, hoverMap, face, position, ...props} = this.props;
    const {x, y, z} = position;
    const hover = hoverMap[x + "-" + y + "-" + z] === Hover.Hover;
    const active = hoverMap[x + "-" + y + "-" + z] === Hover.Active;
    return <div
      onMouseDown={this.handleMouseDown}
      onMouseUp={this.handleMouseUp}
      onMouseOver={this.handleMouseOver}
      onMouseOut={this.handleMouseOut}
      className={classnames("face-cell", {center, hover, active})}
      {...props}>{children}</div>;
  }
  private handleMouseOver = () => {
    const {position} = this.props;
    this.props.onFaceCellHoverChange(position, Hover.Hover);
  }
  private handleMouseOut = () => {
    const {position} = this.props;
    this.props.onFaceCellHoverChange(position, Hover.None);
  }
  private handleMouseDown = (event: React.MouseEvent) => {
    const {position} = this.props;
    const {clientX, clientY} = event;
    this._startMouse = Point2d.create(clientX, clientY);
    this.props.onFaceCellHoverChange(position, Hover.Active);
  }
  private handleMouseUp = (event: React.MouseEvent) => {
    const {position, face} = this.props;
    const {clientX, clientY} = event;
    this.props.onFaceCellHoverChange(position, Hover.None);
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

const pointerIconClass: {[key: number]: string} = {
  [Pointer.Up]: "icon-caret-down",
  [Pointer.Down]: "icon-caret-up",
  [Pointer.Left]: "icon-caret-right",
  [Pointer.Right]: "icon-caret-left",
};

const pointerClass: {[key: number]: string} = {
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
    const {visible, pointerType, onArrowClick, ...props} = this.props;
    const classes = classnames(
      "cube-pointer", "icon",
      pointerClass[pointerType],
      pointerIconClass[pointerType],
      {visible},
    );
    return (
      <div className={classes} {...props}
        onClick={this.handleClick}/>
    );
  }
  private handleClick = (event: React.MouseEvent) => {
    const {pointerType} = this.props;
    event.preventDefault();
    this.props.onArrowClick(pointerType);
  }
}
