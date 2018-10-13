/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Cube */

import * as React from "react";
import * as classnames from "classnames";

import "./Cube.scss";

import { Matrix3d } from "@bentley/geometry-core";

/** Cube Face enumeration */
export enum Face {
  None = 0,
  Left,
  Right,
  Back,
  Front,
  Bottom,
  Top,
}

/** Properties for the [[Cube]] React component */
export interface CubeProps extends React.AllHTMLAttributes<HTMLDivElement> {
  faces?: { [key: string]: React.ReactNode };
  rotMatrix: Matrix3d;
  className?: string;
}

/** Cube React component used by the 3d Cube Navigation Aid */
export class Cube extends React.Component<CubeProps> {
  public render(): React.ReactNode {
    const { faces, rotMatrix, className, ...props } = this.props;
    return (
      <div className={classnames("cube-css3d", className)} {...props}>
        {[Face.Front, Face.Back, Face.Right, Face.Left, Face.Top, Face.Bottom]
          .map((face: Face) => {
            const content = faces && faces[face];
            return (
              <CubeFace
                key={face}
                rotMatrix={rotMatrix}
                face={face}>
                {content}
              </CubeFace>
            );
          })}
      </div>
    );
  }
}

const faceNames: { [key: number]: string } = {
  [Face.None]: "",
  [Face.Front]: "front",
  [Face.Back]: "back",
  [Face.Right]: "right",
  [Face.Left]: "left",
  [Face.Top]: "top",
  [Face.Bottom]: "bottom",
};

/** @hidden */
export interface CubeFaceProps extends React.AllHTMLAttributes<HTMLDivElement> {
  rotMatrix: Matrix3d;
  face: Face;
}

/** @hidden */
export class CubeFace extends React.Component<CubeFaceProps> {
  private _faceWidth: number = 0;
  public render(): React.ReactNode {
    const { rotMatrix, face, style, children, ...props } = this.props;
    if (face === Face.None)
      return null;
    const name = faceNames[face];
    const classes = classnames("face", name);
    // orient face (flip because of y axis reversal, rotate as neccesary)
    let reorient: Matrix3d = Matrix3d.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, 1);
    // Position face correctly (applies to rotation, as well as translation)
    let reposition: Matrix3d = Matrix3d.createIdentity();
    switch (this.props.face) {
      case Face.Bottom:
        reposition = Matrix3d.createRowValues(-1, 0, 0, 0, 1, 0, 0, 0, -1);
        reorient = Matrix3d.createRowValues(-1, 0, 0, 0, 1, 0, 0, 0, 1);
        break;
      case Face.Right:
        reposition = Matrix3d.createRowValues(0, 0, 1, 0, 1, 0, -1, 0, 0);
        reorient = Matrix3d.createRowValues(0, 1, 0, 1, 0, 0, 0, 0, 1);
        break;
      case Face.Left:
        reposition = Matrix3d.createRowValues(0, 0, -1, 0, 1, 0, 1, 0, 0);
        reorient = Matrix3d.createRowValues(0, -1, 0, -1, 0, 0, 0, 0, 1);
        break;
      case Face.Back:
        reposition = Matrix3d.createRowValues(1, 0, 0, 0, 0, 1, 0, -1, 0);
        reorient = Matrix3d.createRowValues(-1, 0, 0, 0, 1, 0, 0, 0, 1);
        break;
      case Face.Front:
        reposition = Matrix3d.createRowValues(1, 0, 0, 0, 0, -1, 0, 1, 0);
        reorient = Matrix3d.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, 1);
        break;
    }
    const repositioned = rotMatrix.multiplyMatrixMatrix(reposition);
    const vect = repositioned.multiplyXYZ(0, 0, this._faceWidth);
    const m = repositioned.multiplyMatrixMatrix(reorient);
    const list = [
      m.at(0, 0), -m.at(1, 0), m.at(2, 0), 0,
      m.at(0, 1), -m.at(1, 1), m.at(2, 1), 0,
      m.at(0, 2), -m.at(1, 2), m.at(2, 2), 0,
      vect.at(0), -vect.at(1), vect.at(2) - this._faceWidth /* move back faceWidth so face is on screen level */, 1,
    ];
    const transform = `matrix3d(${list.join(",")})`;
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
        {children}
      </div>
    );
  }
}
