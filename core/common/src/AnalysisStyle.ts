/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import {
  Range1d,
  Range1dProps,
} from "@bentley/geometry-core";
import { ThematicGradientSettingsProps, ThematicGradientSettings } from "./ThematicDisplay";

/** Properties for display of analysis data
 * @alpha
 */
export interface AnalysisStyleProps {
  inputName?: string;
  displacementChannelName?: string;
  scalarChannelName?: string;
  normalChannelName?: string;
  displacementScale?: number;
  scalarRange?: Range1dProps;
  scalarThematicSettings?: ThematicGradientSettingsProps;
  inputRange?: Range1dProps;
}

/** @alpha */
export class AnalysisStyle implements AnalysisStyleProps {
  public inputName?: string;
  public displacementChannelName?: string;
  public scalarChannelName?: string;
  public normalChannelName?: string;
  public displacementScale?: number;
  public scalarRange?: Range1d;
  public scalarThematicSettings?: ThematicGradientSettings;
  public inputRange?: Range1d;

  public static fromJSON(json?: AnalysisStyleProps) {
    const result = new AnalysisStyle();
    if (!json)
      return result;

    result.inputName = json.inputName;
    result.displacementChannelName = json.displacementChannelName;
    result.scalarChannelName = json.scalarChannelName;
    result.normalChannelName = json.normalChannelName;
    result.displacementScale = json.displacementScale;
    result.scalarRange = json.scalarRange ? Range1d.fromJSON(json.scalarRange) : undefined;
    result.scalarThematicSettings = json.scalarThematicSettings ? ThematicGradientSettings.fromJSON(json.scalarThematicSettings) : undefined;
    result.inputRange = json.inputRange ? Range1d.fromJSON(json.inputRange) : undefined;
    return result;
  }

  public toJSON(): AnalysisStyleProps {
    return {
      inputName: this.inputName,
      displacementChannelName: this.displacementChannelName,
      scalarChannelName: this.scalarChannelName,
      normalChannelName: this.normalChannelName,
      displacementScale: this.displacementScale,
      scalarRange: this.scalarRange?.toJSON(),
      scalarThematicSettings: this.scalarThematicSettings?.toJSON(),
      inputRange: this.inputRange?.toJSON(),
    };
  }

  public copyFrom(source: AnalysisStyle) {
    this.inputName = source.inputName;
    this.displacementChannelName = source.displacementChannelName;
    this.scalarChannelName = source.scalarChannelName;
    this.normalChannelName = source.normalChannelName;
    this.displacementScale = source.displacementScale;
    if (source.scalarRange) this.scalarRange = source.scalarRange.clone();
    if (source.scalarThematicSettings) this.scalarThematicSettings = source.scalarThematicSettings.clone();
    this.scalarThematicSettings = source.scalarThematicSettings;
    if (source.inputRange) this.inputRange = source.inputRange.clone();
  }

  public clone(out?: AnalysisStyle): AnalysisStyle {
    const result = undefined !== out ? out : new AnalysisStyle();
    result.copyFrom(this);
    return result;
  }
}
