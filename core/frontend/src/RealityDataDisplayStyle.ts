/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ClipVector } from "@itwin/core-geometry";

/**
 * JSON representation of the reality data attachment display style properties.
 * @beta
 */
export interface RealityDataDisplayStyleProps {
  /** The container for clips. */
  clips: ClipVector | undefined;
}

/**
 * This class provides a container and methods to specify display properties or actions on reality data.
 * @beta
*/
export class RealityDataDisplayStyle {
  public readonly clips: ClipVector | undefined;

  private constructor(props: RealityDataDisplayStyleProps) {
    this.clips = props.clips;
  }
  public static fromJSON(jsonProperties: { [key: string]: any }) {
    const clips = jsonProperties.clip !== undefined ? ClipVector.fromJSON(jsonProperties.clip) : undefined;
    return new RealityDataDisplayStyle({clips});
  }
  public static fromProps(props: RealityDataDisplayStyleProps) {
    return new RealityDataDisplayStyle(props);
  }
}
