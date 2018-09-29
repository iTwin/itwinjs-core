/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { AccessToken } from "@bentley/imodeljs-clients";

// This file defines the Login service interface that applications can provide if they want to override the default behavior.

// Login services. Will be revised
export interface LoginServices {
  // Login to the system that controls access to Projects, and retrieve an AccessToken that is used for further queries.
  imsLogin(userName: string, password: string): Promise<AccessToken>;
}
