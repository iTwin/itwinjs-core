/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Timeline
 */

import { ScreenViewport, ViewState } from "@bentley/imodeljs-frontend";
import { BaseTimelineDataProvider, PlaybackSettings } from "@bentley/ui-components";

/**  Analysis Timeline Data Provider - handles View that define 'analysisStyle' data.
 * @alpha
 */
export class AnalysisAnimationTimelineDataProvider extends BaseTimelineDataProvider {
  private _viewState: ViewState;

  constructor(viewState: ViewState, viewport?: ScreenViewport) {
    super(viewport);
    this._viewState = viewState;

    // istanbul ignore else
    if (viewState && viewState.analysisStyle) {
      this.supportsTimelineAnimation = true;
    }
  }

  public async loadTimelineData(): Promise<boolean> {
    // if animationFraction is set pointer should match
    // istanbul ignore else
    if (this._viewport)
      this.animationFraction = this._viewport.analysisFraction;

    // istanbul ignore else
    if (this.supportsTimelineAnimation && this._viewState.analysisStyle) {
      // for now just initial settings
      this.updateSettings({
        duration: 5 * 1000,
        loop: true,
      });

      return true;
    }

    // istanbul ignore next
    return false;
  }

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.animationFraction = animationFraction;
    // istanbul ignore next
    if (this._viewport)
      this._viewport.analysisFraction = animationFraction;
  };

  // istanbul ignore next
  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.updateSettings(settings);
  };
}
