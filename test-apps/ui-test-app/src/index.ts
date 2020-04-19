/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// react-scripts requires an index.ts file in this location. Using it to import the code
// from the frontend.

import "./frontend/index";

// Imported here to make this package available for Extensions.
// In order for a package to be available it needs to be imported at least once in the application.
import "@bentley/projectshare-client";
