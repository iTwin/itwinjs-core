/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Transform } from "@bentley/geometry-core";
import { DisplayParams } from "./DisplayParams";

export class StrokesPointList {
  public points: Point3d[];
  public readonly startDistance: number;
  constructor(startDistance: number, points: Point3d[] = []) { this.startDistance = startDistance; this.points = [...points]; }
}

export class StrokesPointLists extends Array<StrokesPointList> { constructor(...args: StrokesPointList[]) { super(...args); } }

export class Strokes {
  public readonly displayParams: DisplayParams;
  private _strokes: StrokesPointLists;
  public readonly isDisjoint: boolean;
  public readonly isPlanar: boolean;

  public get strokes() { return this._strokes; }

  public static create(params: DisplayParams, isDisjoint: boolean, isPlanar: boolean) {
    return new Strokes(params, isDisjoint, isPlanar);
  }

  private constructor(params: DisplayParams, isDisjoint: boolean, isPlanar: boolean) {
    this.displayParams = params;
    this._strokes = new StrokesPointLists();
    this.isDisjoint = isDisjoint;
    this.isPlanar = isPlanar;
  }

  // ###TODO: public static clipToRange(input: StrokesPointLists, range: any);

  public transform(trans: Transform) {
    for (const strk of this._strokes) {
      trans.multiplyPoint3dArrayInPlace(strk.points);
    }
  }
}

export class StrokesList extends Array<Strokes> { constructor(...args: Strokes[]) { super(...args); } }
