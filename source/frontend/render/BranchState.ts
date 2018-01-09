/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform } from "@bentley/geometry-core/lib/PointVector";
import { ViewFlags } from "../../common/Render";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

/**
 * Represents a branch node in the scene graph, with associated view flags and transform to be applied to
 * all sub-nodes of the branch.
 */
export class BranchState {
  public readonly transform: Transform = Transform.createIdentity();
  public readonly viewFlags: ViewFlags;

  // NOTE: invoked by e.g.:
  //  let state = new BranchState(new ViewFlags());
  // both arguments are optional; if omitted they will == undefined.
  public constructor(flags?: ViewFlags, transform?: Transform) {
    // NOTE: Clone the args to prevent caller from later modifying...
    this.viewFlags = ViewFlags.createFrom(flags);
    if (transform) {
      transform.clone(this.transform);
    }
  }

  // NOTE: A property. Invoked by:
  //  if (branchState.showClipVolume) { /* ... */ }
  public get showClipVolume(): boolean {
    return this.viewFlags.showClipVolume();
  }
}

/** Represents the current state of the scene graph. As the scene graph is traversed,
 * branch states are pushed and popped. Pushing a branch state replaces the current view flags
 * and multiplies the current transform with the branch's transform. Popping it inverts this
 * operation. The state at the top of the stack applies to the rendering of all primitives.
 * The stack does not store the scene graph itself.
 */
export class BranchStack {
  private _stack: BranchState[];

  private push(state: BranchState): void {
    this._stack.push(state);
  }

  public constructor(flags?: ViewFlags, transform?: Transform) {
    this.push(new BranchState(flags, transform));
  }

  public get top(): BranchState {
    // NOTE: We have no way of preventing caller from modifying the returned value.
    // Don't want to clone it out of paranoia...
    assert(!this.empty);
    return this._stack[this._stack.length - 1];
  }

  // NOTE: a property.
  public get empty(): boolean {
    return 0 === this._stack.length;
  }

  public pop(): void {
    assert(!this.empty);
    if (!this.empty) {
      this._stack.pop();
    }
  }
}
