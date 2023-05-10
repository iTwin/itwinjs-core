/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

// __PUBLISH_EXTRACT_START__ ExtensionSample-main.example-code
import { IotMarkerExtension } from "./IotMarkerExtension";

export default function main() {
  console.log("Hello from Extension!");
  IotMarkerExtension.start();
  console.log("Custom Markers Registered!");
}
// __PUBLISH_EXTRACT_END__
