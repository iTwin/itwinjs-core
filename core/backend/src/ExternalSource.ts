
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64String } from "@bentley/bentleyjs-core";
import {
  BisCodeSpec, Code, CodeScopeSpec, ExternalSourceAttachmentProps, ExternalSourceProps, IModel, SynchronizationConfigLinkProps,
} from "@bentley/imodeljs-common";
import { InformationReferenceElement, UrlLink } from "./Element";
import { IModelDb } from "./IModelDb";

/** An ExternalSource refers to an 'information container' found in a repository. In some cases, the container is the entire repository.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class ExternalSource extends InformationReferenceElement {
  /** @internal */
  public static get className(): string { return "ExternalSource"; }
  /** @internal */
  public constructor(props: ExternalSourceProps, iModel: IModelDb) {
    super(props, iModel);
  }
  /** The [[CodeSpec]] for ExternalSource elements is not automatically created, so this method ensures that it exists. */
  public static ensureCodeSpec(iModelDb: IModelDb): Id64String {
    try {
      const codeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.externalSource);
      return codeSpec.id;
    } catch (e) {
      return iModelDb.codeSpecs.insert(BisCodeSpec.externalSource, CodeScopeSpec.Type.Repository);
    }
  }
  /** Create a Code for an ExternalSource element given a name that is meant to be unique within the scope of the iModel.
   * @param iModelDb  The IModelDb
   * @param codeValue The ExternalSource name
   * @see [[ensureCodeSpec]]
   */
  public static createCode(iModelDb: IModelDb, codeValue: string): Code {
    const codeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.externalSource);
    return new Code({ spec: codeSpec.id, scope: IModel.rootSubjectId, value: codeValue });
  }
}

/** Attachment of an ExternalSource
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class ExternalSourceAttachment extends InformationReferenceElement {
  /** @internal */
  public static get className(): string { return "ExternalSourceAttachment"; }
  /** @internal */
  public constructor(props: ExternalSourceAttachmentProps, iModel: IModelDb) {
    super(props, iModel);
  }
  /** The [[CodeSpec]] for ExternalSourceAttachment elements is not automatically created, so this method ensures that it exists. */
  public static ensureCodeSpec(iModelDb: IModelDb): Id64String {
    try {
      const codeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.externalSourceAttachment);
      return codeSpec.id;
    } catch (e) {
      return iModelDb.codeSpecs.insert(BisCodeSpec.externalSourceAttachment, CodeScopeSpec.Type.ParentElement);
    }
  }
  /** Create a Code for an ExternalSourceAttachment element given a name that is meant to be unique within the scope of its parent [[ExternalSource]].
   * @param iModelDb  The IModelDb
   * @param scopeElementId The parent ExternalSource
   * @param codeValue The ExternalSourceAttachment name
   * @see [[ensureCodeSpec]]
   */
  public static createCode(iModelDb: IModelDb, scopeElementId: Id64String, codeValue: string): Code {
    const codeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.externalSourceAttachment);
    return new Code({ spec: codeSpec.id, scope: scopeElementId, value: codeValue });
  }
}

/** A group of ExternalSources that are collectively a source of information for one or more elements.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class ExternalSourceGroup extends ExternalSource {
  /** @internal */
  public static get className(): string { return "ExternalSourceGroup"; }
  /** @internal */
  public constructor(props: ExternalSourceProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Link to the Configuration for an iModel Synchronization Job
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @beta
 */
export class SynchronizationConfigLink extends UrlLink {
  /** @internal */
  public static get className(): string { return "SynchronizationConfigLink"; }
  /** @internal */
  public constructor(props: SynchronizationConfigLinkProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

