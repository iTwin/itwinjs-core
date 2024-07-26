/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IndexedPolyface, Transform } from "@itwin/core-geometry";
import { DisplayParams } from "./DisplayParams";

/** @internal */
export class PolyfacePrimitive {
  public readonly displayParams: DisplayParams;
  private _polyface: IndexedPolyface;
  public readonly displayEdges: boolean;
  public readonly isPlanar: boolean;

  public get indexedPolyface() { return this._polyface; }

  public static create(params: DisplayParams, pf: IndexedPolyface, displayEdges: boolean = true, isPlanar: boolean = false) {
    return new PolyfacePrimitive(params, pf, displayEdges, isPlanar);
  }

  private constructor(params: DisplayParams, pf: IndexedPolyface, displayEdges: boolean, isPlanar: boolean) {
    this.displayParams = params;
    this._polyface = pf;
    this.displayEdges = displayEdges;
    this.isPlanar = isPlanar;
  }

  public clone(): PolyfacePrimitive { return new PolyfacePrimitive(this.displayParams, this._polyface.clone(), this.displayEdges, this.isPlanar); }
  public transform(trans: Transform): boolean { return this._polyface.tryTransformInPlace(trans); }
}

/** @internal */
export class PolyfacePrimitiveList extends Array<PolyfacePrimitive> {
  constructor(...args: PolyfacePrimitive[]) {
    super(...args);
  }
}
