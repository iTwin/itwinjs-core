/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import { HiddenLine, ViewFlags } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../FeatureSymbology";
import { BranchState } from "./BranchState";
import { Branch } from "./Graphic";
import { EdgeSettings } from "./EdgeSettings";

/**
 * Represents the current state of the scene graph. As the scene graph is traversed,
 * branch states are pushed and popped. Pushing a branch state replaces the current view flags
 * and multiplies the current transform with the branch's transform. Popping it inverts this
 * operation. The state at the top of the stack applies to the rendering of all primitives.
 * The stack does not store the scene graph itself.
 * @internal
 */
export class BranchStack {
  private readonly _stack: BranchState[] = [];

  public constructor() {
    const state = new BranchState({
      viewFlags: new ViewFlags(),
      transform: Transform.createIdentity(),
      edgeSettings: EdgeSettings.create(undefined),
      is3d: true,
      symbologyOverrides: new FeatureSymbology.Overrides(),
    });

    this.pushState(state);
  }

  public get top(): BranchState {
    assert(!this.empty);
    return this._stack[this._stack.length - 1];
  }

  public get bottom(): BranchState {
    assert(!this.empty);
    return this._stack[0];
  }

  public get length() { return this._stack.length; }
  public get empty() { return 0 === this.length; }

  public pushBranch(branch: Branch): void {
    assert(this.length > 0);
    this.pushState(BranchState.fromBranch(this.top, branch));
  }

  public pushState(state: BranchState) {
    this._stack.push(state);
  }

  public pop(): void {
    assert(!this.empty);
    if (!this.empty) {
      this._stack.pop();
    }
  }

  public changeRenderPlan(vf: ViewFlags, is3d: boolean, hline: HiddenLine.Settings | undefined): void {
    assert(1 === this.length);
    this.top.changeRenderPlan(vf, is3d, hline);
  }

  public setSymbologyOverrides(ovrs: FeatureSymbology.Overrides) {
    assert(1 === this.length);
    this.top.symbologyOverrides = ovrs;
  }
}
