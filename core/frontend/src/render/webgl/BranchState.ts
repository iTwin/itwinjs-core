/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Transform } from "@bentley/geometry-core";
import { ViewFlags, RenderMode } from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { FeatureSymbology } from "../FeatureSymbology";
import { Branch } from "./Graphic";
import { RenderClipVolume } from "../System";

/**
 * Represents a branch node in the scene graph, with associated view flags and transform to be applied to
 * all sub-nodes of the branch.
 */
export class BranchState {
  public readonly transform: Transform;
  private readonly _viewFlags: ViewFlags;
  public symbologyOverrides: FeatureSymbology.Overrides;
  public readonly clipVolume?: RenderClipVolume;

  public static fromBranch(prev: BranchState, branch: Branch) {
    const vf = branch.branch.getViewFlags(prev.viewFlags);
    const transform = prev.transform.multiplyTransformTransform(branch.localToWorldTransform);
    const ovrs = undefined !== branch.branch.symbologyOverrides ? branch.branch.symbologyOverrides : prev.symbologyOverrides;
    return new BranchState(vf, transform, ovrs, branch.clips);
  }

  public static create(ovrs: FeatureSymbology.Overrides, flags?: ViewFlags, transform?: Transform, clip?: RenderClipVolume) {
    return new BranchState(ViewFlags.createFrom(flags), undefined !== transform ? transform.clone() : Transform.createIdentity(), ovrs, clip);
  }

  public static createForDecorations(): BranchState {
    const vf = new ViewFlags();
    vf.renderMode = RenderMode.SmoothShade;
    vf.sourceLights = false;
    vf.cameraLights = false;
    vf.solarLight = false;
    return new BranchState(vf, Transform.createIdentity(), new FeatureSymbology.Overrides());
  }

  public get viewFlags() { return this._viewFlags; }
  public set viewFlags(vf: ViewFlags) { vf.clone(this._viewFlags); }
  public get showClipVolume(): boolean { return this.viewFlags.clipVolume; }

  private constructor(flags: ViewFlags, transform: Transform, ovrs: FeatureSymbology.Overrides, clip?: RenderClipVolume) {
    this._viewFlags = flags;
    this.transform = transform;
    this.symbologyOverrides = ovrs;
    this.clipVolume = clip;
  }
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

  public constructor(flags?: ViewFlags, transform?: Transform) { this.pushState(BranchState.create(new FeatureSymbology.Overrides(), flags, transform)); }

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

  public setViewFlags(vf: ViewFlags) { assert(1 === this.length); this.top.viewFlags = vf; }
  public setSymbologyOverrides(ovrs: FeatureSymbology.Overrides) {
    assert(1 === this.length);
    this.top.symbologyOverrides = ovrs;
  }
}
