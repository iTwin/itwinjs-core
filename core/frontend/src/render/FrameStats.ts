/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** Describes timing statistics for a single rendered frame. Aside from `frameId`, `totalFrameTime`, and `sceneTime`, the other entries may represent operations that are not performed every frame and may contain an expected value of zero.
 * @note By default, the display system does not render frames continuously. The display system will render a new frame only when the view changes. Therefore, the data contained within this interface cannot directly be used to compute a representative framerate.
 * @alpha
 */
export interface FrameStats {
  /** A unique number identifying the frame to which these statistics belong. */
  readonly frameId: number;
  /** The CPU time in milliseconds spent rendering the frame. */
  readonly totalFrameTime: number;
  /** The CPU time in milliseconds spent setting up the scene. The includes the following:
   * - performing animations
   * - setting up from view
   * - setting the hilite set
   * - overriding feature symbology
   * - creating and changing the scene if invalid
   * - validating render plan
   * - adding decorations
   * - processing flash
   */
  readonly sceneTime: number;
  /** The CPU time in milliseconds spent rendering opaque geometry. */
  readonly opaqueTime: number;
  /** The CPU time in milliseconds spent rendering translucent geometry. */
  readonly translucentTime: number;
  /** The CPU time in milliseconds spent rendering overlays. */
  readonly overlaysTime: number;
  /** The CPU time in milliseconds spent rendering the solar shadow map. */
  readonly shadowsTime: number;
  /** The CPU time in milliseconds spent rendering both planar and volume classifiers. */
  readonly classifiersTime: number;
  /** The CPU time in milliseconds spent applying screenspace effects. */
  readonly screenspaceEffectsTime: number;
  /** The CPU time in milliseconds spent rendering background geometry including backgrounds, skyboxes, and background maps. */
  readonly backgroundTime: number;
}

/** A callback which will receive a frame statistics object.
 * @see [[Viewport.enableFrameStatsCallback]]
 * @alpha
 */
export type FrameStatsCallback = (stats: FrameStats) => void;

/** @internal */
export class FrameStatsCollector {
  private _frameStatsMap = new Map<string, number>();
  private _frameStatsCallback?: FrameStatsCallback;
  private _sceneTime = 0;
  private _frameId = 0;
  private _shouldRecordFrame = false;

  private _clearStats() {
    this._frameStatsMap.clear();
    this._sceneTime = 0;
  }

  private _getFrameStatsMapEntry(entry: keyof FrameStats): number {
    const entryValue = this._frameStatsMap.get(entry);
    if (undefined === entryValue)
      return 0;
    return entryValue;
  }

  private _createStatsFromMap(): FrameStats {
    return {
      frameId: this._frameId,
      totalFrameTime: this._getFrameStatsMapEntry("totalFrameTime"),
      sceneTime: this._sceneTime,
      opaqueTime: this._getFrameStatsMapEntry("opaqueTime"),
      translucentTime: this._getFrameStatsMapEntry("translucentTime"),
      overlaysTime: this._getFrameStatsMapEntry("overlaysTime"),
      shadowsTime: this._getFrameStatsMapEntry("shadowsTime"),
      classifiersTime: this._getFrameStatsMapEntry("classifiersTime"),
      screenspaceEffectsTime: this._getFrameStatsMapEntry("screenspaceEffectsTime"),
      backgroundTime: this._getFrameStatsMapEntry("backgroundTime"),
    };
  }

  public set frameStatsCallback(cb: FrameStatsCallback | undefined) { this._frameStatsCallback = cb; }
  public get frameStatsCallback(): FrameStatsCallback | undefined { return this._frameStatsCallback; }

  private _begin(entry: keyof FrameStats) {
    let prevSpan = this._frameStatsMap.get(entry);
    if (undefined === prevSpan)
      prevSpan = 0;
    this._frameStatsMap.set(entry, Date.now() - prevSpan);
  }

  private _end(entry: keyof FrameStats) {
    const beginTime = this._frameStatsMap.get(entry);
    if (undefined === beginTime)
      this._frameStatsMap.set(entry, 0);
    else
      this._frameStatsMap.set(entry, Date.now() - beginTime);
  }

  public beginFrame(sceneMilSecElapsed = 0) {
    this._shouldRecordFrame = this._frameStatsCallback !== undefined;
    if (this._shouldRecordFrame) {
      this._begin("totalFrameTime");
      this._sceneTime = sceneMilSecElapsed;
    }
  }

  public endFrame() {
    if (this._shouldRecordFrame) {
      this._end("totalFrameTime");
      if (this._frameStatsCallback !== undefined)
        this._frameStatsCallback(this._createStatsFromMap()); // copy this frame's statistics to the callback
      this._frameId++; // increment frame counter for next pending frame
      this._clearStats();
    }
  }

  public beginTime(entry: keyof FrameStats) {
    if (this._shouldRecordFrame)
      this._begin(entry);
  }

  public endTime(entry: keyof FrameStats) {
    if (this._shouldRecordFrame)
      this._end(entry);
  }
}
