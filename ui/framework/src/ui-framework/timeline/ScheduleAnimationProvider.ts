/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Timeline */

import { BaseTimelineDataProvider, PlaybackSettings, Milestone } from "@bentley/ui-components";
import { ScreenViewport, ViewState } from "@bentley/imodeljs-frontend";

/** ScheduleAnimation Timeline Data Provider - handles View that define 'scheduleScript' data.
 * @alpha
 */
// No access to scheduleScript to even mock in test
// istanbul ignore next
export class ScheduleAnimationTimelineDataProvider extends BaseTimelineDataProvider {
  private _viewState: ViewState;

  constructor(viewState: ViewState, viewport?: ScreenViewport) {
    super(viewport);
    this._viewState = viewState;

    if (viewState && viewState.scheduleScript) {
      this.supportsTimelineAnimation = true;
    }
  }

  public async loadTimelineData(): Promise<boolean> {
    if (this._viewport)
      this.animationFraction = this._viewport.animationFraction;

    if (this.supportsTimelineAnimation && this._viewState.scheduleScript) {
      // for now just initial settings
      this.updateSettings({
        duration: 20 * 1000,      // this is playback duration
        loop: true,
      });

      const timeRange = this._viewState.scheduleScript!.duration;
      this.start = new Date(timeRange.low * 1000);
      this.end = new Date(timeRange.high * 1000);

      const quarter = (this.end.getTime() - this.start.getTime()) / 4;
      const milestones: Milestone[] = [];
      milestones.push({ id: "1", label: "1st Floor Concrete", date: new Date(this.start.getTime() + quarter), readonly: true });
      milestones.push({ id: "2", label: "2nd Floor Concrete", date: new Date(this.end.getTime() - quarter), readonly: true });
      this._milestones = milestones;

      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.animationFraction = animationFraction;
    if (this._viewport)
      this._viewport.animationFraction = animationFraction;
  }

  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.updateSettings(settings);
  }
}
