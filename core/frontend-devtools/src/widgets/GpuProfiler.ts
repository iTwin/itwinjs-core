/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { GLTimerResult, IModelApp, RenderSystemDebugControl } from "@bentley/imodeljs-frontend";
import { createCheckBox } from "../ui/CheckBox";
import { saveAs } from "file-saver";

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

interface ChromeTraceEventArgs { 0: 0; }
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

/** @alpha */
export class GpuProfiler {
  private readonly _div: HTMLDivElement;
  private readonly _resultsDiv: HTMLDivElement;
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

    this._div = document.createElement("div") as HTMLDivElement;
    this._div.style.display = "none";

    this._recordButton = document.createElement("button") as HTMLButtonElement;
    this._recordButton.style.textAlign = "center";
    this._isRecording = false;
    this._recordButton.innerText = "Record Profile";
    this._recordButton.title = "Record a profile to open with chrome://tracing";
    this._recordedResults = [];
    this._recordButton.addEventListener("click", this._clickRecord);
    this._div.appendChild(this._recordButton);

    this._resultsDiv = document.createElement("div") as HTMLDivElement;
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
  }

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

    const printDepth = (depth: number, currentRes: GLTimerResult) => {
      if (currentRes.nanoseconds < 100) // high-pass filter, empty queries have some noise
        return;

      const text = document.createElement("text");
      text.innerText = `${currentRes.label}: ${currentRes.nanoseconds / 1.E6}ms\n`;
      text.style.paddingLeft = depth + "em";
      fragment.appendChild(text);

      if (!currentRes.children)
        return;

      for (const childRes of currentRes.children)
        printDepth(depth + 1, childRes);
    };
    printDepth(0, result);

    this._resultsDiv.innerHTML = "";
    this._resultsDiv.appendChild(fragment);
  }
}
