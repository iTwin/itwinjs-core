/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Tools */

import {
  ColorDef,
} from "@bentley/imodeljs-common";
import {
  EmphasizeElements,
  IModelApp,
  ScreenViewport,
  Tool,
} from "@bentley/imodeljs-frontend";

/** Applies the `EmphasizeElements` API in some way to the selected Viewport.
 * @beta
 */
export abstract class EmphasizeElementsTool extends Tool {
  protected get _wantCreate(): boolean { return true; }
  protected abstract execute(emph: EmphasizeElements, vp: ScreenViewport): void;

  public run(_args: any[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    const emph = this._wantCreate ? EmphasizeElements.getOrCreate(vp) : EmphasizeElements.get(vp);
    if (undefined !== emph)
      this.execute(emph, vp);

    return true;
  }
}

const enum OverrideType {
  None = 0,
  Color = 1 << 0,
  Emphasis = 1 << 1,
  Both = Color | Emphasis,
}

/** If any elements are selected, emphasize them all by overriding their color to be orange; and de-emphasize all other elements by drawing them transparent grey.
 * @beta
 */
export class EmphasizeSelectedElementsTool extends EmphasizeElementsTool {
  public static toolId = "EmphasizeSelectedElements";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  private _type = OverrideType.None;

  public execute(emph: EmphasizeElements, vp: ScreenViewport): void {
    if (OverrideType.None === (this._type & OverrideType.Color) || emph.overrideSelectedElements(vp, ColorDef.white.clone(), undefined, true, false)) {
      emph.wantEmphasis = OverrideType.None !== (this._type & OverrideType.Emphasis);
      if (emph.emphasizeSelectedElements(vp, undefined, true)) {
        vp.isFadeOutActive = true;
        return;
      }
    }

    // Empty selection set - clear any previous overrides.
    EmphasizeElements.clear(vp);
    emph.wantEmphasis = false;
    vp.isFadeOutActive = false;
  }

  public parseAndRun(...args: string[]): boolean {
    if (1 === args.length) {
      switch (args[0].toLowerCase()[0]) {
        case "n":
          break;
        case "c":
          this._type = OverrideType.Color;
          break;
        case "e":
          this._type = OverrideType.Emphasis;
          break;
        case "b":
          this._type = OverrideType.Both;
          break;
      }
    }

    return this.run(args);
  }
}

/** Isolate all selected elements so that *only* those elements will be drawn.
 * @beta
 */
export class IsolateSelectedElementsTool extends EmphasizeElementsTool {
  public static toolId = "IsolateSelectedElements";
  public execute(emph: EmphasizeElements, vp: ScreenViewport): void {
    emph.isolateSelectedElements(vp, true, true);
  }
}

/** Clear the set of isolated elements.
 * @beta
 */
export class ClearIsolatedElementsTool extends EmphasizeElementsTool {
  public static toolId = "ClearIsolatedElements";
  protected get _wantCreate() { return false; }
  public execute(emph: EmphasizeElements, vp: ScreenViewport): void {
    emph.clearIsolatedElements(vp);
  }
}
