/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Camera } from "@itwin/core-common";
import { IModelConnection, Viewport } from "@itwin/core-frontend";
import { Angle, AngleProps, Point3d, Vector3d, XYZProps } from "@itwin/core-geometry";
import { createButton, createTextBox } from "@itwin/frontend-devtools";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { ToolBarDropDown } from "./ToolBar";

interface KeyframeProps {
  time: number;
  location: XYZProps;
  target: XYZProps;
  up: XYZProps;
  lensAngle: AngleProps | undefined;
  extents: XYZProps | undefined;
}

class Keyframe {
  /// Position in time (ms) of the keyframe
  public time: number;

  /// Location of the camera
  public location: Point3d;

  /// Point to look at
  public target: Point3d;

  /// Up vector
  public up: Vector3d;

  /// Lens angle, undefined for ortho camera
  public lensAngle: Angle | undefined;

  /// View extent, undefined for perspective camera
  public extents: Vector3d | undefined;

  constructor(time: number, location: Point3d, target: Point3d, up: Vector3d, lensAngle: Angle | undefined, extents: Vector3d | undefined) {
    this.time = time;
    this.location = location;
    this.target = target;
    this.up = up;
    this.lensAngle = lensAngle;
    this.extents = extents;
  }

  public clone(): Keyframe {
    return new Keyframe(
      this.time,
      this.location.clone(),
      this.target.clone(),
      this.up.clone(),
      this.lensAngle?.clone(),
      this.extents?.clone(),
    );
  }

  public static createZero(): Keyframe {
    return new Keyframe(0, Point3d.createZero(), Point3d.createZero(), Vector3d.createZero(), undefined, undefined);
  }

  /**
   * Perform linear interpolation of the keyframe with another keyframe.
   */
  public interpolate(fraction: number, other: Keyframe): Keyframe {
    let lensAngle;
    if (this.lensAngle === undefined) {
      lensAngle = other.lensAngle;
    } else {
      lensAngle = other.lensAngle !== undefined ? Angle.createInterpolate(this.lensAngle, fraction, other.lensAngle) : this.lensAngle;
    }

    let extent;
    if (this.extents === undefined) {
      extent = other.extents;
    } else {
      extent = other.extents !== undefined ? this.extents.interpolate(fraction, other.extents) : other.extents;
    }

    return new Keyframe(
      this.time + fraction * (other.time - this.time),
      this.location.interpolate(fraction, other.location),
      this.target.interpolate(fraction, other.target),
      this.up.interpolate(fraction, other.up),
      lensAngle,
      extent,
    );
  }

  public static fromJSON(json?: KeyframeProps): Keyframe {
    if (!json)
      return Keyframe.createZero();

    return new Keyframe(
      json.time,
      Point3d.fromJSON(json.location),
      Point3d.fromJSON(json.target),
      Vector3d.fromJSON(json.up),
      json.lensAngle !== undefined ? Angle.fromJSON(json.lensAngle) : undefined,
      json.extents !== undefined ? Vector3d.fromJSON(json.extents) : undefined);
  }

  public toJSON(): KeyframeProps {
    return {
      time: this.time,
      location: this.location.toJSON(),
      target: this.target.toJSON(),
      up: this.up.toJSON(),
      lensAngle: this.lensAngle?.toJSON(),
      extents: this.extents?.toJSON(),
    };
  }
}

interface CameraPathProps {
  name: string;
  duration: number;
  keyframes: Array<KeyframeProps>;
}

class CameraPath {
  public name: string;
  public duration: number;
  private _keyframes = new Array<Keyframe>();

  public get keyframes() {
    return this._keyframes;
  }

  constructor(name: string, duration: number, keyframes?: Array<Keyframe>) {
    this.name = name;
    this.duration = duration;

    if (!!keyframes) {
      this._keyframes = keyframes;
      this.sortKeyframes();
    }
  }

  public clone(): CameraPath {
    return new CameraPath(this.name, this.duration, this.keyframes.map((keyframe) => keyframe.clone()));
  }

  public static createEmpty(): CameraPath {
    return new CameraPath("", 0, []);
  }

  /**
   * Ensure that keyframes are sorted by time
   */
  public sortKeyframes() {
    this.keyframes.sort((a, b) => a.time - b.time);
  }

  /**
   * Remove keyframes that can be reconstructed with interpolation within the given error range.
   */
  public simplifies(distanceThreshold: number, lensAngleThreshold: Angle, extentThreshold: number): void {
    let i = 1;
    while (i < this.keyframes.length - 1) {
      const [before, current, after] = this.keyframes.slice(i - 1, i + 2);
      const fraction =  (current.time - before.time) / (after.time - before.time);
      const interpolated = before.interpolate(fraction, after);

      // Check if the distances between the reconstructed keyframe and the original is acceptable
      const sameCameraType = (interpolated.lensAngle === undefined) === (current.lensAngle === undefined);
      const locationDistance = interpolated.location.distance(current.location);
      const targetDistance = interpolated.target.distance(current.target);
      const lensAngleDistance = (interpolated.lensAngle === undefined || !sameCameraType) ? 0 : Math.abs(interpolated.lensAngle.degrees - current.lensAngle!.degrees);
      const extentDistance = (interpolated.extents !== undefined && current.extents !== undefined) ? interpolated.extents.distance(current.extents) : 0;

      if (sameCameraType
        && locationDistance < distanceThreshold
        && targetDistance < distanceThreshold
        && lensAngleDistance < lensAngleThreshold.degrees
        && extentDistance < extentThreshold) {
        this.keyframes.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * Get the interpolated keyframe at a given time in the path.
   * @param time In ms, the location in the timeline to get the keyframe at.
   * @returns the interpolated keyframe.
   */
  public getKeyframeAtTime(time: number): Keyframe {
    const {before, after} = this.getKeyframeRangeAtTime(time);

    // Only one keyframe, use it directly
    if (after === undefined)
      return before;

    // Two keyframes: interpolate between them
    const timeDifference = after.time - before.time;
    const fraction = timeDifference !== 0 ? (time - before.time) / timeDifference : 0.0;

    return before.interpolate(fraction, after);
  }

  /**
   * Get the two closest keyframes to a given time in the path. One before, one after.
   * @param time In ms, the location in the timeline to get the keyframe at.
   * @returns an object with the keyframes. ``before`` will always be set, but ``after`` can be missing.
   */
  private getKeyframeRangeAtTime(time: number): {before: Keyframe, after?: Keyframe} {
    if (this.keyframes.length <= 0)
      throw new Error("Selected path has no keyframes.");

    // Only one keyframe or before first keyframe
    if (this.keyframes.length === 1 || time < this.keyframes[0].time) {
      return {before: this.keyframes[0]};
    }

    // Between two keyframes
    for (let i = 1; i < this.keyframes.length; i++) {
      if (time < this.keyframes[i].time)
        return {before: this.keyframes[i - 1], after: this.keyframes[i]};
    }

    // After the last keyframe
    return {before: this.keyframes[this.keyframes.length - 1]};
  }

  public static fromJSON(json?: CameraPathProps): CameraPath {
    if (!json)
      return CameraPath.createEmpty();

    return new CameraPath(
      json.name,
      json.duration,
      json.keyframes.map((keyframeProps) => Keyframe.fromJSON(keyframeProps)),
    );
  }

  public toJSON(): CameraPathProps {
    return {
      name: this.name,
      duration: this.duration,
      keyframes: this.keyframes.map((frame) => frame.toJSON()),
    };
  }
}

export class CameraPathsMenu extends ToolBarDropDown {
  private readonly _element: HTMLElement;
  private readonly _viewport: Viewport;
  private _imodel: IModelConnection;

  private _paths: Array<CameraPath>;
  private _selectedPath?: CameraPath | undefined;
  private _onStateChanged = () => {};
  private _newPathName: string;

  private _isPlaying: boolean;
  private _isRecording: boolean;

  private _animID: number;
  private _previousAnimationFrame: number | undefined;
  private _currentAnimationTime: number;

  public get selectedPath(): CameraPath | undefined {
    return this._selectedPath;
  }

  public set selectedPath(value: CameraPath | undefined) {
    this._selectedPath = value;
    this._onStateChanged();
  }

  public constructor(viewport: Viewport, parent: HTMLElement) {
    super();

    this._viewport = viewport;
    this._imodel = viewport.iModel;

    this._newPathName = "";
    this._paths = [];

    this._isPlaying = false;
    this._isRecording = false;
    this._animID = 0;
    this._previousAnimationFrame = undefined;
    this._currentAnimationTime = 0;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.width = "300px";
    this._element.style.overflowX = "none";

    parent.appendChild(this._element);
  }

  public get isOpen() { return "none" !== this._element.style.display; }
  protected _open() { this._element.style.display = "block"; }
  protected _close() { this._element.style.display = "none"; }

  public override get onViewChanged(): Promise<void> | undefined {
    if (this._imodel !== this._viewport.iModel) {
      this._imodel = this._viewport.iModel;
      return this.populate();
    } else {
      return undefined;
    }
  }

  public async populate(): Promise<void> {
    if (!this._viewport.iModel.isOpen)
      return;

    await this.loadPathsFromExternalFile();

    await this.populateFromPathList();
  }

  private async populateFromPathList(): Promise<void> {
    this.clearContent();

    const pathNameTextBox = createTextBox({
      id: "txt_pathName",
      parent: this._element,
      tooltip: "Name of new camera path to create",
      keypresshandler: async (_tb, ev): Promise<void> => {
        ev.stopPropagation();
        if ("Enter" === ev.key) {
          if (await this.appendNewPathToPathList())
            await this.savePathsToExternalFile();
        }
      },
    });

    pathNameTextBox.div.style.marginLeft = pathNameTextBox.div.style.marginRight = "3px";
    pathNameTextBox.textbox.size = 36;
    pathNameTextBox.textbox.value = this._newPathName;
    this._element.appendChild(document.createElement("hr"));

    const pathsList = document.createElement("select");
    // If only 1 entry in list, input becomes a combo box and can't select the view...
    pathsList.size = 1 === this._paths.length ? 2 : Math.min(15, this._paths.length);
    pathsList.style.width = "100%";
    pathsList.style.display = 0 < this._paths.length ? "" : "none";

    this._element.appendChild(pathsList);
    this._element.onchange = () => this.selectedPath = pathsList.value ? this.findPath(pathsList.value) : undefined;
    pathsList.addEventListener("keyup", async (ev) => {
      if (ev.key === "Delete")
        await this.deletePath();
    });

    for (const path of this._paths) {
      const option = document.createElement("option");
      option.value = option.innerText = path.name;
      if (path.duration === 0 || path.keyframes.length === 0) {
        option.style.color = "grey";
        option.title = "This path is empty. Please use the record button to record it.";
      }
      pathsList.appendChild(option);
    }

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";

    const createPathButton = createButton({
      parent: buttonDiv,
      id: "btn_createCameraPath",
      value: "Create",
      handler: async () => {
        if (await this.appendNewPathToPathList())
          await this.savePathsToExternalFile();
      },
      tooltip: "Create a new camera path",
      inline: true,
    }).button;

    const deletePathButton = createButton({
      parent: buttonDiv,
      id: "btn_deleteCameraPath",
      value: "Delete",
      handler: async () => {
        if (await this.deletePath())
          await this.savePathsToExternalFile();
      },
      tooltip: "Delete selected camera path",
      inline: true,
    }).button;

    buttonDiv.appendChild(document.createElement("hr"));

    const recordButton = createButton({
      parent: buttonDiv,
      id: "btn_recordCameraPath",
      value: "Record",
      handler: async () => this.play(true),
      tooltip: "Record a camera path",
      inline: true,
    }).button;

    const playButton = createButton({
      parent: buttonDiv,
      id: "btn_playCameraPath",
      value: "Play",
      handler: async () => this.play(false),
      tooltip: "Play selected camera path",
      inline: true,
    }).button;

    const stopButton = createButton({
      parent: buttonDiv,
      id: "btn_stopCameraPath",
      value: "Stop",
      handler: async () => this.stop(),
      tooltip: "Stop running camera path",
      inline: true,
    }).button;

    const setCreatePathButtonDisabled = () => {
      const pathExist = this._paths.findIndex((path) => path.name === this._newPathName) !== -1;
      const isPathNameValid = this._newPathName.length > 0 && !pathExist;

      pathNameTextBox.textbox.style.color = isPathNameValid ? "" : "red";
      createPathButton.disabled = !isPathNameValid;
    };

    pathNameTextBox.textbox.onkeyup = () => {
      this._newPathName = pathNameTextBox.textbox.value;
      setCreatePathButtonDisabled();
    };

    this._onStateChanged = () => {
      if (this.selectedPath === undefined) {
        playButton.disabled = recordButton.disabled = stopButton.disabled = deletePathButton.disabled = true;
        pathsList.disabled = false;
      } else {
        const canRecord = this.selectedPath.duration === 0 || this.selectedPath.keyframes.length === 0;
        playButton.disabled = this._isPlaying || canRecord;
        recordButton.disabled = this._isPlaying || !canRecord;
        stopButton.disabled = !this._isPlaying;
        pathsList.disabled = this._isPlaying;
        deletePathButton.disabled = false;
      }

      setCreatePathButtonDisabled();
    };

    this._onStateChanged();

    this._element.appendChild(buttonDiv);
  }

  private clearContent(): void {
    while (this._element.hasChildNodes())
      this._element.removeChild(this._element.firstChild!);
    this._onStateChanged = () => {};
  }

  private async deletePath(): Promise<boolean> {
    if (this.selectedPath === undefined)
      return false;

    const index = this._paths.indexOf(this.selectedPath);
    if (index > -1) {
      this._paths.splice(index, 1);
      this.selectedPath = undefined;
      await this.populateFromPathList();
      return true;
    }

    return false;
  }

  private async appendNewPathToPathList(): Promise<boolean> {
    const pathExist = this._paths.findIndex((path) => path.name === this._newPathName) !== -1;
    if (this._newPathName.length > 0 && !pathExist) {
      this._paths.push(CameraPath.createEmpty());
      this.selectedPath = this._paths[this._paths.length - 1];
      this.selectedPath.name = this._newPathName;
      this._newPathName = "";
      await this.populateFromPathList();
      return true;
    }

    return false;
  }

  private async loadPathsFromExternalFile() {
    const filename = this._viewport.view.iModel.key;
    const externalCameraPathsString = await DtaRpcInterface.getClient().readExternalCameraPaths(filename);

    try {
      this._paths = JSON.parse(externalCameraPathsString).map((path: CameraPathProps) => CameraPath.fromJSON(path));
    } catch (_e) {
      this._paths = [];
    }
  }

  private async savePathsToExternalFile(): Promise<void> {
    const filename = this._viewport.view.iModel.key;
    if (undefined === filename)
      return;

    const namedViews = JSON.stringify(this._paths.map((path) => path.toJSON()));
    await DtaRpcInterface.getClient().writeExternalCameraPaths(filename, namedViews);
  }

  private findPath(name: string): CameraPath | undefined {
    const index = this._paths.findIndex((path) => name === path.name);
    return -1 !== index ? this._paths[index]! : undefined;

  }

  public prepareView(record = false): void {
    if (!this.selectedPath)
      throw new Error("No valid camera path loaded");

    this._viewport.setAnimator(undefined);

    if (!record) {
      // This line prevents a bug that occurs in orthographic views if no camera has been set before.
      // If not using a perspective camera, it will be turned off at the first frame.
      this._viewport.turnCameraOn();
    }

    this._viewport.synchWithView();
  }

  public play(record = false): void {
    if (this._isPlaying)
      this.stop();

    this._previousAnimationFrame = undefined;
    this._currentAnimationTime = 0;

    if (this.selectedPath === undefined)
      return;

    this.selectedPath.sortKeyframes();

    const animate = (timestamp: number) => {
      const elapsed = this._previousAnimationFrame ? timestamp - this._previousAnimationFrame : 0;
      this._currentAnimationTime += elapsed;

      this.computeAnimationFrame();

      this._previousAnimationFrame = timestamp;

      if (this._isPlaying)
        this._animID = requestAnimationFrame(animate);
    };

    this.prepareView(record);
    this._animID = requestAnimationFrame(animate);

    this._isPlaying = true;
    this._isRecording = record;
    this._onStateChanged();
  }

  public stop(): void {

    if (this._animID) {
      cancelAnimationFrame(this._animID);
    }

    // End of recording
    if (this._isPlaying && this._isRecording) {
      if (!this.selectedPath)
        throw new Error("No valid camera path loaded");

      this.selectedPath.duration = this._currentAnimationTime;

      // Remove keyframes that we can easily interpolate with a decent error range
      this.selectedPath.simplifies(0.005, Angle.createDegrees(1.0), 0.01);

      void this.savePathsToExternalFile();
      void this.populateFromPathList();
    }

    this._animID = 0;
    this._isPlaying = false;
    this._isRecording = false;
    this._currentAnimationTime = 0;
    this._previousAnimationFrame = undefined;
    this._onStateChanged();
  }

  private computeAnimationFrame(): void {
    if (!this.selectedPath) {
      this.endAnimation();
      return;
    }

    if (this._isRecording) {
      this.recordAnimationFrame();
    } else {
      this.playAnimationFrame();

      if (this._currentAnimationTime > this.selectedPath.duration)
        this.endAnimation();
    }

  }

  private playAnimationFrame(): void {
    if (!this.selectedPath)
      throw new Error("No valid camera path loaded");

    this._viewport.setAnimator(undefined);
    const keyframe = this.selectedPath.getKeyframeAtTime(this._currentAnimationTime);
    this.setCameraPosition(keyframe);
  }

  private recordAnimationFrame(): void {
    if (!this.selectedPath)
      throw new Error("No valid camera path loaded");

    const view = this._viewport.view;
    if (!view.is3d() || !view.supportsCamera())
      throw new Error("Invalid view for camera path");

    // TODO: Handle global coordinates
    const location = this._viewport.npcToWorld(new Point3d(0.5, 0.5, 1.0));
    const target = this._viewport.npcToWorld(new Point3d(0.5, 0.5, 0.0));

    // Location and target are the same, the keyframe will be invalid
    if (target.distance(location) <= Number.EPSILON)
      return;

    const topScreen = this._viewport.npcToWorld(new Point3d(0.5, 1.0, 0.0));
    const up = location.unitVectorTo(topScreen);
    if (up === undefined)
      return;

    const lensAngle = view.isCameraOn ? view.camera.getLensAngle().clone() : undefined;
    const extents = view.isCameraOn ? undefined : view.getExtents().clone();

    this.selectedPath.keyframes.push(new Keyframe(this._currentAnimationTime, location, target, up, lensAngle, extents));
  }

  private endAnimation(): void {
    this.stop();
  }

  private setCameraPosition(keyframe: Keyframe) {
    const view = this._viewport.view;
    if (!view.is3d() || !view.supportsCamera())
      throw new Error("Invalid view for camera path");

    // TODO: Handle global coordinates
    if (keyframe.lensAngle !== undefined) {
      const lensAngle = keyframe.lensAngle.clone();
      Camera.validateLensAngle(lensAngle);

      // Perspective
      view.lookAt(
        {
          eyePoint: keyframe.location,
          targetPoint: keyframe.target,
          upVector: keyframe.up,
          lensAngle,
        },
      );

    } else {
      if (keyframe.extents === undefined)
        throw new Error("Invalid keyframe for camera: path should specifies either lensAngle or extents.");

      // Orthographic camera
      view.lookAt(
        {
          eyePoint: keyframe.location,
          viewDirection: (keyframe.target.minus(keyframe.location)),
          upVector: keyframe.up,
          newExtents: keyframe.extents,
        },
      );
    }

    this._viewport.synchWithView({noSaveInUndo: true});
  }
}
