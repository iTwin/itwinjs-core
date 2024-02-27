/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import {
  BisCodeSpec, Code, CodeScopeProps, CodeSpec, DefinitionElementProps, ElementProps, NormalMapProps, RenderMaterialAssetMapsProps, RenderMaterialProps, RgbFactorProps, TextureMapProps,
} from "@itwin/core-common";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";
import { IModelElementCloneContext } from "./IModelElementCloneContext";

/* eslint-disable @typescript-eslint/naming-convention */

/** A PhysicalMaterial defines the matter that makes up physical elements.
 * @note See [[RenderMaterialElement]] for the DefinitionElement used to define rendering characteristics.
 * @public
 */
export abstract class PhysicalMaterial extends DefinitionElement {
  /** @internal */
  public static override get className(): string { return "PhysicalMaterial"; }
  /** Create a Code for a PhysicalMaterial given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param definitionModelId The Id of the DefinitionModel that will contain the PhysicalMaterial and provide the scope for its name.
   * @param name The name (codeValue) of the PhysicalMaterial
   */
  public static createCode(iModel: IModelDb, definitionModelId: CodeScopeProps, name: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.physicalMaterial);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: name });
  }
  /** Create a PhysicalMaterial
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the DefinitionModel that will contain the PhysicalMaterial and provide the scope for its name.
   * @param name The name (codeValue) of the PhysicalMaterial
   * @returns The newly constructed PhysicalMaterial
   * @throws [[IModelError]] if there is a problem creating the PhysicalMaterial
   */
  public static create<T extends PhysicalMaterial>(iModelDb: IModelDb, definitionModelId: CodeScopeProps, name: string): T {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
    };
    return iModelDb.elements.createElement(elementProps);
  }
}

/** Defines a rendering material.
 * @note See [[PhysicalMaterial]] for the DefinitionElement used to define the matter that makes up physical elements.
 * @public
 */
export class RenderMaterialElement extends DefinitionElement {
  /** @internal */
  public static override get className(): string { return "RenderMaterial"; }

  /** The name of a palette that can be used to categorize multiple materials. */
  public paletteName: string;
  /** An optional description of the material. */
  public description?: string;
  /** @internal */
  constructor(props: RenderMaterialProps, iModel: IModelDb) {
    super(props, iModel);
    this.paletteName = props.paletteName;
    this.description = props.description;
  }

  public override toJSON(): RenderMaterialProps {
    const val = super.toJSON() as RenderMaterialProps;
    val.paletteName = this.paletteName;
    val.description = this.description;
    return val;
  }
  /** Create a Code for a RenderMaterial given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the RenderMaterial and provides the scope for its name.
   * @param name The RenderMaterial name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, name: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.renderMaterial);
    return 0 === name.length ? Code.createEmpty() : new Code({ spec: codeSpec.id, scope: scopeModelId, value: name });
  }
  /**
   * Create a RenderMaterial with given parameters.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param materialName The name/CodeValue of the RenderMaterial
   * @param params Parameters object which describes how to construct the RenderMaterial
   * @returns The newly constructed RenderMaterial element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, materialName: string, params: RenderMaterialElementParams): RenderMaterialElement {
    let maps: RenderMaterialAssetMapsProps | undefined;
    const pbr_normal = params.normalMap?.scale;
    if (params.patternMap || params.normalMap) {
      // If both normal and pattern map are present, their texture mapping modes, angles, scales, etc are expected to match.
      type TexMap = Omit<TextureMapProps, "TextureId">;
      function choose<K extends keyof TexMap>(obj: TexMap, key: K): void {
        const pat = params.patternMap;
        if (pat && undefined !== pat[key])
          obj[key] = pat[key];
        else if (params.normalMap && undefined !== params.normalMap[key])
          obj[key] = params.normalMap[key];
      }

      const baseProps: TexMap = {};
      choose(baseProps, "pattern_angle");
      choose(baseProps, "pattern_u_flip");
      choose(baseProps, "pattern_flip");
      choose(baseProps, "pattern_scale");
      choose(baseProps, "pattern_offset");
      choose(baseProps, "pattern_scalemode");
      choose(baseProps, "pattern_mapping");
      choose(baseProps, "pattern_weight");
      choose(baseProps, "pattern_useconstantlod");
      choose(baseProps, "pattern_constantlod_repetitions");
      choose(baseProps, "pattern_constantlod_offset");
      choose(baseProps, "pattern_constantlod_mindistanceclamp");
      choose(baseProps, "pattern_constantlod_maxdistanceclamp");

      maps = {};
      if (params.patternMap)
        maps.Pattern = { ...params.patternMap, ...baseProps };

      if (params.normalMap) {
        maps.Normal = {
          ...params.normalMap,
          ...baseProps,
        };

        delete (maps.Normal as any).scale;
      }
    }

    // const map = undefined !== params.patternMap ? { Pattern: params.patternMap } : undefined;
    const renderMaterialProps: RenderMaterialProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, materialName),
      paletteName: params.paletteName,
      description: params.description,
      jsonProperties: {
        materialAssets: {
          renderMaterial: {
            HasBaseColor: params.color !== undefined,
            color: params.color,
            HasSpecularColor: params.specularColor !== undefined,
            specular_color: params.specularColor,
            HasFinish: params.finish !== undefined,
            finish: params.finish,
            HasTransmit: params.transmit !== undefined,
            transmit: params.transmit,
            HasDiffuse: params.diffuse !== undefined,
            diffuse: params.diffuse,
            HasSpecular: params.specular !== undefined,
            specular: params.specular,
            HasReflect: params.reflect !== undefined,
            reflect: params.reflect,
            HasReflectColor: params.reflectColor !== undefined,
            reflect_color: params.reflectColor,
            Map: maps,
            pbr_normal,
          },
        },
      },
      model: definitionModelId,
      isPrivate: false,
    };

    return new RenderMaterialElement(renderMaterialProps, iModelDb);
  }

  /**
   * Insert a new RenderMaterial into a model.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new Texture into this DefinitionModel
   * @param materialName The name/CodeValue of the RenderMaterial
   * @param params Parameters object which describes how to construct the RenderMaterial
   * @returns The Id of the newly inserted RenderMaterial element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, materialName: string, params: RenderMaterialElementParams): Id64String {
    const renderMaterial = this.create(iModelDb, definitionModelId, materialName, params);
    return iModelDb.elements.insertElement(renderMaterial.toJSON());
  }

  /** @internal */
  protected static override onCloned(context: IModelElementCloneContext, sourceProps: ElementProps, targetProps: ElementProps) {
    super.onCloned(context, sourceProps, targetProps);
    for (const mapName in sourceProps.jsonProperties?.materialAssets?.renderMaterial?.Map ?? {}) {
      if (typeof mapName !== "string")
        continue;
      const sourceMap = sourceProps.jsonProperties.materialAssets.renderMaterial.Map[mapName];
      if (!Id64.isValid(sourceMap.TextureId) || sourceMap.TextureId === undefined)
        continue;
      targetProps.jsonProperties.materialAssets.renderMaterial.Map[mapName].TextureId = context.findTargetElementId(sourceMap.TextureId ?? Id64.invalid);
    }
  }
}

/** @public */
export namespace RenderMaterialElement { // eslint-disable-line no-redeclare
  /** Parameters used to construct a [[RenderMaterial]].
   * The persistent JSON representation - [RenderMaterialAssetProps]($common) - is quite verbose and unwieldy. This representation simplifies it somewhat.
   * @see [[RenderMaterialElement.create]] and [[RenderMaterialElement.insert]] to create a [[RenderMaterial]] from parameters of this type.
   * @deprecated in 3.6 because it is not useful to use a `class` - just use [[RenderMaterialElementParams]] directly instead.
   */
  export class Params {
    /** A required palette name that categorizes this RenderMaterial */
    public paletteName: string;
    /** An optional description of this RenderMaterial */
    public description?: string;
    /** If defined, the color to use for surface fill or diffuse illumination, overriding the surface's own color. */
    public color?: RgbFactorProps;
    /** The color to use for specular illumination. Default: black. */
    public specularColor?: RgbFactorProps;
    /** The specular exponent describing the surface's shininess, in the range 0 through 128.
     * Default: 0.
     */
    public finish?: number;
    /** A transparency to be applied to the surface, ranging from 0 (fully opaque) to 1 (fully transparent).
     * The surface's own transparency will be multiplied by `(1 - transmit)`. permitting the material to increase but not decrease the surface transparency.
     * Default: 13.5.
     */
    public transmit?: number;
    /** The surface's diffuse reflectivity from 0.0 to 1.0. Default: 0.6. */
    public diffuse?: number;
    /** The surface's specular reflectivity from 0.0 to 1.0. Default: 0.0. */
    public specular?: number;
    /** Currently unused. */
    public reflect?: number;
    /** Currently unused. */
    public reflectColor?: number[];
    /** Specifies a texture image to map onto the surface, replacing or mixing with the surface's own color and transparency.
     * @note With the exception of `TextureId`, the [TextureMapProps]($common) of [[patternMap]] and [[normalMap]] are expected to be identical. If a property is defined in both
     * [[patternMap]]] and [[normalMap]], the value in [[patternMap]] takes precedence.
     */
    public patternMap?: TextureMapProps;
    /** Specifies a [normal map](https://en.wikipedia.org/wiki/Normal_mapping) to apply to the surface to simulate more surface detail than is present in the
     * surface's geometry.
     * @note With the exception of `TextureId`, the [TextureMapProps]($common) of [[patternMap]] and [[normalMap]] are expected to be identical. If a property is defined in both
     * [[patternMap]]] and [[normalMap]], the value in [[patternMap]] takes precedence.
     */
    public normalMap?: NormalMapProps & {
      /** A factor by which to multiply the components of the normal vectors read from the texture.
       * Default: 1.
       */
      scale?: number;
    };

    /** Construct a new RenderMaterial.Params object with the specified paletteName. Alter the public members on that object to specify settings. */
    public constructor(paletteName: string) {
      this.paletteName = paletteName;
    }
  }
}

/** Parameters used to create a [[RenderMaterial]] element.
 * The persistent JSON representation - [RenderMaterialAssetProps]($common) - is quite verbose and unwieldy. This representation simplifies it somewhat.
 * @see [[RenderMaterialElement.create]] and [[RenderMaterialElement.insert]] to create a [[RenderMaterial]] from parameters of this type.
 * @public
 */
export interface RenderMaterialElementParams extends RenderMaterialElement.Params { // eslint-disable-line deprecation/deprecation, @typescript-eslint/no-empty-interface
}
