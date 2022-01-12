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

    const script1: RenderSchedule.ScriptProps = [{
      modelId: "0x1",
      visibilityTimeline: [{ time: 1234, value: 0 }, { time: 5678, value: 50 }],
      elementTimelines: [],
    }];

    const script2: RenderSchedule.ScriptProps = [{
      modelId: "0x2",
      visibilityTimeline: [{ time: 1234, value: 0 }, { time: 5678, value: 50 }],
      elementTimelines: [],
    }];

    class Style extends DisplayStyle3dState {
      public readonly eventPayloads: Array<RenderSchedule.ScriptReference | undefined>;

      public constructor() {
        const props: DisplayStyle3dProps = {
          id: "0xbeef",
          code: Code.createEmpty(),
          model: IModelConnection.dictionaryId,
          classFullName: "BisCore:DisplayStyle3d",
        };

        super(props, iModel);

        this.eventPayloads = [];
        this.onScheduleScriptReferenceChanged.addListener((ref) => this.eventPayloads.push(ref));
      }

      public expectScript(props: RenderSchedule.ScriptProps, sourceId: string): void {
        expect(this.scheduleScriptReference).not.to.be.undefined;
        expect(this.scheduleScriptReference!.sourceId).to.equal(sourceId);
        expect(this.scheduleScriptReference!.script.modelTimelines[0].modelId).to.equal(props[0].modelId);
      }

      public get isLoading() { return undefined !== this._queryRenderTimelinePropsPromise; }
      public async finishLoading() {
        while (this._queryRenderTimelinePropsPromise)
          await this._queryRenderTimelinePropsPromise;
      }

      protected override queryRenderTimelineProps(timelineId: string): Promise<RenderTimelineProps | undefined> {
        let script;
        if (timelineId === "0x1")
          script = JSON.stringify(script1);
        else if (timelineId === "0x2")
          script = JSON.stringify(script2);
        else if (timelineId === "0x3")
          script = "invalid JSON }";

        if (!script)
          return Promise.resolve(undefined);

        return Promise.resolve({
          script,
          model: "blah",
          code: Code.createEmpty().toJSON(),
          classFullName: "BisCore:RenderTimeline",
          id: timelineId,
        });
      }
    }

    it("updates when renderTimeline changes", async () => {
    });

    it("updates when scheduleScriptProps changes", () => {
      const style = new Style();
      expect(style.scheduleState).to.be.undefined;
      expect(style.settings.scheduleScriptProps).to.be.undefined;

      style.settings.scheduleScriptProps = script1;
      let prevState = style.scheduleState;
      style.expectScript(script1, "0xbeef");
      expect(prevState).not.to.be.undefined;

      style.settings.scheduleScriptProps = script2;
      expect(style.scheduleState).not.to.equal(prevState);
      expect(style.scheduleState).not.to.be.undefined;
      style.expectScript(script2, "0xbeef");

      style.settings.scheduleScriptProps = undefined;
      expect(style.scheduleState).to.be.undefined;
    });

    it("ignores scheduleScriptProps if renderTimeline is defined", async () => {
      const style = new Style();
      await style.changeRenderTimeline("0x1");
      style.expectScript(script1, "0x1");

      style.settings.scheduleScriptProps = script2;
      style.expectScript(script1, "0x1");

      await style.changeRenderTimeline(undefined);
      style.expectScript(script2, "0xbeef");

      await style.changeRenderTimeline("0x1");
      style.expectScript(script1, "0x1");
    });

    it("raises onScheduleScriptReferenceChanged", async () => {
    });

    it("ignores previous renderTimeline if reassigned while loading", async () => {
    });

    it("is set to undefined if loadScheduleState produces an exception", async () => {
      const style = new Style();
      await style.changeRenderTimeline("0x1");
      style.expectScript(script1, "0x1");

      await style.changeRenderTimeline("0x3");
      expect(style.scheduleState).to.be.undefined;
    });
  });
});
