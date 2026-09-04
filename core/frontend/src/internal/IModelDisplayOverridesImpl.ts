/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ClipStyle, HiddenLine, ViewFlagOverrides } from "@itwin/core-common";
import { _implementationProhibited } from "../common/internal/Symbols";
import { IModelDisplayOverrides, IModelDisplayOverridesProps, SpatialIModelDisplayOverrides, SpatialIModelDisplayOverridesProps } from "../IModelDisplayOverrides";
import { BeEvent } from "@itwin/core-bentley";

class IModelDisplayOverridesImpl implements IModelDisplayOverrides {
  public readonly [_implementationProhibited] = undefined;

  #viewFlags: ViewFlagOverrides;
  #clipStyle?: ClipStyle;

  public readonly onViewFlagsChanged = new BeEvent<() => void>();
  public readonly onClipStyleChanged = new BeEvent<() => void>();

  public constructor(ovrs?: IModelDisplayOverridesProps) {
    this.#viewFlags = ovrs?.viewFlags ?? { };
    this.#clipStyle = ovrs?.clipStyle;
  }

  public get viewFlags() {
    return this.#viewFlags;
  }

  public set viewFlags(viewFlags: ViewFlagOverrides) {
    this.#viewFlags = viewFlags;
    this.onViewFlagsChanged.raiseEvent();
  }

  public get clipStyle() {
    return this.#clipStyle;
  }

  public set clipStyle(style: ClipStyle | undefined) {
    if (style !== this.#clipStyle) {
      this.#clipStyle = style;
      this.onClipStyleChanged.raiseEvent();
    }
  }
}

class SpatialIModelDisplayOverridesImpl extends IModelDisplayOverridesImpl implements SpatialIModelDisplayOverrides {
  #hline?: HiddenLine.Settings;

  public readonly onHiddenLineSettingsChanged = new BeEvent<() => void>();

  public constructor(ovrs?: SpatialIModelDisplayOverridesProps) {
    super(ovrs);
    this.#hline = ovrs?.hiddenLineSettings;
  }

  public get hiddenLineSettings() {
    return this.#hline;
  }

  public set hiddenLineSettings(hline: HiddenLine.Settings | undefined) {
    if (hline !== this.#hline) {
      this.#hline = hline;
      this.onHiddenLineSettingsChanged.raiseEvent();
    }
  }
}

export function createIModelDisplayOverrides(props?: IModelDisplayOverridesProps): IModelDisplayOverrides {
  return new IModelDisplayOverridesImpl(props);
}

export function createSpatialIModelDisplayOverrides(props?: SpatialIModelDisplayOverridesProps): SpatialIModelDisplayOverrides {
  return new SpatialIModelDisplayOverridesImpl(props);
}
