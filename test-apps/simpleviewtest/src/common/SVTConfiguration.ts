/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DeploymentEnv } from "@bentley/imodeljs-clients";

/** Parameters for starting SimpleViewTest with a specified initial configuration */
export interface SVTConfiguration {
  customOrchestratorUri?: string;
  viewName?: string;
  environment?: DeploymentEnv;
  // standalone-specific config:
  standalone?: boolean;
  iModelName?: string;
  filename?: string;
  standalonePath?: string;    // Used when run in the browser - a common base path for all standalone imodels
}

export interface ConnectProjectConfiguration {
  userName: string;
  password: string;
  projectName: string;
  iModelName: string;
}
