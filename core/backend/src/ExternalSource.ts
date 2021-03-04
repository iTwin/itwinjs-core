
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { ExternalSourceAttachmentProps, ExternalSourceProps, SynchronizationConfigLinkProps } from "@bentley/imodeljs-common";
import { InformationReferenceElement, UrlLink } from "./Element";
import { IModelDb } from "./IModelDb";

/** An ExternalSource refers to an 'information container' found in a repository. In some cases, the container is the entire repository.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @alpha
 */
export class ExternalSource extends InformationReferenceElement implements ExternalSourceProps {
  /** @internal */
  public static get className(): string { return "ExternalSource"; }
  /** @internal */
  public constructor(props: ExternalSourceProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** Attachment of an ExternalSource
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @alpha
 */
export class ExternalSourceAttachment extends InformationReferenceElement implements ExternalSourceAttachmentProps {
  /** @internal */
  public static get className(): string { return "ExternalSourceAttachment"; }
  /** @internal */
  public constructor(props: ExternalSourceAttachmentProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** A group of ExternalSources that are collectively a source of information for one or more elements.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @alpha
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
 * @alpha
 */
export class SynchronizationConfigLink extends UrlLink implements SynchronizationConfigLinkProps {
  /** @internal */
  public static get className(): string { return "SynchronizationConfigLink"; }
  /** @internal */
  public constructor(props: SynchronizationConfigLinkProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

