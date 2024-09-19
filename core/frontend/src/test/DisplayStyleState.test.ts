/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Code, DisplayStyle3dProps, EmptyLocalization, RenderSchedule, RenderTimelineProps } from "@itwin/core-common";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { createBlankConnection } from "./createBlankConnection";

describe("DisplayStyleState", () => {
  describe("schedule script state", () => {
    let iModel: IModelConnection;

    beforeAll(async () => {
      await IModelApp.startup({ localization: new EmptyLocalization() });
      iModel = createBlankConnection();
    });

    afterAll(async () => {
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
        this.onScheduleScriptReferenceChanged.addListener((ref) => this.eventPayloads.push(ref)); // eslint-disable-line deprecation/deprecation
      }

      public expectScript(props: RenderSchedule.ScriptProps, sourceId: string): void {
        expect(this.scheduleScript).not.to.be.undefined;
        expect(this.scheduleScriptReference!.sourceId).to.equal(sourceId); // eslint-disable-line deprecation/deprecation
        expect(this.scheduleScript!.modelTimelines[0].modelId).to.equal(props[0].modelId);
      }

      public get isLoading() { return undefined !== this._queryRenderTimelinePropsPromise; }
      public async finishLoading() {
        while (this._queryRenderTimelinePropsPromise)
          await this._queryRenderTimelinePropsPromise;
      }

      protected override async queryRenderTimelineProps(timelineId: string): Promise<RenderTimelineProps | undefined> {
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
      const style = new Style();
      expect(style.scheduleScript).to.be.undefined;

      style.settings.renderTimeline = "0x1";
      expect(style.isLoading).to.be.true;
      expect(style.settings.renderTimeline).to.equal("0x1");
      expect(style.scheduleScript).to.be.undefined;

      await style.finishLoading();
      expect(style.isLoading).to.be.false;
      style.expectScript(script1, "0x1");
      let state = style.scheduleScript;

      style.settings.renderTimeline = "0x2";
      expect(style.isLoading).to.be.true;
      expect(style.scheduleScript).to.equal(state);

      await style.finishLoading();
      expect(style.isLoading).to.be.false;
      expect(style.scheduleScript).not.to.equal(state);
      state = style.scheduleScript;
      style.expectScript(script2, "0x2");

      style.settings.renderTimeline = "0x2";
      expect(style.isLoading).to.be.false;
      expect(style.scheduleScript).to.equal(state);

      style.settings.renderTimeline = undefined;
      expect(style.isLoading).to.be.false;
      expect(style.scheduleScript).to.be.undefined;
    });

    it("updates when scheduleScriptProps changes", () => {
      const style = new Style();
      expect(style.scheduleScript).to.be.undefined;
      expect(style.settings.scheduleScriptProps).to.be.undefined;

      style.settings.scheduleScriptProps = script1;
      const prevState = style.scheduleScript;
      style.expectScript(script1, "0xbeef");
      expect(prevState).not.to.be.undefined;

      style.settings.scheduleScriptProps = script2;
      expect(style.scheduleScript).not.to.equal(prevState);
      expect(style.scheduleScript).not.to.be.undefined;
      style.expectScript(script2, "0xbeef");

      style.settings.scheduleScriptProps = undefined;
      expect(style.scheduleScript).to.be.undefined;
    });

    it("ignores renderTimeline if scheduleScriptProps is defined", async () => {
      const style = new Style();
      style.settings.scheduleScriptProps = script2;
      style.expectScript(script2, "0xbeef");

      await style.changeRenderTimeline("0x1");
      expect(style.settings.renderTimeline).to.equal("0x1");
      style.expectScript(script2, "0xbeef");

      const promise = new Promise<void>((resolve) => {
        let numCalls = 0;
        const removeListener = style.onScheduleScriptChanged.addListener((newScript) => {
          // Event is invoked immediately when we set schedule script to undefined, then asynchronously after we finish loading
          // the script from the RenderTimeline.
          ++numCalls;
          expect(undefined === newScript).to.equal(numCalls === 1);
          if (numCalls === 2) {
            removeListener();
            resolve();
          }
        });
      });

      style.scheduleScript = undefined;
      await promise;
      style.expectScript(script1, "0x1");

      style.settings.scheduleScriptProps = script2;
      style.expectScript(script2, "0xbeef");
    });

    it("raises onScheduleScriptReferenceChanged", async () => {
      const style = new Style();
      const expected: Array<RenderSchedule.ScriptReference | undefined> = [];
      function expectPayloads() {
        expect(style.eventPayloads).to.deep.equal(expected);
      }

      function pushExpected(expectNonNull = true) {
        expect(style.scheduleScript !== undefined).to.equal(expectNonNull);
        expected.push(style.scheduleScriptReference); // eslint-disable-line deprecation/deprecation
        expectPayloads();
      }

      await style.changeRenderTimeline("0x1");
      pushExpected();

      await style.changeRenderTimeline("0x2");
      pushExpected();

      await style.changeRenderTimeline("0x2");
      expectPayloads();

      style.settings.renderTimeline = "0x1";
      expectPayloads();
      await style.finishLoading();
      pushExpected();

      style.settings.renderTimeline = "0x1";
      expect(style.isLoading).to.be.false;
      expectPayloads();

      style.settings.scheduleScriptProps = script1;
      pushExpected();

      style.settings.scheduleScriptProps = undefined;
      await style.finishLoading();
      pushExpected();

      style.settings.renderTimeline = undefined;
      pushExpected(false);
    });

    it("ignores previous renderTimeline if reassigned while loading", async () => {
      const style = new Style();

      style.settings.renderTimeline = "0x1";
      expect(style.isLoading).to.be.true;
      await style.changeRenderTimeline("0x2");
      expect(style.isLoading).to.be.false;

      style.expectScript(script2, "0x2");
      expect(style.eventPayloads).to.deep.equal([style.scheduleScriptReference]); // eslint-disable-line deprecation/deprecation
    });

    it("is set to undefined if loadScheduleScriptReference produces an exception", async () => {
      const style = new Style();
      await style.changeRenderTimeline("0x1");
      style.expectScript(script1, "0x1");

      await style.changeRenderTimeline("0x3");
      expect(style.scheduleScriptReference).to.be.undefined; // eslint-disable-line deprecation/deprecation
    });
  });
});
