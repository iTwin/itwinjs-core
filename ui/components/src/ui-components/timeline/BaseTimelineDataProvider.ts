/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Timeline */

import {
  TimelineDataProvider,
  Milestone, PlaybackSettings,
  TimelineDetail,
} from "../../ui-components/timeline/interfaces";

export class BaseTimelineDataProvider implements TimelineDataProvider {
  public readonly id = "TestTimelineDataProvider";
  public start: Date | undefined;
  public end: Date | undefined;
  public supportsTimelineAnimation = false; // set to true when provider determines animation data is available.
  public pointerValue: number = 0;
  protected _milestones: Milestone[] = [];
  private _settings: PlaybackSettings = {
    duration: 20,
    loop: true,
    displayDetail: TimelineDetail.Minimal,
  };

  public async loadTimelineData(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public getMilestonesCount(parent?: Milestone): number {
    if (undefined === parent)
      return this._milestones.length;

    if (undefined === parent.children)
      return 0;

    return parent.children.length;
  }

  private findMilestone(milestoneId: string, milestones: Milestone[]): Milestone | undefined {
    if (milestones.length <= 0)
      return undefined;

    let milestone = milestones.find((value) => value.id.toLowerCase() === milestoneId);
    if (milestone)
      return milestone;

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < milestones.length; i++) {
      if (milestones[i].children) {
        milestone = this.findMilestone(milestoneId, milestones[i].children!);
        if (milestone)
          return milestone;
      }
    }
    return undefined;
  }

  public findMilestoneById(milestoneId: string, milestones?: Milestone[]): Milestone | undefined {
    if (undefined === milestones)
      milestones = this._milestones;

    return this.findMilestone(milestoneId.toLowerCase(), milestones);
  }

  public getMilestones(parent?: Milestone): Milestone[] {
    if (undefined === parent) {
      return this._milestones;
    }

    if (parent && parent.children)
      return parent.children!;

    return [];
  }

  /** save a complete set of milestones for a given parent. If parent is undefined then the milestone are considered root milestones. */
  public async saveMilestones(milestones: Milestone[], parent?: Milestone): Promise<boolean> {
    if (undefined === parent) {
      this._milestones = milestones;
      return Promise.resolve(true);
    } else {
      parent.children = milestones;
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  public async deleteMilestones(milestonesToDelete: Milestone[]): Promise<boolean> {
    let milestonesDeleted = false;
    if (undefined === milestonesToDelete)
      return Promise.resolve(milestonesDeleted);

    milestonesToDelete.forEach((milestoneToDelete) => {
      if (milestoneToDelete.parentId) {
        const parent = this.findMilestoneById(milestoneToDelete.parentId, this._milestones);
        if (parent) {
          const indexToRemove = parent.children!.findIndex((child) => child === milestoneToDelete);
          if (indexToRemove !== -1) {

            parent.children!.splice(indexToRemove, 1);
            milestonesDeleted = true;
          }
        }
      }
    });
    return Promise.resolve(milestonesDeleted);
  }

  public getSettings(): PlaybackSettings {
    return this._settings;
  }

  public updateSettings(settings: PlaybackSettings) {
    this._settings = { ...this._settings, ...settings };
  }

  public onPlaybackSettingChanged = (_settings: PlaybackSettings) => {
  }

  public onPlaybackPointerChanged = (_pointerValue: number) => {
  }
}
