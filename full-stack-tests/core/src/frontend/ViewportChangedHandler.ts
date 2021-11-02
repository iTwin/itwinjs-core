/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import {
  ChangeFlag, ChangeFlags, MutableChangeFlags, Viewport,
} from "@itwin/core-frontend";

/** Aspects of a Viewport that can become invalidated when its state changes. */
export enum ViewportState {
  TimePoint = 1 << 0,
  SceneBit = 1 << 1,
  Scene = ViewportState.SceneBit | ViewportState.TimePoint,
  RenderPlanBit = 1 << 2,
  RenderPlan = ViewportState.RenderPlanBit | ViewportState.Scene,
  AnalysisFraction = 1 << 3,
  ControllerBit = 1 << 4,
  Controller = ViewportState.ControllerBit | ViewportState.RenderPlan | ViewportState.AnalysisFraction,
}

/** Accumulates changed events emitted by a Viewport. */
export class ViewportChangedHandler {
  protected readonly _vp: Viewport;
  protected readonly _removals: Array<() => void> = [];
  // Flags set by individual event callbacks
  protected readonly _eventFlags = new MutableChangeFlags(ChangeFlag.None);
  // Flags received by onViewportChanged callback
  protected _changeFlags?: ChangeFlags;
  protected _featureOverridesDirty = false;
  protected readonly _undoDelay: BeDuration;

  public constructor(vp: Viewport) {
    // NB: Viewport.saveViewUndo() does nothing if called in rapid succession. That can make tests of undo/redo unpredictable.
    // Reset the delay to 0. Will set it back in dispose()
    this._undoDelay = Viewport.undoDelay;
    Viewport.undoDelay = BeDuration.fromSeconds(0);

    this._vp = vp;
    this._removals.push(vp.onViewportChanged.addListener((_: Viewport, cf) => {
      expect(this._changeFlags).to.be.undefined;
      this._changeFlags = cf;
    }));
    this._removals.push(vp.onAlwaysDrawnChanged.addListener(() => {
      expect(this._eventFlags.alwaysDrawn).to.be.false;
      this._eventFlags.setAlwaysDrawn();
    }));
    this._removals.push(vp.onNeverDrawnChanged.addListener(() => {
      expect(this._eventFlags.neverDrawn).to.be.false;
      this._eventFlags.setNeverDrawn();
    }));
    this._removals.push(vp.onDisplayStyleChanged.addListener(() => {
      expect(this._eventFlags.displayStyle).to.be.false;
      this._eventFlags.setDisplayStyle();
    }));
    this._removals.push(vp.onViewedCategoriesChanged.addListener(() => {
      expect(this._eventFlags.viewedCategories).to.be.false;
      this._eventFlags.setViewedCategories();
    }));
    this._removals.push(vp.onViewedCategoriesPerModelChanged.addListener(() => {
      expect(this._eventFlags.viewedCategoriesPerModel).to.be.false;
      this._eventFlags.setViewedCategoriesPerModel();
    }));
    this._removals.push(vp.onViewedModelsChanged.addListener(() => {
      expect(this._eventFlags.viewedModels).to.be.false;
      this._eventFlags.setViewedModels();
    }));
    this._removals.push(vp.onFeatureOverrideProviderChanged.addListener(() => {
      expect(this._eventFlags.featureOverrideProvider).to.be.false;
      this._eventFlags.setFeatureOverrideProvider();
    }));
    this._removals.push(vp.onFeatureOverridesChanged.addListener(() => {
      expect(this._featureOverridesDirty).to.be.false;
      this._featureOverridesDirty = true;
    }));

    // Initial change events are sent the first time the new ViewState is rendered.
    this.expect(ChangeFlag.Initial, undefined, () => undefined);
  }

  public dispose() {
    Viewport.undoDelay = this._undoDelay;

    for (const removal of this._removals)
      removal();

    this._removals.length = 0;
  }

  /** Install a ViewportChangedHandler, execute the specified function, and uninstall the handler. */
  public static test(vp: Viewport, func: (mon: ViewportChangedHandler) => void): void {
    const mon = new ViewportChangedHandler(vp);
    func(mon);
    mon.dispose();
  }

  /** Async version of test(). */
  public static async testAsync(vp: Viewport, func: (mon: ViewportChangedHandler) => Promise<void>): Promise<void> {
    const mon = new ViewportChangedHandler(vp);
    await func(mon);
    mon.dispose();
  }

  /** Assert that executing the supplied function causes events to be omitted resulting in the specified flags. */
  public expect(flags: ChangeFlag, state: ViewportState | undefined, func: () => void): void {
    if (undefined === state)
      state = 0;

    this._vp.setAllValid();
    func();

    expect(this._vp.sceneValid).to.equal(0 === (state & ViewportState.SceneBit));
    expect(this._vp.renderPlanValid).to.equal(0 === (state & ViewportState.RenderPlanBit));
    expect(this._vp.controllerValid).to.equal(0 === (state & ViewportState.ControllerBit));
    expect(this._vp.timePointValid).to.equal(0 === (state & ViewportState.TimePoint));
    expect(this._vp.analysisFractionValid).to.equal(0 === (state & ViewportState.AnalysisFraction));

    this._vp.renderFrame();

    expect(this._vp.sceneValid).to.be.true;
    expect(this._vp.renderPlanValid).to.be.true;
    expect(this._vp.controllerValid).to.be.true;
    expect(this._vp.timePointValid).to.be.true;
    expect(this._vp.analysisFractionValid).to.be.true;

    // Expect exactly the same ChangeFlags to be received by onViewportChanged handler.
    if (undefined === this._changeFlags)
      expect(flags).to.equal(ChangeFlag.None);
    else
      expect(this._changeFlags.value).to.equal(flags);

    // Confirm onFeatureOverridesChanged invoked or not invoked based on expected flags.
    const expectFeatureOverridesChanged = 0 !== (flags & ChangeFlag.Overrides);
    expect(this._featureOverridesDirty).to.equal(expectFeatureOverridesChanged);
    if (undefined !== this._changeFlags)
      expect(this._changeFlags.areFeatureOverridesDirty).to.equal(expectFeatureOverridesChanged);

    // No dedicated deferred event for ViewState changed...just the immediate one.
    expect(this._eventFlags.value).to.equal(flags & ~ChangeFlag.ViewState);

    // Reset for next frame.
    this._eventFlags.clear();
    this._changeFlags = undefined;
    this._featureOverridesDirty = false;
    this._vp.setAllValid();
  }
}
