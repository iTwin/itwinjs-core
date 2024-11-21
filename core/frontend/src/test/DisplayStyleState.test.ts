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
        this.onScheduleScriptReferenceChanged.addListener((ref) => this.eventPayloads.push(ref)); // eslint-disable-line @typescript-eslint/no-deprecated
      }

      public expectScript(props: RenderSchedule.ScriptProps, sourceId: string): void {
        expect(this.scheduleScript).toBeDefined();
        expect(this.scheduleScriptReference!.sourceId).toEqual(sourceId); // eslint-disable-line @typescript-eslint/no-deprecated
        expect(this.scheduleScript!.modelTimelines[0].modelId).toEqual(props[0].modelId);
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
      expect(style.scheduleScript).toBeUndefined();

      style.settings.renderTimeline = "0x1";
      expect(style.isLoading).toBe(true);
      expect(style.settings.renderTimeline).toEqual("0x1");
      expect(style.scheduleScript).toBeUndefined();

      await style.finishLoading();
      expect(style.isLoading).toBe(false);
      style.expectScript(script1, "0x1");
      let state = style.scheduleScript;

      style.settings.renderTimeline = "0x2";
      expect(style.isLoading).toBe(true);
      expect(style.scheduleScript).toEqual(state);

      await style.finishLoading();
      expect(style.isLoading).toBe(false);
      expect(style.scheduleScript).not.toEqual(state);
      state = style.scheduleScript;
      style.expectScript(script2, "0x2");

      style.settings.renderTimeline = "0x2";
      expect(style.isLoading).toBe(false);
      expect(style.scheduleScript).toEqual(state);

      style.settings.renderTimeline = undefined;
      expect(style.isLoading).toBe(false);
      expect(style.scheduleScript).toBeUndefined();
    });

    it("updates when scheduleScriptProps changes", () => {
      const style = new Style();
      expect(style.scheduleScript).toBeUndefined();
      expect(style.settings.scheduleScriptProps).toBeUndefined();

      style.settings.scheduleScriptProps = script1;
      const prevState = style.scheduleScript;
      style.expectScript(script1, "0xbeef");
      expect(prevState).toBeDefined();

      style.settings.scheduleScriptProps = script2;
      expect(style.scheduleScript).not.toEqual(prevState);
      expect(style.scheduleScript).toBeDefined();
      style.expectScript(script2, "0xbeef");

      style.settings.scheduleScriptProps = undefined;
      expect(style.scheduleScript).toBeUndefined();
    });

    it("ignores renderTimeline if scheduleScriptProps is defined", async () => {
      const style = new Style();
      style.settings.scheduleScriptProps = script2;
      style.expectScript(script2, "0xbeef");

      await style.changeRenderTimeline("0x1");
      expect(style.settings.renderTimeline).toEqual("0x1");
      style.expectScript(script2, "0xbeef");

      const promise = new Promise<void>((resolve) => {
        let numCalls = 0;
        const removeListener = style.onScheduleScriptChanged.addListener((newScript) => {
          // Event is invoked immediately when we set schedule script to undefined, then asynchronously after we finish loading
          // the script from the RenderTimeline.
          ++numCalls;
          expect(undefined === newScript).toEqual(numCalls === 1);
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
        expect(style.eventPayloads).toEqual(expected);
      }

      function pushExpected(expectNonNull = true) {
        expect(style.scheduleScript !== undefined).toEqual(expectNonNull);
        expected.push(style.scheduleScriptReference); // eslint-disable-line @typescript-eslint/no-deprecated
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
      expect(style.isLoading).toBe(false);
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
      expect(style.isLoading).toBe(true);
      await style.changeRenderTimeline("0x2");
      expect(style.isLoading).toBe(false);

      style.expectScript(script2, "0x2");
      expect(style.eventPayloads).toEqual([style.scheduleScriptReference]); // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("is set to undefined if loadScheduleScriptReference produces an exception", async () => {
      const style = new Style();
      await style.changeRenderTimeline("0x1");
      style.expectScript(script1, "0x1");

      await style.changeRenderTimeline("0x3");
      expect(style.scheduleScriptReference).toBeUndefined(); // eslint-disable-line @typescript-eslint/no-deprecated
    });
  });
});
