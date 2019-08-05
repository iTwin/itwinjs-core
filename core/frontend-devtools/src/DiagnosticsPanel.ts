/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ToolSettingsTracker } from "./ToolSettingsTracker";
import { FpsTracker } from "./FpsTracker";
import { MemoryTracker } from "./MemoryTracker";
import { StatsTracker } from "./TileStatisticsTracker";
import { createCheckBox, CheckBox } from "./CheckBox";
import { createComboBox } from "./ComboBox";
import { ChangeFlag, ChangeFlags, PrimitiveVisibility, Target, Tile, Viewport } from "@bentley/imodeljs-frontend";
import { FrustumDecorator } from "./FrustumDecoration";
import { toggleProjectExtents } from "./ProjectExtents";
import { KeyinHandler } from "./KeyinHandler";

const flagNames: Array<[ChangeFlag, string]> = [
  [ChangeFlag.AlwaysDrawn, "Always Drawn"],
  [ChangeFlag.NeverDrawn, "Never Drawn"],
  [ChangeFlag.ViewedCategories, "Categories"],
  [ChangeFlag.ViewedModels, "Models"],
  [ChangeFlag.DisplayStyle, "DisplayStyle"],
  [ChangeFlag.FeatureOverrideProvider, "FeatureOverrideProvider"],
];

function onViewportChanged(_vp: Viewport, flags: ChangeFlags): void {
  const names = [];
  if (flags.areAllSet(ChangeFlag.All)) {
    names.push("All");
  } else {
    for (const flagName of flagNames)
      if (flags.isSet(flagName[0]))
        names.push(flagName[1]);
  }

  if (flags.areFeatureOverridesDirty)
    names.push("FeatureOverrides");

  const msg = "Changed: " + names.join();
  console.log(msg); // tslint:disable-line
}

/** @alpha */
export class DiagnosticsPanel {
  private readonly _viewport: Viewport;
  private readonly _element: HTMLElement;
  private readonly _parentElement?: HTMLElement;
  private readonly _fpsTracker: FpsTracker;
  private readonly _memoryTracker: MemoryTracker;
  private readonly _statsTracker: StatsTracker;
  private readonly _toolSettingsTracker: ToolSettingsTracker;
  private readonly _keyinHandler: KeyinHandler;
  private readonly _frustumCheckbox: CheckBox;
  private readonly _projectExtentsCheckbox: CheckBox;
  private readonly _removeEventListener: () => void;

  public constructor(vp: Viewport) {
    this._viewport = vp;
    this._element = document.createElement("div");
    this._element.className = "debugPanel";

    this._fpsTracker = new FpsTracker(this._element, vp);

    this._projectExtentsCheckbox = createCheckBox({
      parent: this._element,
      name: "Project Extents",
      handler: (cb) => toggleProjectExtents(vp.iModel, cb.checked),
      id: "debugPanel_projectExtents",
      tooltip: "Draw a box representing the project extents",
    });

    createCheckBox({
      parent: this._element,
      name: "Freeze Scene",
      handler: (cb) => this._viewport.freezeScene = cb.checked,
      id: "debugPanel_freezeScene",
    });

    this._frustumCheckbox = createCheckBox({
      parent: this._element,
      name: "Frustum Snapshot",
      handler: (cb) => this.toggleFrustumSnapshot(cb.checked),
      id: "debugPanel_frustumSnapshot",
      tooltip: "Draw the current frustum as a decoration graphic",
    });

    this._frustumCheckbox.div.style.display = this._projectExtentsCheckbox.div.style.display = vp.view.isSpatialView() ? "block" : "none";

    createCheckBox({
      parent: this._element,
      name: "Log viewport state changes",
      handler: (cb) => {
        if (cb.checked)
          this._viewport.onViewportChanged.addListener(onViewportChanged);
        else
          this._viewport.onViewportChanged.removeListener(onViewportChanged);
      },
      id: "debugPanel_logViewportChanges",
      tooltip: "Output Viewport.onViewportChanged events to the console",
    });

    this.addBoundingBoxDropdown(this._element);
    this.addVisibilityDropdown(this._element);

    this.addSeparator();
    this._statsTracker = new StatsTracker(this._element, vp);

    this.addSeparator();
    this._memoryTracker = new MemoryTracker(this._element, vp);

    this.addSeparator();
    this._toolSettingsTracker = new ToolSettingsTracker(this._element, vp);

    this.addSeparator();
    this._keyinHandler = new KeyinHandler(this._element, vp);

    this._removeEventListener = vp.onChangeView.addListener(() => this.onViewChanged());
  }

  private get _target(): Target { return this._viewport.target as Target; }
  public get element(): HTMLElement { return this._element; }

  public dispose(): void {
    this._removeEventListener();

    this._fpsTracker.dispose();
    this._memoryTracker.dispose();
    this._statsTracker.dispose();
    this._toolSettingsTracker.dispose();
    this._keyinHandler.dispose();

    this._viewport.debugBoundingBoxes = Tile.DebugBoundingBoxes.None;
    this._viewport.freezeScene = false;
    this._target.primitiveVisibility = PrimitiveVisibility.All;

    if (undefined !== this._parentElement)
      this._parentElement.removeChild(this._element);
  }

  private onViewChanged(): void {
    FrustumDecorator.disable();
    this._frustumCheckbox.checkbox.checked = false;
    this._frustumCheckbox.div.style.display = this._viewport.view.isSpatialView() ? "block" : "none";

    toggleProjectExtents(this._viewport.iModel, false);
    this._projectExtentsCheckbox.checkbox.checked = false;
    this._projectExtentsCheckbox.div.style.display = this._viewport.view.isSpatialView() ? "block" : "none";
  }

  private addSeparator(): void {
    this._element.appendChild(document.createElement("hr")!);
  }

  private toggleFrustumSnapshot(enabled: boolean): void {
    if (enabled)
      FrustumDecorator.enable(this._viewport);
    else
      FrustumDecorator.disable();
  }

  private addBoundingBoxDropdown(parent: HTMLElement): void {
    createComboBox({
      name: "Bounding Boxes: ",
      id: "debugPanel_boundingBoxes",
      parent,
      value: Tile.DebugBoundingBoxes.None,
      handler: (select) => this._viewport.debugBoundingBoxes = Number.parseInt(select.value, 10),
      entries: [
        { name: "None", value: Tile.DebugBoundingBoxes.None },
        { name: "Volume", value: Tile.DebugBoundingBoxes.Volume },
        { name: "Content", value: Tile.DebugBoundingBoxes.Content },
        { name: "Volume and Content", value: Tile.DebugBoundingBoxes.Both },
        { name: "Children", value: Tile.DebugBoundingBoxes.ChildVolumes },
        { name: "Sphere", value: Tile.DebugBoundingBoxes.Sphere },
      ],
    });
  }

  private addVisibilityDropdown(parent: HTMLElement): void {
    createComboBox({
      name: "Visibility: ",
      id: "debugPanel_visibility",
      parent,
      value: PrimitiveVisibility.All,
      handler: (select) => {
        this._target.primitiveVisibility = Number.parseInt(select.value, 10);
        this._viewport.invalidateScene();
      },
      entries: [
        { name: "All", value: PrimitiveVisibility.All },
        { name: "Instanced", value: PrimitiveVisibility.Instanced },
        { name: "Batched", value: PrimitiveVisibility.Uninstanced },
      ],
    });
  }
}
