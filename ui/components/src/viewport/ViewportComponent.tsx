/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import * as React from "react";
import { Id64Props } from "@bentley/bentleyjs-core";
import {
  IModelApp,
  IModelConnection,
  Viewport,
  ViewState,
} from "@bentley/imodeljs-frontend";

import { BeDuration } from "@bentley/bentleyjs-core";

import {
  ViewportManager,
  CubeRotationChangeEventArgs,
  StandardRotationChangeEventArgs,
} from "./ViewportManager";

import {
  YawPitchRollAngles,
  RotMatrix,
  Transform,
} from "@bentley/geometry-core";

/**
 * Props for [[Viewport]] control.
 */
// tslint:disable-next-line:no-empty-interface
export interface ViewportProps {
  /** IModel to display */
  imodel: IModelConnection;

  /** ID of a default view definition to load as a starting point */
  viewDefinitionId: Id64Props;
}

/**
 * A viewport component that displays imodel on a canvas.
 */
export class ViewportComponent extends React.Component<ViewportProps> {

  private _canvas: React.RefObject<HTMLCanvasElement>;
  private _vp?: Viewport;

  public constructor(props: ViewportProps, context?: any) {
    super(props, context);
    this._canvas = React.createRef<HTMLCanvasElement>();
  }

  public async componentDidMount() {
    if (!this._canvas.current)
      throw new Error("Canvas failed to load");

    const viewState = await this.props.imodel.views.load(this.props.viewDefinitionId);
    if (!viewState)
      throw new Error("View state failed to load");

    this._vp = new Viewport(this._canvas.current, viewState);
    IModelApp.viewManager.addViewport(this._vp);

    ViewportManager.CubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent);
    ViewportManager.StandardRotationChangeEvent.addListener(this._handleStandardRotationChangeEvent);
    if (this._vp) {
      this._vp.onViewChanged.addListener(this._handleViewChanged);
      ViewportManager.setActiveViewport(this._vp);
    }
  }

  public componentWillUnmount() {
    if (this._vp) {
      if (this._vp === ViewportManager.getActiveViewport())
        ViewportManager.setActiveViewport(undefined);

      IModelApp.viewManager.dropViewport(this._vp);
      this._vp.onViewChanged.removeListener(this._handleViewChanged);
    }

    ViewportManager.CubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent);
    ViewportManager.StandardRotationChangeEvent.removeListener(this._handleStandardRotationChangeEvent);
  }

  private _onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    ViewportManager.setActiveViewport(this._vp);
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    if (this._vp && ViewportManager.getActiveViewport() === this._vp) {
      if (args.animationTime && args.animationTime < 0) {
        this._vp.synchWithView(true);
      }
      const rotMatrix = this._rotationMatrixFromYawPitchRoll(args.rotation); // TODO - switch to internal function after custom rotation order is implemented
      if (this._vp.rotMatrix !== rotMatrix) {
        const center = this._vp.view.getTargetPoint(); // Don't try to locate geometry using depth buffer...
        const inverse = rotMatrix.clone().inverse(); // rotation is from current nav cube state...
        if (undefined === inverse)
          return;
        const targetMatrix = inverse.multiplyMatrixMatrix(this._vp.view.getRotation());
        const worldTransform = Transform.createFixedPointAndMatrix(center, targetMatrix);
        const frustum = this._vp.getWorldFrustum();
        frustum.multiply(worldTransform);
        if (args.animationTime && args.animationTime > 0) {
          this._vp.animateFrustumChange(this._vp.getWorldFrustum(), frustum, BeDuration.fromMilliseconds(args.animationTime));
        } else {
          this._vp.view.setupFromFrustum(frustum);
          this._vp.synchWithView(false);
        }
      }
    }
  }

  private _handleStandardRotationChangeEvent = (args: StandardRotationChangeEventArgs) => {
    if (this._vp && ViewportManager.getActiveViewport() === this._vp) {
      // this._vp.view.setStandardRotation(args.standardRotation);
      this._vp.view.setRotationAboutPoint(ViewState.getStandardViewMatrix(args.standardRotation));
      this._vp.synchWithView(true);
    }
  }

  private _handleViewChanged = (vp: Viewport) => {
    const yawPitchRoll = ViewportComponent.getViewportYawPitchRoll(vp);
    if (yawPitchRoll && !yawPitchRoll.isAlmostEqual(ViewportManager.getViewRotation()))
      ViewportManager.setViewRotation(vp, yawPitchRoll);
  }

  /** Pulled from three.js, "ZXY" intrinsic Tait-Bryan angles for right-handed coordinates (rotations reversed from left-handed)
   */
  private _rotationMatrixFromYawPitchRoll = (angle: YawPitchRollAngles) => {
    const x = angle.pitch.radians, y = angle.roll.radians, z = angle.yaw.radians;
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);

    const rotX = RotMatrix.createRowValues(
      1, 0, 0,
      0, cx, sx,
      0, -sx, cx,
    );
    const rotY = RotMatrix.createRowValues(
      cy, 0, -sy,
      0, 1, 0,
      sy, 0, cy,
    );
    const rotZ = RotMatrix.createRowValues(
      cz, sz, 0,
      -sz, cz, 0,
      0, 0, 1,
    );
    return rotX.multiplyMatrixMatrix(rotY).multiplyMatrixMatrix(rotZ);
  }
  private static _yawPitchRollFromRotationMatrix = (m: RotMatrix) => {
    const clamp = (v: number, min: number, max: number) => {
      return Math.max(min, Math.min(max, v));
    };

    // assumes m is a pure rotation matrix (i.e, unscaled)
    const m11 = m.at(0, 0); // , m12 = m.at(1, 0), m13 = m.at(2, 0);
    const m21 = m.at(0, 1), m22 = m.at(1, 1), m23 = m.at(2, 1);
    const m31 = m.at(0, 2), m32 = m.at(1, 2), m33 = m.at(2, 2);
    let x, y, z;
    y = Math.asin(-clamp(m31, -1, 1));

    if (Math.abs(m31) < 0.99999) {
      x = Math.atan2(-m32, m33);
      z = Math.atan2(-m21, m11);
    } else {
      x = Math.atan2(m23, m22);
      z = 0;
    }

    return YawPitchRollAngles.createRadians(-z, x, y);
  }
  public static getViewportYawPitchRoll(vp: Viewport): YawPitchRollAngles | undefined {
    return this._yawPitchRollFromRotationMatrix(vp.rotMatrix);
  }

  public render() {
    return (
      <canvas ref={this._canvas} style={{ height: "100%", width: "100%" }}
        onMouseDown={this._onMouseDown}
        onContextMenu={(e) => { e.preventDefault(); return false; }}
      />
    );
  }
}
