/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Elements */

import { Id64String } from "@bentley/bentleyjs-core";
import {
  BisCodeSpec,
  Code,
  CodeScopeProps,
  CodeSpec,
  TextureProps,
  TextureFlags,
  ImageSourceFormat,
} from "@bentley/imodeljs-common";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";

/** Defines a rendering texture which is associated with a Material and applied to surface geometry. */
export class Texture extends DefinitionElement implements TextureProps {
  public format: ImageSourceFormat;
  public data: string;
  public width: number;
  public height: number;
  public flags: TextureFlags;
  public description?: string;
  /** @hidden */
  constructor(props: TextureProps, iModel: IModelDb) {
    super(props, iModel);
    this.format = props.format;
    this.data = props.data;
    this.width = props.width;
    this.height = props.height;
    this.flags = props.flags;
    this.description = props.description;
  }
  /** @hidden */
  public toJSON(): TextureProps {
    const val = super.toJSON() as TextureProps;
    val.format = this.format;
    val.data = this.data;
    val.width = this.width;
    val.height = this.height;
    val.flags = this.flags;
    val.description = this.description;
    return val;
  }
  /** Create a Code for a Texture given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the Texture and provides the scope for its name.
   * @param name The Texture name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, name: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.texture);
    return 0 === name.length ? Code.createEmpty() : new Code({ spec: codeSpec.id, scope: scopeModelId, value: name });
  }
  /**
   * Create a Texture with given parameters.
   * @param iModelDb The iModel
   * @param definitionModelId The [[DefinitionModel]]
   * @param name The name/CodeValue of the Texture
   * @param format Format of the image data
   * @param data The image data in a string
   * @param width The width of the texture
   * @param height The height of the texture
   * @param description An optional description of the texture
   * @param flags Optional flags
   * @returns The newly constructed Texture element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, format: ImageSourceFormat, data: string, width: number, height: number, description: string, flags: TextureFlags): Texture {
    const textureProps: TextureProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, definitionModelId, name),
      format,
      data,
      width,
      height,
      flags,
      description,
      model: definitionModelId,
      isPrivate: false,
    };
    return new Texture(textureProps, iModelDb);
  }
  /**
   * Insert a new Texture into a model.
   * @param iModelDb Insert into this iModel
   * @param definitionModelId Insert the new Texture into this DefinitionModel
   * @param name The name/CodeValue of the Texture
   * @param format Format of the image data
   * @param data The image data in a string
   * @param width The width of the texture
   * @param height The height of the texture
   * @param description An optional description of the texture
   * @param flags Optional flags
   * @returns The Id of the newly inserted Texture element.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, format: ImageSourceFormat, data: string, width: number, height: number, description: string, flags: TextureFlags): Id64String {
    const texture = this.create(iModelDb, definitionModelId, name, format, data, width, height, description, flags);
    return iModelDb.elements.insertElement(texture);
  }
}
