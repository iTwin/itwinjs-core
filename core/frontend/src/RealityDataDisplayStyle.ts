/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ClipVector } from "@itwin/core-geometry";

/** This class provides a container and methods to specify display properties or actions on reality data. */
export class RealityDataDisplayStyle {
  public readonly clips: ClipVector | undefined;

  public constructor(jsonProperties: { [key: string]: any }) {
    this.clips = jsonProperties.clip !== undefined ? ClipVector.fromJSON(jsonProperties.clip) : undefined;
  }
}
