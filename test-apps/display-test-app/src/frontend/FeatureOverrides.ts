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
  Viewport,
} from "@bentley/imodeljs-frontend";

export function emphasizeSelectedElements(vp: Viewport): void {
  const emph = EmphasizeElements.getOrCreate(vp);
  if (emph.overrideSelectedElements(vp, new ColorDef(ColorByName.orange), undefined, true, false) // replace existing; don't clear selection set...
    && emph.emphasizeSelectedElements(vp, undefined, true)) { // ...replace existing; now clear selection set
    vp.isFadeOutActive = true;
  } else {
    EmphasizeElements.clear(vp); // clear any previous overrides
    vp.isFadeOutActive = false;
  }
}
