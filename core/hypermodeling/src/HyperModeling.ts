/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { assert } from "@bentley/bentleyjs-core";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { SectionType } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, ScreenViewport, tryImageElementFromUrl, ViewManip } from "@bentley/imodeljs-frontend";
import { registerTools } from "./Tools";
import { HyperModelingDecorator } from "./HyperModelingDecorator";
import { HyperModelingConfig, SectionGraphicsConfig, SectionMarkerConfig } from "./HyperModelingConfig";
import { SectionMarkerHandler } from "./SectionMarkerHandler";

/** @internal */
export interface MarkerData {
  readonly label: string;
  readonly image: HTMLImageElement | undefined;
}

interface Resources {
  readonly namespace: I18NNamespace;
  readonly markers: {
    readonly section: MarkerData;
    readonly plan: MarkerData;
    readonly elevation: MarkerData;
    readonly detail: MarkerData;
  };
}

interface MaybeInitialized {
  resources?: Resources;
}

interface Initialized {
  resources: Resources;
}

function assertInitialized(maybe: MaybeInitialized): asserts maybe is Initialized {
  if (undefined === maybe.resources)
    throw new Error("You must call HyperModeling.initialize before using the hypermodeling package");
}

/** The API entry point for the hypermodeling package. Applications must call [[initialize]] and await the result before using the package.
 * The behavior of the package can be customized via a [[HyperModelingConfig]] supplied to [[initialize]], [[updateConfiguration]], or [[replaceConfiguration]].
 * Hypermodeling mode can be enabled or disabled via [[startOrStop]], which returns a [[HyperModelingDecorator]] when enabling hypermodeling.
 * @beta
 */
export class HyperModeling {
  /** @internal */
  public static resources?: Resources;
  private static _markerHandler?: SectionMarkerHandler;
  private static _markerConfig: SectionMarkerConfig = { };
  private static _graphicsConfig: SectionGraphicsConfig = { };

  /** Invoke this method to initialize the hypermodeling package for use. Your *must* await the result before using any of this package's APIs.
   * Typically an application would invoke this after [IModelApp.startup]($frontend), e.g.,
   * ```ts
   *  await IModelApp.startup();
   *  await HyperModeling.initialize();
   * ```
   * Calling this method again after the first initialization behaves the same as calling [[HyperModeling.replaceConfiguration]].
   */
  public static async initialize(config?: HyperModelingConfig): Promise<void> {
    if (undefined !== this.resources) {
      this.replaceConfiguration(config);
      return;
    }

    const namespace = IModelApp.i18n.registerNamespace("HyperModeling");
    await namespace.readFinished;

    const loadImages = [
      tryImageElementFromUrl("section-marker.svg"),
      tryImageElementFromUrl("detail-marker.svg"),
      tryImageElementFromUrl("elevation-marker.svg"),
      tryImageElementFromUrl("plan-marker.svg"),
    ];

    const images = await Promise.all(loadImages);
    this.resources = {
      namespace,
      markers: {
        section: { image: images[0], label: IModelApp.i18n.translate("HyperModeling:Message.SectionCallout") },
        detail: { image: images[1], label: IModelApp.i18n.translate("HyperModeling:Message.DetailCallout") },
        elevation: { image: images[2], label: IModelApp.i18n.translate("HyperModeling:Message.ElevationCallout") },
        plan: { image: images[3], label: IModelApp.i18n.translate("HyperModeling:Message.PlanCallout") },
      },
    };

    registerTools(namespace, IModelApp.i18n);
    this.replaceConfiguration(config);
  }

  /** Replaces the current package configuration, overwriting all previous settings. Passing `undefined` resets all settings to defaults.
   * @see [[HyperModeling.updateConfiguration]] for overriding specific aspects of the configuration.
   */
  public static replaceConfiguration(config?: HyperModelingConfig): void {
    config = config ?? { };
    this._markerHandler = config.markerHandler ?? new SectionMarkerHandler();
    this._markerConfig = config.markers ? { ...config.markers } : { };
    this._graphicsConfig = config.graphics ? { ...config.graphics } : { };
  }

  /** Overrides specific aspects of the current package configuration. Any field that is not `undefined` will be replaced in the current configuration;
   * the rest will retain their current values.
   * @see [[HyperModeling.replaceConfiguration]].
   */
  public static updateConfiguration(config: HyperModelingConfig): void {
    this._markerHandler = config.markerHandler ?? this._markerHandler;

    if (config.markers) {
      this._markerConfig = {
        ignoreModelSelector: config.markers.ignoreModelSelector ?? this._markerConfig.ignoreModelSelector,
        ignoreCategorySelector: config.markers.ignoreCategorySelector ?? this._markerConfig.ignoreCategorySelector,
        hiddenSectionTypes: config.markers.hiddenSectionTypes ?? this._markerConfig.hiddenSectionTypes,
      };
    }

    if (config.graphics) {
      this._graphicsConfig = {
        ignoreClip: config.graphics.ignoreClip ?? this._graphicsConfig.ignoreClip,
        debugClipVolumes: config.graphics.debugClipVolumes ?? this._graphicsConfig.debugClipVolumes,
        hideSectionGraphics: config.graphics.hideSectionGraphics ?? this._graphicsConfig.hideSectionGraphics,
        hideSheetAnnotations: config.graphics.hideSheetAnnotations ?? this._graphicsConfig.hideSheetAnnotations,
      };

      IModelApp.viewManager.invalidateViewportScenes();
    }
  }

  /** The handler that defines interactions with [[SectionMarker]]s.
   * @see [[initialize]] to override the default handler at package initialization.
   * @see [[updateConfiguration]] or [[replaceConfiguration]] to change the current handler.
   */
  public static get markerHandler(): SectionMarkerHandler {
    assertInitialized(this);
    assert(undefined !== this._markerHandler);
    return this._markerHandler;
  }

  /** The current marker display configuration applied to any newly-created [[HyperModelingDecorator]]s.
   * @see [[initialize]] to override the default configuration at package initialization.
   * @see [[updateConfiguration]] or [[replaceConfiguration]] to change the current configuration.
   * @see [[HyperModelingDecorator.replaceConfiguration]] or [[HyperModelingDecorator.updateConfiguration]] to change the configuration for an existing decorator.
   */
  public static get markerConfig(): SectionMarkerConfig {
    return this._markerConfig;
  }

  /** This graphics options applied to graphics displayed by all [[HyperModelingDecorator]]s.
   * @see [[updateConfiguration]] or [[replaceConfiguration]] to change the current configuration.
   */
  public static get graphicsConfig(): SectionGraphicsConfig {
    return this._graphicsConfig;
  }

  /** Returns true if the specified iModel contains any [SectionDrawingLocation]($backend)s. Hypermodeling is based on section drawing locations,
   * so if none are present, hypermodeling features are not relevant to the iModel. Attempting to use those features with such an iModel is fine,
   * but probably not useful.
   */
  public static async isSupportedForIModel(imodel: IModelConnection): Promise<boolean> {
    try {
      for await (const _row of imodel.query("SELECT ECInstanceId FROM bis.SectionDrawingLocation LIMIT 1"))
        return true;
    } catch (_) {
      // An iModel with an older version of BisCore will produce an expected "table not found" on the SectionDrawingLocation ECClass.
    }

    return false;
  }

  /** Returns whether hypermodeling is currently enabled for the specified viewport.
   * @see [[startOrStop]] to enable or disable hypermodeling for a viewport.
   */
  public static isEnabledForViewport(vp: ScreenViewport): boolean {
    return undefined !== HyperModelingDecorator.getForViewport(vp);
  }

  /** Start or stop hypermodeling mode for the specified viewport.
   * Enabling hypermodeling registers and returns a [[HyperModelingDecorator]] to display [[SectionMarker]]s within the viewport.
   * Disabling hypermodeling removes that decorator.
   * @param vp The hypermodeling viewport
   * @param start `true` to enter hypermodeling mode, `false` to exit, or `undefined` to toggle the current mode.
   * @returns The new decorator is hypermodeling was successfully enabled.
   * @note Enabling hypermodeling may fail if the viewport is not viewing a spatial model or if the viewport's iModel does not support hypermodeling.
   * @see [[isSupportedForIModel]]
   */
  public static async startOrStop(vp: ScreenViewport, start?: boolean): Promise<HyperModelingDecorator | undefined> {
    // Help out the caller since we're async anyway...
    if (undefined === this.resources)
      await this.initialize();

    assertInitialized(this);
    let decorator = HyperModelingDecorator.getForViewport(vp);
    if (undefined === start)
      start = undefined === decorator;

    if (!start) {
      decorator?.dispose();
      return undefined;
    }

    if (!vp.view.isSpatialView())
      return undefined;

    decorator = await HyperModelingDecorator.create(vp, this._markerConfig);

    if (undefined !== decorator && vp.view.isCameraOn) {
      // We want the 2d graphics to align with the 3d geometry. Perspective ruins that.
      vp.view.turnCameraOff();
      ViewManip.fitView(vp, false, { noSaveInUndo: true });
      vp.clearViewUndo();
    }

    return decorator;
  }

  /** @internal */
  public static get namespace(): I18NNamespace {
    assertInitialized(this);
    return this.resources.namespace;
  }

  /** @internal */
  public static getMarkerData(type: SectionType): MarkerData {
    assertInitialized(this);
    switch (type) {
      case SectionType.Plan:
        return this.resources.markers.plan;
      case SectionType.Elevation:
        return this.resources.markers.elevation;
      case SectionType.Detail:
        return this.resources.markers.detail;
      default:
        return this.resources.markers.section;
    }
  }
}
