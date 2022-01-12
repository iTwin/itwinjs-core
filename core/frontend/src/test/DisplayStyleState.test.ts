/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Code, DisplayStyle3dProps, RenderSchedule, RenderTimelineProps } from "@itwin/core-common";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { createBlankConnection } from "./createBlankConnection";

describe("DisplayStyleState", () => {
  describe("schedule script state", () => {
    let iModel: IModelConnection;

    before(async () => {
      await IModelApp.startup();
      iModel = createBlankConnection();
    });

    after(async () => {
      await iModel.close();
      await IModelApp.shutdown();
    });

    class Style extends DisplayStyle3dState {
      public constructor(opts?: { renderTimeline?: string; scheduleScript?: RenderSchedule.ScriptProps; }) {
        const props: DisplayStyle3dProps = {
          code: Code.createEmpty(),
          model: IModelConnection.dictionaryId,
          classFullName: "BisCore:DisplayStyle3d",
          jsonProperties: {
            styles: {
              renderTimeline: opts?.renderTimeline,
              scheduleScript: opts?.scheduleScript,
            },
          },
        };

        super(props, iModel);
      }

      public get isLoading() { return undefined !== this._queryRenderTimelinePropsPromise; }
      public async finishLoading() {
        while (this._queryRenderTimelinePropsPromise)
          await this._queryRenderTimelinePropsPromise;
      }

      public queryTimeline?: (timelineId: string) => Promise<RenderTimelineProps | undefined>;
      protected override queryRenderTimelineProps(timelineId: string): Promise<RenderTimelineProps | undefined> {
        return this.queryTimeline ? this.queryTimeline(timelineId) : super.queryRenderTimelineProps(timelineId);
      }
    }

    const script1: RenderSchedule.ScriptProps = [{
      modelId: "0x1",
      visibilityTimeline: [{ time: 1234, value: 0 }, { time: 5678, value: 100 }],
      elementTimelines: [],
    }];

    const script2: RenderSchedule.ScriptProps = [{
      modelId: "0x2",
      visibilityTimeline: [{ time: 1234, value: 0 }, { time: 5678, value: 100 }],
      elementTimelines: [],
    }];

    it("updates when renderTimeline changes", async () => {
    });

    it("updates when scheduleScriptProps changes", async () => {
      const style = new Style();
      expect(style.scheduleState).to.be.undefined;
      expect(style.settings.scheduleScriptProps).to.be.undefined;

      style.settings.scheduleScriptProps = script1;
      let prevState = style.scheduleState;
      expect(prevState).not.to.be.undefined;

      style.settings.scheduleScriptProps = script2;
      expect(style.scheduleState).not.to.equal(prevState);
      expect(style.scheduleState).not.to.be.undefined;

      style.settings.scheduleScriptProps = undefined;
      expect(style.scheduleState).to.be.undefined;
    });

    it("ignores scheduleScriptProps if renderTimeline is defined", async () => {
    });

    it("raises onScheduleScriptReferenceChanged", async () => {
    });

    it("ignores previous renderTimeline if reassigned while loading", async () => {
    });

    it("is set to undefined if loadScheduleState produces an exception", async () => {
    });
  });
});
