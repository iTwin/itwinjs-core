/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Widgets
 */

import { saveAs } from "file-saver";
import type { GLTimerResult, RenderSystemDebugControl } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { createCheckBox } from "../ui/CheckBox";

/** Trace Event Format, viewable with chrome://tracing
 * https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/edit
 */
interface ChromeTrace {
  traceEvents: ChromeTraceEvent[];
}

interface ChromeTraceEvent {
  /** Required by chrome://tracing  */
  pid: 1;
  /** Timestamp in microseconds */
  ts: number;
  /** Duration in microseconds */
  dur: number;
  /** Denotes "complete" event */
  ph: "X";
  /** Label for chrome://tracing view */
  name: string;
  /** dummy value, args must be defined for entries to be clickable in chrome://tracing */
  args: ChromeTraceEventArgs;
}

interface ChromeTraceEventArgs { 0: 0 }
const dummyArgs: ChromeTraceEventArgs = { 0: 0 }; // Reuse instead of allocating for each entry

/**
 * @param name Label for the trace event
 * @param start Timestamp in microseconds of when trace event started
 * @param duration Duration in microseconds of trace event
 */
function createTraceEvent(name: string, start: number, duration: number): ChromeTraceEvent {
  return {
    pid: 1,
    ts: start,
    dur: duration,
    ph: "X",
    name,
    args: dummyArgs,
  };
}

function createTraceFromTimerResults(timerResults: GLTimerResult[]): ChromeTrace {
  const traceEvents: ChromeTraceEvent[] = [];

  const addChildren = (startTime: number, children: GLTimerResult[]) => {
    for (const child of children) {
      if (child.nanoseconds < 100)
        continue;
      const microseconds = child.nanoseconds / 1E3;
      traceEvents.push(createTraceEvent(child.label, startTime, microseconds));
      if (child.children)
        addChildren(startTime, child.children);
      startTime += microseconds;
    }
  };

  let frameStartTime = 0;
  let frameNumber = 0;
  for (const tr of timerResults) {
    const microseconds = tr.nanoseconds / 1E3;
    traceEvents.push(createTraceEvent(`Frame ${frameNumber}`, frameStartTime, microseconds));
    if (tr.children)
      addChildren(frameStartTime, tr.children);
    frameStartTime += microseconds;
    ++frameNumber;
  }

  return { traceEvents };
}

/** @internal */
interface GpuProfilerResults {
  label: string;
  sum: number;
  paddingLeft: string;
  values: number[];
}

/** @alpha */
export class GpuProfiler {
  private readonly _div: HTMLDivElement;
  private readonly _resultsDiv: HTMLDivElement;
  private readonly _results: GpuProfilerResults[];
  private readonly _debugControl: RenderSystemDebugControl;

  private readonly _recordButton!: HTMLButtonElement;
  private _recordedResults: GLTimerResult[];
  private _isRecording: boolean;

  public constructor(parent: HTMLElement) {
    this._debugControl = IModelApp.renderSystem.debugControl!;

    const checkBox = createCheckBox({
      parent,
      name: "Profile GPU",
      id: "gpu-profiler-toggle",
      handler: (cb) => this.toggleProfileCheckBox(cb.checked),
    });

    if (!this._debugControl.isGLTimerSupported) {
      checkBox.checkbox.disabled = true;
      checkBox.div.title = "EXT_disjoint_timer_query is not available in this browser";
    }

    this._div = document.createElement("div");
    this._div.style.display = "none";

    this._recordButton = document.createElement("button");
    this._recordButton.style.textAlign = "center";
    this._isRecording = false;
    this._recordButton.innerText = "Record Profile";
    this._recordButton.title = "Record a profile to open with chrome://tracing";
    this._recordedResults = [];
    this._recordButton.addEventListener("click", this._clickRecord);
    this._div.appendChild(this._recordButton);

    this._results = [];
    this._resultsDiv = document.createElement("div");
    this._resultsDiv.style.textAlign = "left";
    this._div.appendChild(this._resultsDiv);

    parent.appendChild(this._div);
  }

  public dispose(): void {
    this._debugControl.resultsCallback = undefined;
  }

  private toggleProfileCheckBox(isEnabled: boolean): void {
    if (isEnabled) {
      this._debugControl.resultsCallback = this._resultsCallback;
      this._resultsDiv.innerHTML = "";
      this._div.style.display = "block";
    } else {
      this._debugControl.resultsCallback = undefined;
      this._div.style.display = "none";
      this.stopRecording();
    }
  }

  private _clickRecord = () => {
    if (!this._isRecording) {
      this._isRecording = true;
      this._recordButton.innerText = "Stop Recording";
      return;
    }

    this.stopRecording();
  };

  private stopRecording() {
    this._isRecording = false;
    this._recordButton.innerText = "Record Profile";

    if (this._recordedResults.length !== 0) {
      const chromeTrace = createTraceFromTimerResults(this._recordedResults);
      const blob = new Blob([JSON.stringify(chromeTrace)], { type: "application/json;charset=utf-8" });
      saveAs(blob, "gpu-profile.json");
      this._recordedResults = [];
    }
  }

  private _resultsCallback = (result: GLTimerResult): void => {
    if (this._isRecording)
      this._recordedResults.push(result);

    const fragment = document.createDocumentFragment();
    const numSavedFrames = 120;
    let lastValue: string;
    const changedResults = new Array<boolean>(this._results.length); // default values false
    const printDepth = (depth: number, currentRes: GLTimerResult) => {
      const index = this._results.findIndex((res) => res.label === currentRes.label);
      if (index < 0) { // Add brand new entry
        const data: GpuProfilerResults = {
          label: currentRes.label,
          paddingLeft: `${depth}em`,
          sum: currentRes.nanoseconds,
          values: [currentRes.nanoseconds],
        };
        if (lastValue === undefined) {
          this._results.unshift(data);
          changedResults.unshift(true);
        } else if (currentRes.label === "Read Pixels") {
          this._results.push(data); // Read Pixels should go at the end of the list
          changedResults.push(true);
        } else {
          const prevIndex = this._results.findIndex((res) => res.label === lastValue);
          this._results.splice(prevIndex + 1, 0, data);
          changedResults.splice(prevIndex + 1, 0, true);
        }
      } else { // Edit old entry
        let oldVal = 0.0;
        const savedResults = this._results[index];
        if (savedResults.values.length >= numSavedFrames) { // keep up to numSavedFrames values to average between
          oldVal = savedResults.values.shift()!;
        }
        const newVal = currentRes.nanoseconds < 100 ? 0.0 : currentRes.nanoseconds; // high-pass filter, empty queries have some noise
        savedResults.sum += newVal - oldVal;
        savedResults.values.push(newVal);
        changedResults[index] = true;
      }
      lastValue = currentRes.label;

      if (!currentRes.children)
        return;

      for (const childRes of currentRes.children)
        printDepth(depth + 1, childRes);
    };
    printDepth(0, result);

    this._results.forEach((value, index) => {
      if (!changedResults[index]) { // if no data received on this item, add a value of 0.0 to the avg.
        const oldVal = value.values.length >= numSavedFrames ? value.values.shift()! : 0.0;
        value.sum -= oldVal;
        value.values.push(0.0);
      }
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.width = "75%";
      const textLabel = document.createElement("text");
      textLabel.innerText = `${value.label}`;
      textLabel.style.paddingLeft = value.paddingLeft;
      div.appendChild(textLabel);
      const divLine = document.createElement("div");
      divLine.style.flexGrow = "1";
      divLine.style.borderBottom = "dotted 1px";
      div.appendChild(divLine);
      const textValue = document.createElement("text");
      textValue.innerText = `${(value.sum / value.values.length / 1.E6).toFixed(3)} ms\n`;
      div.appendChild(textValue);
      fragment.appendChild(div);
    });

    this._resultsDiv.innerHTML = "";
    this._resultsDiv.appendChild(fragment);
  };
}
