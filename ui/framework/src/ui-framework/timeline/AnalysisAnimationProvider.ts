/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Timeline */

import { BaseTimelineDataProvider, PlaybackSettings } from "@bentley/ui-components";
import { ScreenViewport, ViewState } from "@bentley/imodeljs-frontend";

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
      this.animationFraction = this._viewport.animationFraction;

    // istanbul ignore else
    if (this.supportsTimelineAnimation && this._viewState.analysisStyle) {
      // for now just initial settings
      this.updateSettings({
        duration: 5 * 1000,
        loop: true,
      });

      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.animationFraction = animationFraction;
    // istanbul ignore else
    if (this._viewport)
      this._viewport.animationFraction = animationFraction;
  }

  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.updateSettings(settings);
  }
}
