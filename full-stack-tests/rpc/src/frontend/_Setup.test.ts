/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager, EmptyLocalization, RpcConfiguration } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/renderer";
import { IModelApp, LocalhostIpcApp } from "@itwin/core-frontend";
import { MobileRpcManager } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, MobileTestInterface, MultipleClientsInterface, rpcInterfaces } from "../common/TestRpcInterface";

before(setupFrontend);
after(teardownFrontend);
