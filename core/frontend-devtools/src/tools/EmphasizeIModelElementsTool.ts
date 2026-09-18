/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { ColorDef, FeatureAppearance } from "@itwin/core-common";
import { EmphasizeIModelElements, FeatureSymbology, IModelApp, Tool, Viewport } from "@itwin/core-frontend";

const emphasizedViewports = new Set<Viewport>();

// ###TODO Might wanna put a default FeatureAppearance on IModelDisplayReferences that can be inherited or overridden per-iModelRef...
const defaultAppearanceProvider = {
  appearance: FeatureAppearance.defaults,
  addFeatureOverrides(overrides: FeatureSymbology.Overrides) {
    overrides.setDefaultOverrides(this.appearance, true);
  }
};

function getViewport(registerIfNotFound: boolean): Viewport | undefined {
  const vp = IModelApp.viewManager.selectedView;
  if (vp && !emphasizedViewports.has(vp)) {
    if (!registerIfNotFound)
      return undefined;

    emphasizedViewports.add(vp);
    vp.onDisposed.addOnce(() => emphasizedViewports.delete(vp));
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

    // ###TODO need event listener for newly-linked iModels

    let anyEmphasized = false;
    for (const ref of vp.iModelRefs) {
      let emphasizedOrOverridden = false;
      if (ref.iModel.selectionSet.isActive) {
        const emph = EmphasizeIModelElements.getOrCreate(ref);
        if (!colorize || emph.overrideSelectedElements(ref, ColorDef.white, undefined, true, false)) {
          emphasizedOrOverridden = true;
          emph.wantEmphasis = emphasize;
          if (emph.emphasizeSelectedElements(ref, undefined, true))
            anyEmphasized = true;
        }
      }

      if (!emphasizedOrOverridden)
        ref.featureOverrideProviders.add(defaultAppearanceProvider);
    }

    vp.isFadeOutActive = anyEmphasized;
    defaultAppearanceProvider.appearance = anyEmphasized ? EmphasizeIModelElements.defaultAppearance : FeatureAppearance.defaults;

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
