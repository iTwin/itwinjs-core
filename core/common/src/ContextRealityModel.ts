/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { assert } from "@bentley/bentleyjs-core";
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
export class DisplayStyleContextRealityModel implements ContextRealityModel {
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
    return cloneContextRealityModelProps(this._props);
  }
}

export function cloneContextRealityModelProps(props: ContextRealityModelProps) {
  props = { ...props };

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

export interface ContextRealityModelsContainer {
  contextRealityModels?: ContextRealityModelProps[];
}

export class ContextRealityModels implements Iterable<ContextRealityModel> {
  private readonly _container: ContextRealityModelsContainer;
  private readonly _createModel: (props: ContextRealityModelProps) => ContextRealityModel;
  private readonly _models: ContextRealityModel[] = [];

  public constructor(container: ContextRealityModelsContainer, createContextRealityModel?: (props: ContextRealityModelProps) => ContextRealityModel) {
    this._container = container;
    this._createModel = createContextRealityModel ?? ((props) => new DisplayStyleContextRealityModel(props));

    const models = container.contextRealityModels;
    if (models)
      for (const model of models)
        this._models.push(this._createModel(model));
  }

  public [Symbol.iterator](): Iterator<ContextRealityModel> {
    return this._models[Symbol.iterator]();
  }

  public get size(): number {
    return this._models.length;
  }

  public find(criterion: (model: ContextRealityModel) => boolean): ContextRealityModel | undefined {
    return this._models.find(criterion);
  }

  public add(props: ContextRealityModelProps): ContextRealityModel {
    if (!this._container.contextRealityModels)
      this._container.contextRealityModels = [];

    props = cloneContextRealityModelProps(props);
    this._container.contextRealityModels.push(props);
    const model = this._createModel(props);
    this._models.push(model);

    return model;
  }

  public delete(model: ContextRealityModel): boolean {
    const index = this._models.indexOf(model);
    if (-1 === index)
      return false;

    assert(undefined !== this._container.contextRealityModels);
    assert(index < this._container.contextRealityModels.length);

    this._models.splice(index, 1);
    this._container.contextRealityModels.splice(index, 1);

    return true;
  }

  public replace(toReplace: ContextRealityModel, replaceWith: ContextRealityModelProps): ContextRealityModel {
    const index = this._models.indexOf(toReplace);
    if (-1 === index)
      throw new Error("ContextRealityModels.replace: toReplace not found.");

    assert(undefined !== this._container.contextRealityModels);
    assert(index < this._container.contextRealityModels.length);

    replaceWith = cloneContextRealityModelProps(replaceWith);
    const model = this._models[index] = this._createModel(replaceWith);
    this._container.contextRealityModels[index] = replaceWith;

    return model;
  }

  public update(toUpdate: ContextRealityModel, updateProps: Partial<ContextRealityModelProps>): ContextRealityModel {
    const props = {
      ...toUpdate.toJSON(),
      ...updateProps,
    };

    return this.replace(toUpdate, props);
  }
}
