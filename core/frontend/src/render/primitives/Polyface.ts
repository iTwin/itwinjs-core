/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IndexedPolyface, Transform } from "@bentley/geometry-core";
import { DisplayParams } from "./DisplayParams";

export class Polyface {
  public readonly displayParams: DisplayParams;
  private _polyface: IndexedPolyface;
  public readonly displayEdges: boolean;
  public readonly isPlanar: boolean;

  public get indexedPolyface() { return this._polyface; }

  public static create(params: DisplayParams, pf: IndexedPolyface, displayEdges: boolean, isPlanar: boolean) {
    return new Polyface(params, pf, displayEdges, isPlanar);
  }

  private constructor(params: DisplayParams, pf: IndexedPolyface, displayEdges: boolean, isPlanar: boolean) {
    this.displayParams = params;
    this._polyface = pf;
    this.displayEdges = displayEdges;
    this.isPlanar = isPlanar;
  }

  public clone(): Polyface { return new Polyface(this.displayParams, this._polyface.clone(), this.displayEdges, this.isPlanar); }
  public transform(trans: Transform): boolean { return this._polyface.tryTransformInPlace(trans); }
}

export class PolyfaceList extends Array<Polyface> { constructor(...args: Polyface[]) { super(...args); } }
