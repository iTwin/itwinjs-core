/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform } from "@bentley/geometry-core";
import { ViewFlags } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { FeatureSymbology } from "../FeatureSymbology";
import { ClipVolume } from "./ClipVolume";

/**
 * Represents a branch node in the scene graph, with associated view flags and transform to be applied to
 * all sub-nodes of the branch.
 */
export class BranchState {
  public readonly transform: Transform;
  public readonly viewFlags: ViewFlags;
  public readonly symbologyOverrides?: FeatureSymbology.Overrides;
  public readonly clipVolume?: ClipVolume;

  public constructor(flags?: ViewFlags, transform?: Transform) {
    this.viewFlags = ViewFlags.createFrom(flags);
    this.transform = undefined !== transform ? transform.clone() : Transform.createIdentity();
  }

  public get showClipVolume(): boolean { return this.viewFlags.showClipVolume(); }
}

/**
 * Represents the current state of the scene graph. As the scene graph is traversed,
 * branch states are pushed and popped. Pushing a branch state replaces the current view flags
 * and multiplies the current transform with the branch's transform. Popping it inverts this
 * operation. The state at the top of the stack applies to the rendering of all primitives.
 * The stack does not store the scene graph itself.
 */
export class BranchStack {
  private readonly _stack: BranchState[] = [];

  private push(state: BranchState): void { this._stack.push(state); }

  public constructor(flags?: ViewFlags, transform?: Transform) { this.push(new BranchState(flags, transform)); }

  public get top(): BranchState {
    assert(!this.empty);
    return this._stack[this._stack.length - 1];
  }

  public get bottom(): BranchState {
    assert(!this.empty);
    return this._stack[0];
  }

  public get empty(): boolean { return 0 === this._stack.length; }

  public pop(): void {
    assert(!this.empty);
    if (!this.empty) {
      this._stack.pop();
    }
  }
}
