/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { ColorDef, FeatureAppearance } from "@itwin/core-common";
import { EmphasizeIModelElements, IModelApp, IModelDisplayReference, Tool, Viewport } from "@itwin/core-frontend";

const emphasizedViewports = new Set<Viewport>();
interface EmphasisState {
  emphasize: boolean;
  colorize: boolean;
  anyEmphasized: boolean;
  originalAppearances: Map<IModelDisplayReference, FeatureAppearance | undefined>;
  appearanceRefs: Set<IModelDisplayReference>;
}
const stateByViewport = new WeakMap<Viewport, EmphasisState>();

function configureReference(ref: IModelDisplayReference, state: EmphasisState): boolean {
  if (ref.iModel.selectionSet.isActive) {
    const emphasis = EmphasizeIModelElements.getOrCreate(ref);
    if (!state.colorize || emphasis.overrideSelectedElements(ref, ColorDef.white, undefined, true, false)) {
      emphasis.wantEmphasis = state.emphasize;
      return emphasis.emphasizeSelectedElements(ref, undefined, true);
    }
  }

  if (!state.originalAppearances.has(ref))
    state.originalAppearances.set(ref, ref.overrides.defaultFeatureAppearance);
  state.appearanceRefs.add(ref);
  return false;
}

function updateDefaultAppearances(state: EmphasisState): void {
  for (const ref of state.appearanceRefs)
    ref.overrides.defaultFeatureAppearance = state.anyEmphasized ? EmphasizeIModelElements.defaultAppearance : state.originalAppearances.get(ref);
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

        state.anyEmphasized = configureReference(ref, state) || state.anyEmphasized;
        vp.isFadeOutActive = state.anyEmphasized;
        updateDefaultAppearances(state);
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

    const previousState = stateByViewport.get(vp);
    const state: EmphasisState = {
      emphasize,
      colorize,
      anyEmphasized: false,
      originalAppearances: previousState?.originalAppearances ?? new Map(),
      appearanceRefs: previousState?.appearanceRefs ?? new Set(),
    };
    stateByViewport.set(vp, state);
    for (const ref of vp.iModelRefs) {
      state.anyEmphasized = configureReference(ref, state) || state.anyEmphasized;
    }

    vp.isFadeOutActive = state.anyEmphasized;
    updateDefaultAppearances(state);

    return true;
  }
}

export class ClearEmphasizedIModelElementsTool extends Tool {
  public static override toolId = "ClearEmphasizedIModelElements";

  public override async run(): Promise<boolean> {
    const vp = getViewport(false);
    if (!vp)
      return true;

    const state = stateByViewport.get(vp);
    vp.isFadeOutActive = false;
    for (const ref of vp.iModelRefs) {
      EmphasizeIModelElements.clear(ref);
      if (state?.originalAppearances.has(ref))
        ref.overrides.defaultFeatureAppearance = state.originalAppearances.get(ref);
    }

    stateByViewport.delete(vp);

    return true;
  }
}
