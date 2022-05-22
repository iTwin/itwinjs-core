/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

afterEach(() => {
  // Undo DOM manipulations made by iTwinUI-React components
  document.getElementsByTagName("html")[0].innerHTML = "";
});
