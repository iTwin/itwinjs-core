/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { ColorDef, FeatureAppearance } from "@itwin/core-common";
import { EmphasizeIModelElements, FeatureSymbology, IModelApp, IModelDisplayReference, Tool, Viewport } from "@itwin/core-frontend";

const emphasizedViewports = new Set<Viewport>();
const stateByViewport = new WeakMap<Viewport, { emphasize: boolean, colorize: boolean, anyEmphasized: boolean }>();

// ###TODO Might wanna put a default FeatureAppearance on IModelDisplayReferences that can be inherited or overridden per-iModelRef...
const defaultAppearanceProvider = {
  appearance: FeatureAppearance.defaults,
  addFeatureOverrides(overrides: FeatureSymbology.Overrides) {
    overrides.setDefaultOverrides(this.appearance, true);
  }
};

function configureReference(ref: IModelDisplayReference, emphasize: boolean, colorize: boolean): boolean {
  if (ref.iModel.selectionSet.isActive) {
    const emph = EmphasizeIModelElements.getOrCreate(ref);
    if (!colorize || emph.overrideSelectedElements(ref, ColorDef.white, undefined, true, false)) {
      emph.wantEmphasis = emphasize;
      return emph.emphasizeSelectedElements(ref, undefined, true);
    }
  }

  ref.featureOverrideProviders.add(defaultAppearanceProvider);
  return false;
}

function getViewport(registerIfNotFound: boolean): Viewport | undefined {
  const vp = IModelApp.viewManager.selectedView;
  if (vp && !emphasizedViewports.has(vp)) {
    if (!registerIfNotFound)
      return undefined;

    emphasizedViewports.add(vp);
    const removeLinkedListener = vp.iModelRefs.isSpatial
      ? vp.iModelRefs.onLinked.addListener((ref) => {
        const state = stateByViewport.get(vp);
        if (!state)
          return;

        state.anyEmphasized = configureReference(ref, state.emphasize, state.colorize) || state.anyEmphasized;
        vp.isFadeOutActive = state.anyEmphasized;
        defaultAppearanceProvider.appearance = state.anyEmphasized ? EmphasizeIModelElements.defaultAppearance : FeatureAppearance.defaults;
      })
      : undefined;

    vp.onDisposed.addOnce(() => {
      removeLinkedListener?.();
      stateByViewport.delete(vp);
      emphasizedViewports.delete(vp);
    });
  }

  return vp;
}

export class EmphasizeSelectedIModelElementsTool extends Tool {
  public static override toolId = "EmphasizeSelectedIModelElements";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    let emphasize, colorize;
    if (1 === args.length) {
      switch (args[0].toLowerCase()[0]) {
        case "n":
          break;
        case "c":
          colorize = true;
          break;
        case "e":
          emphasize = true;
          break;
        case "b":
          colorize = emphasize = true;
          break;
      }
    }

    return this.run(emphasize, colorize);
  }

  public override async run(emphasize = false, colorize = false): Promise<boolean> {
    const vp = getViewport(true);
    if (!vp)
      return true;

    const state = { emphasize, colorize, anyEmphasized: false };
    stateByViewport.set(vp, state);
    for (const ref of vp.iModelRefs) {
      state.anyEmphasized = configureReference(ref, emphasize, colorize) || state.anyEmphasized;
    }

    vp.isFadeOutActive = state.anyEmphasized;
    defaultAppearanceProvider.appearance = state.anyEmphasized ? EmphasizeIModelElements.defaultAppearance : FeatureAppearance.defaults;

    return true;
  }
}

export class ClearEmphasizedIModelElementsTool extends Tool {
  public static override toolId = "ClearEmphasizedIModelElements";

  public override async run(): Promise<boolean> {
    const vp = getViewport(false);
    if (!vp)
      return true;

    vp.isFadeOutActive = false;
    for (const ref of vp.iModelRefs) {
      EmphasizeIModelElements.clear(ref);
      ref.featureOverrideProviders.delete(defaultAppearanceProvider);
    }

    return true;
  }
}
