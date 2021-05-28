/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { SpatialClassifierProps, SpatialClassifiers } from "./SpatialClassification";
import { PlanarClipMaskMode, PlanarClipMaskProps, PlanarClipMaskSettings } from "./PlanarClipMask";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";

/** JSON representation of the blob properties for an OrbitGt property cloud.
 * @alpha
 */
export interface OrbitGtBlobProps {
  containerName: string;
  blobFileName: string;
  sasToken: string;
  accountName: string;
}

/** JSON representation of a context reality model
 * A context reality model is one that is not directly attached to the iModel but is instead included in the display style to
 * provide context only when that display style is applied.
 * @public
 */
export interface ContextRealityModelProps {
  tilesetUrl: string;
  /** @alpha */
  orbitGtBlob?: OrbitGtBlobProps;
  /** Not required to be present to display the model. It is use to elide the call to getRealityDataIdFromUrl in the widget if present. */
  realityDataId?: string;
  name?: string;
  description?: string;
  classifiers?: SpatialClassifierProps[];
  /** Masking to be applied to the reality model. */
  planarClipMask?: PlanarClipMaskProps;
  /** Appearance overrides. Only the rgb, transparency, nonLocatable, and emphasized properties are applicable to reality models - the rest are ignored. */
  appearanceOverrides?: FeatureAppearanceProps;
}

export interface ContextRealityModel {
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly realityDataId?: string;
  readonly classifiers?: SpatialClassifiers;
  /** @alpha */
  readonly orbitGtBlob?: OrbitGtBlobProps;

  appearanceOverrides?: FeatureAppearance;
  planarClipMaskSettings?: PlanarClipMaskSettings;

  toJSON(): ContextRealityModelProps;
}

/** @internal */
export abstract class DisplayStyleContextRealityModel implements ContextRealityModel {
  protected readonly _props: ContextRealityModelProps;
  public readonly name: string;
  public readonly url: string;
  public readonly description: string;
  public readonly realityDataId?: string;
  public readonly classifiers?: SpatialClassifiers;
  /** @alpha */
  public readonly orbitGtBlob?: OrbitGtBlobProps;
  protected _appearanceOverrides?: FeatureAppearance;
  protected _planarClipMask?: PlanarClipMaskSettings;

  public constructor(props: ContextRealityModelProps) {
    this._props = props;
    this.name = props.name ?? "";
    this.url = props.tilesetUrl;
    this.orbitGtBlob = props.orbitGtBlob;
    this.realityDataId = props.realityDataId;
    this.description = props.description ?? "";
    this.classifiers = new SpatialClassifiers(props);
    this._appearanceOverrides = props.appearanceOverrides ? FeatureAppearance.fromJSON(props.appearanceOverrides) : undefined;
    if (props.planarClipMask && props.planarClipMask.mode !== PlanarClipMaskMode.None)
      this._planarClipMask = PlanarClipMaskSettings.fromJSON(props.planarClipMask);
  }

  public get planarClipMaskSettings(): PlanarClipMaskSettings | undefined {
    return this._planarClipMask;
  }
  public set planarClipMaskSettings(settings: PlanarClipMaskSettings | undefined) {
    if (!settings)
      delete this._props.planarClipMask;
    else
      this._props.planarClipMask = settings.toJSON();

    this._planarClipMask = settings;
  }

  public get appearanceOverrides(): FeatureAppearance | undefined {
    return this._appearanceOverrides;
  }
  public set appearanceOverrides(overrides: FeatureAppearance | undefined) {
    if (!overrides)
      delete this._props.appearanceOverrides;
    else
      this._props.appearanceOverrides = overrides.toJSON();

    this._appearanceOverrides = overrides;
  }

  public toJSON(): ContextRealityModelProps {
    const props = { ...this._props };

    // Spread operator is shallow...
    if (props.orbitGtBlob)
      props.orbitGtBlob = { ...props.orbitGtBlob };

    if (props.appearanceOverrides) {
      props.appearanceOverrides = { ...props.appearanceOverrides };
      if (props.appearanceOverrides.rgb)
        props.appearanceOverrides.rgb = { ...props.appearanceOverrides.rgb };
    }

    if (props.planarClipMask)
      props.planarClipMask = { ...props.planarClipMask };

    if (props.classifiers)
      props.classifiers = props.classifiers.map((x) => { return { ...x, flags: { ... x.flags } } });

    return props;
  }
}
