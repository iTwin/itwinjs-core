/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { toaster } from "@itwin/itwinui-react";

afterEach(() => {
  // Undo DOM manipulations made by iTwinUI-React components
  document.body.innerHTML = "";
  document.body.removeAttribute("class");
  // Force toaster to recreate container
  // because its statically initialized and after cleaning the body
  // it looses reference of container ot render in
  // eslint-disable-next-line @typescript-eslint/dot-notation
  toaster["isInitialized"] = false;
});
