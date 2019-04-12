/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import { BaseTimelineDataProvider } from "../../ui-components/timeline/BaseTimelineDataProvider";
import {
  Milestone, PlaybackSettings,
  TimelineDetail,
} from "../../ui-components/timeline/interfaces";

class TestTimelineDataProvider extends BaseTimelineDataProvider {
  public pointerCallbackCalled = false;
  public settingsCallbackCalled = false;

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.pointerCallbackCalled = true;
    this.animationFraction = animationFraction;
  }

  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.settingsCallbackCalled = true;
    this.updateSettings(settings);
  }
}

describe("Timeline", () => {

  describe("Duration only timeline", () => {
    const duration = 20;
    const loop = true;
    const displayDetail = TimelineDetail.Minimal;
    const testanimationFraction = 0.3;

    class Test1TimelineDataProvider extends TestTimelineDataProvider {
      public async loadTimelineData(): Promise<boolean> {
        this.updateSettings({
          duration,
          loop,
          displayDetail,
        });

        return Promise.resolve(true);
      }
    }

    it("test duration only data from provider", async () => {
      const timelineProvider = new Test1TimelineDataProvider();
      await timelineProvider.loadTimelineData();

      const count = timelineProvider.getMilestonesCount();
      expect(count).to.be.equal(0);
      const settings = timelineProvider.getSettings();
      expect(settings.duration).to.be.equal(duration);
      expect(settings.loop).to.be.equal(loop);
      expect(timelineProvider.pointerCallbackCalled).to.be.false;
      timelineProvider.onAnimationFractionChanged(testanimationFraction);
      expect(timelineProvider.pointerCallbackCalled).to.be.true;
    });
  });

  describe("Start, End, and Duration only timeline", () => {
    const duration = 20;
    const loop = true;
    const displayDetail = TimelineDetail.Medium;
    const startDate = new Date(2014, 6, 6);
    const endDate = new Date(2016, 8, 12);
    const testanimationFraction = 0.3;

    class Test2TimelineDataProvider extends TestTimelineDataProvider {
      public async loadTimelineData(): Promise<boolean> {
        this.updateSettings({
          duration,
          loop,
          displayDetail,
        });

        this.start = startDate;
        this.end = endDate;

        return Promise.resolve(true);
      }
    }

    it("test duration, start, and end dates", async () => {
      const timelineProvider = new Test2TimelineDataProvider();
      await timelineProvider.loadTimelineData();
      const count = timelineProvider.getMilestonesCount();
      expect(count).to.be.equal(0);
      const settings = timelineProvider.getSettings();
      expect(settings.duration).to.be.equal(duration);
      expect(settings.loop).to.be.equal(loop);
      expect(timelineProvider.start).to.be.equal(startDate);
      expect(timelineProvider.end).to.be.equal(endDate);

      // simulate UI updating pointer to current playback time
      timelineProvider.onAnimationFractionChanged(testanimationFraction);
      expect(timelineProvider.pointerCallbackCalled).to.be.true;
      expect(timelineProvider.animationFraction).to.be.equal(testanimationFraction);
    });
  });

  describe("Timelines with milestones", () => {
    const testanimationFraction = 0.3;
    const duration = 20;
    const loop = true;
    const startDate = new Date(2014, 6, 6);
    const endDate = new Date(2016, 8, 12);
    const displayDetail = TimelineDetail.Full;

    const milestones: Milestone[] = [
      { id: "1", date: new Date(2014, 6, 15), label: "First meeting", readonly: true },
      { id: "2", date: new Date(2014, 8, 15), label: "meeting 2", readonly: true },
      { id: "3", date: new Date(2014, 10, 15), label: "meeting 3", readonly: true },
      { id: "4", date: new Date(2014, 12, 15), label: "meeting 4", readonly: true },
      { id: "5", date: new Date(2015, 2, 15), label: "meeting 5", readonly: true },
      { id: "6", date: new Date(2015, 4, 15), label: "meeting 6", readonly: true },
      { id: "7", date: new Date(2015, 6, 15), label: "meeting 7", readonly: false },
      { id: "8", date: new Date(2015, 8, 15), label: "meeting 8", readonly: false },
      { id: "9", date: new Date(2015, 10, 15), label: "meeting 9", readonly: false },
      { id: "10", date: new Date(2015, 12, 15), label: "meeting 10", readonly: false },
      { id: "11", date: new Date(2016, 2, 15), label: "meeting 11" },
      { id: "12", date: new Date(2016, 4, 15), label: "meeting 12" },
      { id: "13", date: new Date(2016, 6, 15), label: "Last meeting" },
    ];

    class Test3TimelineDataProvider extends TestTimelineDataProvider {
      public async loadTimelineData(): Promise<boolean> {
        this.updateSettings({
          duration,
          loop,
          displayDetail,
        });

        this.start = startDate;
        this.end = endDate;
        this._milestones = milestones;

        return Promise.resolve(true);
      }
    }

    it("test single level of milestones", async () => {
      const timelineProvider = new Test3TimelineDataProvider();
      await timelineProvider.loadTimelineData();

      const count = timelineProvider.getMilestonesCount();
      expect(count).to.be.equal(13);
      const settings = timelineProvider.getSettings();
      expect(settings.duration).to.be.equal(duration);
      expect(settings.loop).to.be.equal(loop);
      expect(timelineProvider.pointerCallbackCalled).to.be.false;
      timelineProvider.onAnimationFractionChanged(testanimationFraction);
      expect(timelineProvider.pointerCallbackCalled).to.be.true;

      expect(timelineProvider.settingsCallbackCalled).to.be.false;
      timelineProvider.onPlaybackSettingChanged({ duration: 35, loop: false } as PlaybackSettings);
      expect(timelineProvider.settingsCallbackCalled).to.be.true;
      const { duration: updatedDuration, loop: updatedLoop } = timelineProvider.getSettings();
      expect(updatedDuration).to.be.equal(35);
      expect(updatedLoop).to.be.equal(false);
      expect(updatedDuration).to.be.equal(35);
    });
  });

  describe("Timelines with milestones", () => {
    const testanimationFraction = 0.3;
    const duration = 20;
    const loop = true;
    const startDate = new Date(2014, 6, 6);
    const endDate = new Date(2016, 8, 12);
    const displayDetail = TimelineDetail.Full;

    const nestedMilestones: Milestone[] = [
      {
        id: "1", date: new Date(2014, 6, 15), label: "First meeting", readonly: true, children: [
          { id: "1-1", date: new Date(2014, 6, 17), label: "meeting 11", readonly: true, parentId: "1" },
          { id: "1-2", date: new Date(2014, 6, 18), label: "meeting 12", readonly: true, parentId: "1" },
          { id: "1-3", date: new Date(2014, 6, 19), label: "meeting 13", readonly: true, parentId: "1" },
        ],
      },
      {
        id: "2", date: new Date(2014, 8, 15), label: "meeting 2", readonly: true, children: [
          { id: "2-1", date: new Date(2014, 8, 17), label: "meeting 21", readonly: true, parentId: "2" },
          { id: "2-2", date: new Date(2014, 8, 18), label: "meeting 22", readonly: true, parentId: "2" },
          { id: "2-3", date: new Date(2014, 8, 19), label: "meeting 23", readonly: true, parentId: "2" },
        ],
      },
      {
        id: "3", date: new Date(2014, 10, 15), label: "meeting 3", readonly: true, children: [
          { id: "3-1", date: new Date(2014, 10, 17), label: "meeting 31", readonly: true, parentId: "3" },
          { id: "3-2", date: new Date(2014, 10, 18), label: "meeting 32", readonly: true, parentId: "3" },
          {
            id: "3-3", date: new Date(2014, 10, 19), label: "meeting 33", readonly: true, parentId: "3", children: [
              { id: "3-3-1", date: new Date(2014, 10, 21), label: "meeting 331", readonly: true, parentId: "3-3" },
              { id: "3-3-2", date: new Date(2014, 10, 22), label: "meeting 332", readonly: true, parentId: "3-3" },
              { id: "3-3-3", date: new Date(2014, 10, 23), label: "meeting 333", readonly: true, parentId: "3-3" },
            ],
          },
        ],
      },
    ];

    class Test4TimelineDataProvider extends TestTimelineDataProvider {
      public async loadTimelineData(): Promise<boolean> {
        this.updateSettings({
          duration,
          loop,
          displayDetail,
        });

        this.start = startDate;
        this.end = endDate;
        this._milestones = nestedMilestones;

        return Promise.resolve(true);
      }
    }

    it("test multi-level of milestones", async () => {
      const timelineProvider = new Test4TimelineDataProvider();
      await timelineProvider.loadTimelineData();

      const count = timelineProvider.getMilestonesCount();
      expect(count).to.be.equal(3);
      const settings = timelineProvider.getSettings();
      expect(settings.duration).to.be.equal(duration);
      expect(settings.loop).to.be.equal(loop);
      expect(timelineProvider.pointerCallbackCalled).to.be.false;
      timelineProvider.onAnimationFractionChanged(testanimationFraction);
      expect(timelineProvider.pointerCallbackCalled).to.be.true;

      const foundMilestone = timelineProvider.findMilestoneById("3-3-3");
      expect(foundMilestone).not.to.be.undefined;

      const milestoneToDelete = timelineProvider.findMilestoneById("3-3");
      expect(milestoneToDelete).not.to.be.undefined;
      const didDelete = await timelineProvider.deleteMilestones([milestoneToDelete!]);
      expect(didDelete).to.be.true;
      expect(timelineProvider.findMilestoneById("3-3")).to.be.undefined;
    });

  });

});
