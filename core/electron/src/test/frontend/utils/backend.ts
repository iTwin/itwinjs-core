/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElectronHost } from "../../../ElectronBackend";

async function init() {
  await ElectronHost.startup();
}

module.exports = init();
