/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  DisplayStyleSettings, FeatureAppearance, RealityModelDisplaySettings,
} from "@itwin/core-common";
import {
  ContextRealityModelState, SpatialModelState, IModelApp, Tool, Viewport,
} from "@itwin/core-frontend";
import { Surface } from "./Surface";
import { Window } from "./Window";

interface RealityModel {
  readonly name: string;
  settings: RealityModelDisplaySettings;
  appearance: FeatureAppearance | undefined;
}

class ContextModel implements RealityModel {
  private readonly _state: ContextRealityModelState;

  public constructor(state: ContextRealityModelState) {
    this._state = state;
  }

  public get name() { return this._state.name || this._state.orbitGtBlob?.blobFileName || this._state.url; }

  public get settings() { return this._state.displaySettings; }
  public set settings(value: RealityModelDisplaySettings) { this._state.displaySettings = value; }

  public get appearance() { return this._state.appearanceOverrides; }
  public set appearance(value: FeatureAppearance | undefined) { this._state.appearanceOverrides = value; }
}

class PersistentModel implements RealityModel {
  private readonly _model: SpatialModelState;
  private readonly _settings: DisplayStyleSettings;

  public constructor(model: SpatialModelState, settings: DisplayStyleSettings) {
    this._model = model;
    this._settings = settings;
  }

  public get name() { return this._model.name ?? this._model.jsonProperties.tilesetUrl; }

  public get settings() { return this._settings.getRealityModelDisplaySettings(this._model.id) ?? RealityModelDisplaySettings.defaults; }
  public set settings(value: RealityModelDisplaySettings) { this._settings.setRealityModelDisplaySettings(this._model.id, value); }

  public get appearance() { return this._settings.getModelAppearanceOverride(this._model.id); }
  public set appearance(value: FeatureAppearance | undefined) {
    if (value)
      this._settings.overrideModelAppearance(this._model.id, value);
    else
      this._settings.dropModelAppearanceOverride(this._model.id);
  }
}

const viewportIdsWithOpenWidgets = new Set<number>();

class RealityModelSettings extends Window {
  public readonly windowId: string;
  private readonly _viewport: Viewport;
  private readonly _model: RealityModel;
  private readonly _dispose: () => void;

  public constructor(viewport: Viewport, model: RealityModel) {
    super(Surface.instance, { top: 0, left: 50 });
    this._viewport = viewport;
    this._model = model;

    this.windowId = `realityModelSettings-${viewport.viewportId}-${model.name}`;
    this.isPinned = true;
    this.title = `${model.name} display settings`;

    this.contentDiv.innerText = "hello there can anyone hear me???";

    const removals = [
      viewport.onChangeView.addOnce(() => this.close()),
      viewport.onDisposed.addOnce(() => this.close()),
    ];

    this._dispose = () => removals.forEach((removal) => removal());
  }

  private close(): void {
    this.surface.close(this);
  }

  public override onClosed(): void {
    this._dispose();
    viewportIdsWithOpenWidgets.delete(this._viewport.viewportId);
  }
}

export class OpenRealityModelSettingsTool extends Tool {
  public static override toolId = "OpenRealityModelSettings";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(vp?: Viewport, model?: RealityModel): Promise<boolean> {
    if (!vp || !model)
      return false;

    const win = new RealityModelSettings(vp, model);
    win.surface.addWindow(win);
    win.surface.element.appendChild(win.container);

    return true;
  }

  public override async parseAndRun(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.isSpatialView())
      return false;

    if (viewportIdsWithOpenWidgets.has(vp.viewportId))
      return true;

    // ###TODO permit specific reality model to be specified in args.
    // For now use first one we can find.
    let realityModel: RealityModel | undefined;
    vp.view.displayStyle.forEachRealityModel((x) => {
      realityModel = realityModel ?? new ContextModel(x);
    });

    if (!realityModel) {
      for (const modelId of vp.view.modelSelector.models) {
        const model = vp.iModel.models.getLoaded(modelId);
        if (model instanceof SpatialModelState && model.isRealityModel) {
          realityModel = new PersistentModel(model, vp.view.displayStyle.settings);
          break;
        }
      }
    }

    return realityModel ? this.run(vp, realityModel) : false;
  }
}
