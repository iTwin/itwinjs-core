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
import { IModelApp, IModelConnection, tryImageElementFromUrl } from "@bentley/imodeljs-frontend";
import { registerTools } from "./HyperModelingTools";

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

/** The API entry point for the hypermodeling package. Applications must call [[initialize]] and await the result before using
 * the package.
 * @beta
 */
export class HyperModeling {
  private static _resources?: Resources;

  /** Invoke this method to initialize the hypermodeling package for use. Your *must* await the result before using any of this package's APIs.
   * Typically an application would invoke this after [IModelApp.startup]($frontend).
   */
  public static async initialize(): Promise<void> {
    if (undefined !== this._resources)
      return;

    const namespace = IModelApp.i18n.registerNamespace("HyperModeling");
    await namespace.readFinished;

    const loadImages = [
      tryImageElementFromUrl("section-marker.svg"),
      tryImageElementFromUrl("detail-marker.svg"),
      tryImageElementFromUrl("elevation-marker.svg"),
      tryImageElementFromUrl("plan-marker.svg"),
    ];

    const images = await Promise.all(loadImages);
    this._resources = {
      namespace,
      markers: {
        section: { image: images[0], label: IModelApp.i18n.translate("HyperModeling:Message.SectionCallout") },
        detail: { image: images[1], label: IModelApp.i18n.translate("HyperModeling:Message.DetailCallout") },
        elevation: { image: images[2], label: IModelApp.i18n.translate("HyperModeling:Message.ElevationCallout") },
        plan: { image: images[3], label: IModelApp.i18n.translate("HyperModeling:Message.PlanCallout") },
      },
    };

    registerTools(namespace, IModelApp.i18n);
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
      // An iModel with an older version of BisCore will produce a "table not found" on the SectionDrawingLocation ECClass.
    }

    return false;
  }

  /** @internal */
  public static get namespace(): I18NNamespace {
    if (undefined === this._resources)
      throw new Error("You must call HyperModeling.initialize before using the hypermodeling package");

    return this._resources.namespace;
  }

  /** @internal */
  public static getMarkerData(type: SectionType): MarkerData {
    assert(undefined !== this._resources, "You must call HyperModeling.initialize() first");
    switch (type) {
      case SectionType.Plan:
        return this._resources.markers.plan;
      case SectionType.Elevation:
        return this._resources.markers.elevation;
      case SectionType.Detail:
        return this._resources.markers.detail;
      default:
        return this._resources.markers.section;
    }
  }
}
