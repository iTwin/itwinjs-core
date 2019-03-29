/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Timeline */

/**
 * A range of time which can be used to focus in on activities scheduled around a milestone.
 */
export interface MilestoneRange {
  start: Date;
  end: Date;
}

/**
 * A Milestone event that is to be noted in the timeline.
 */
export interface Milestone {
  /** uniqueId of milestone */
  id: string;
  /** milestone date */
  date: Date;
  parentId?: string;
  /** Milestone label that is display if space allows */
  label?: string;
  /** Milestone description that is show as tooltip */
  description?: string;
  /** animation range that includes milestone */
  range?: MilestoneRange;
  /** Set to true if read only. */ // TODO can range be modified if read only?
  readonly?: boolean;
  children?: Milestone[];
}

/** The amount of detail to be displayed in timeline. */
export const enum TimelineDetail {
  /** Show duration and milestones if available. */
  Minimal = 0,
  /** Show start/end Date and playback dates only. */
  Medium = 1,
  /** Detailed timeline showing all available Milestones within playback range */
  Full = 2,
}

/** The timeline scale to be displayed if TimelineDetail in NOT set to 'Minimal'. */
export const enum TimelineScale {
  /** Show years */
  Years,
  /** Show quarters */
  Quarters,
  /** Show months */
  Months,
  /** Show days */
  Days,
  /** Show hours */
  Hours,
}

/** Determines if data displayed to use is the actual date or the amount of time elapsed since project start.  */
export const enum TimelineDateDisplay {
  /** Display time axis using actual start/end dates */
  ActualTime,
  /** Display time axis using time relative to actual start/end dates */
  ProjectTime,
}

/**
 * Playback Settings.  TODO: do we need a display StartDate/EndData this would allow user to show a timeline that extends beyond the 'start' and 'end' dates.
 */
export interface PlaybackSettings {
  /** time in milliseconds to play animation from start date to end date */
  duration: number;
  /** Set to True if animation to restart each time playbackEnd is reached. Defaults to false. */
  loop: boolean;
  /** Playback start. If defined must be within start-end range. If not define 'start' is used. */
  playbackStart?: Date;
  /** Playback end. If defined must be within start-end range and later than playbackStart. If not define 'end' is used. */
  playbackEnd?: Date;
  /** Set to True if user should be allowed to insert milestone dates. Defaults to false */
  allowMilestoneEdits?: boolean;
  /** Define if actual date/times are used or date/times relative to project are used to draw timeline axis. */
  dateDisplay?: TimelineDateDisplay;
  /**  Defines the amount of detail to be displayed. */
  displayDetail?: TimelineDetail;
}

/**
 * An interface used to notify Handlers of the current pointer position in the timeline playback. Valid range is 0 to 1 and it determines percentage complete.
 */
export type PlaybackPointerChangeHandler = (pointerValue: number) => void;

/**
 * An interface used to notify Handlers of Playback Settings changes.
 * Contains the settings to be used.
 */
export type PlaybackSettingsChangeHandler = (settings: PlaybackSettings) => void;

/** Interface for a timeline data provider class */
export interface TimelineDataProvider {
  /** uniqueId of provider */
  id: string;
  /** returns true if the provider has timeline animation data available */
  supportsTimelineAnimation: boolean;
  /** Starting date for entire timeline */
  start?: Date;
  /** End date for entire timeline */
  end?: Date;
  /** Current pointer date */
  pointerValue?: number;
  /** Get count of milestones. If parent milestone is not defined then the number of root milestones will be returned. */
  getMilestonesCount(parent?: Milestone): number;
  /** Get array of milestones. If parent milestone is not defined then the root milestones will be returned. */
  getMilestones(parent?: Milestone): Milestone[];
  /** Called to save updated set of milestones */
  saveMilestones(milestones: Milestone[], parent?: Milestone): Promise<boolean>;
  /** Called to delete one or more milestone */
  deleteMilestones(milestones: Milestone[]): Promise<boolean>;
  /** Called to get the playback settings */
  getSettings(): PlaybackSettings;
  /** Called to save the playback settings */
  updateSettings(settings: PlaybackSettings): void;
  /** Async call to load milestone and settings data */
  loadTimelineData(): Promise<boolean>;
  /** Called when an internal process has defined the playback settings and the UI needs to be updated */
  onPlaybackSettingChanged?: PlaybackSettingsChangeHandler;
  /** Called when the an internal process has defined the playback settings and the UI needs to be updated */
  onPlaybackPointerChanged?: PlaybackPointerChangeHandler;
}
