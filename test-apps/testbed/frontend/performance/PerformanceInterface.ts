/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export interface PerformanceData {
  tileLoadingTime: number;
  scene: number;
  garbageExecute: number;
  initCommands: number;
  backgroundDraw: number;
  skybox: number;
  terrain: number;
  setClips: number;
  opaqueDraw: number;
  translucentDraw: number;
  hiliteDraw: number;
  compositeDraw: number;
  overlayDraw: number;
  renderFrameTime: number;
  glFinish: number;
  totalTime: number;
}

export interface PerformanceDataEntry {
  imodelName: string;
  viewName: string;
  viewFlags: string;
  data: PerformanceData;
}
