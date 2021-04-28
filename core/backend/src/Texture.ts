/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64String } from "@bentley/bentleyjs-core";
import {
  Base64EncodedString, BisCodeSpec, Code, CodeScopeProps, CodeSpec, ImageSourceFormat, TextureFlags, TextureProps,
} from "@bentley/imodeljs-common";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";

/** A [TextureProps]($common) in which the image data can be specified either as a base-64-encoded string or a Uint8Array.
 * @see [[Texture]] constructor.
 * @internal
 */
export interface TextureCreateProps extends Omit<TextureProps, "data"> {
  data: Base64EncodedString | Uint8Array;
}

/** Defines a rendering texture that is associated with a Material and applied to surface geometry.
 * @public
 */
export class Texture extends DefinitionElement {
  /** @internal */
  public static get className(): string { return "Texture"; }
  public format: ImageSourceFormat;
  public data: Uint8Array;
  public width: number;
  public height: number;
  public flags: TextureFlags;
  public description?: string;

  /** @internal */
  constructor(props: TextureCreateProps, iModel: IModelDb) {
    super(props, iModel);
    this.format = props.format;
    this.data = typeof props.data === "string" ? Base64EncodedString.toUint8Array(props.data) : props.data;
    this.width = props.width;
    this.height = props.height;
    this.flags = props.flags;
    this.description = props.description;
  }

  /** @internal */
  public toJSON(): TextureProps {
    const val = super.toJSON() as TextureProps;
    val.format = this.format;
    val.data = Base64EncodedString.fromUint8Array(this.data);
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
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, format: ImageSourceFormat, data: Uint8Array | Base64EncodedString, width: number, height: number, description: string, flags: TextureFlags): Texture {
    const textureProps: TextureCreateProps = {
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
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, format: ImageSourceFormat, data: Uint8Array | Base64EncodedString, width: number, height: number, description: string, flags: TextureFlags): Id64String {
    const texture = this.create(iModelDb, definitionModelId, name, format, data, width, height, description, flags);
    return iModelDb.elements.insertElement(texture);
  }
}
