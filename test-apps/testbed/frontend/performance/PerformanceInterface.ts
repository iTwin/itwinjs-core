/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export interface PerformanceData {
  tileLoadingTime: number;
  scene: number;
  garbageExecute: number;
  initCommands: number;
  backgroundDraw: number;
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
