/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileRpcManager } from "@bentley/imodeljs-common";
import { getRpcInterfaces, initializeBackend } from "./backend";
// tslint:disable:no-console

// Initialize the backend
initializeBackend();
MobileRpcManager.initializeImpl(getRpcInterfaces("native"));
