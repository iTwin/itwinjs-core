/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "@bentley/geometry-core";
import { DisplayParams } from "./DisplayParams";

export class StrokesPointList {
  public points: Point3d[];
  constructor(public startDistance: number = 0, public rangeCenter: Point3d = Point3d.createZero(), points: Point3d[] = []) { this.points = [...points]; }
}

export class StrokesPointLists extends Array<StrokesPointList> { constructor(...args: StrokesPointList[]) { super(...args); } }

export class Strokes {
  private _displayParams: DisplayParams;
  private _strokes: StrokesPointLists;
  private _isDisjoint: boolean;
  private _isPlanar: boolean;

  public get displayParams() { return this._displayParams; }
  public get strokes() { return this._strokes; }
  public get isDisjoint() { return this._isDisjoint; }
  public get isPlanar() { return this._isPlanar; }

  public static create(params: DisplayParams, isDisjoint: boolean, isPlanar: boolean) {
    return new Strokes(params, isDisjoint, isPlanar);
  }

  private constructor(params: DisplayParams, isDisjoint: boolean, isPlanar: boolean) {
    this._displayParams = params;
    this._strokes = new StrokesPointLists();
    this._isDisjoint = isDisjoint;
    this._isPlanar = isPlanar;
  }

  // ###TODO: public static clipToRange(input: StrokesPointLists, range: any);
  // ###TODO: public transform(transform: Transform);
}

export class StrokesList extends Array<Strokes> { constructor(...args: Strokes[]) { super(...args); } }
