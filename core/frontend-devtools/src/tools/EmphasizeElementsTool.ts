/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ColorByName,
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

/** If any elements are selected, emphasize them all by overriding their color to be orange; and de-emphasize all other elements by drawing them transparent grey.
 * @beta
 */
export class EmphasizeSelectedElementsTool extends EmphasizeElementsTool {
  public static toolId = "EmphasizeSelectedElements";
  public execute(emph: EmphasizeElements, vp: ScreenViewport): void {
    if (emph.overrideSelectedElements(vp, new ColorDef(ColorByName.orange), undefined, true, false) // replace existing; don't clear selection set...
      && emph.emphasizeSelectedElements(vp, undefined, true)) { // ...replace existing; now clear selection set
      vp.isFadeOutActive = true;
    } else {
      EmphasizeElements.clear(vp); // clear any previous overrides
      vp.isFadeOutActive = false;
    }
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
