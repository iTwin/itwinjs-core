/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Framework
 */

import { DefinitionElement , ECSqlStatement, Element, ElementOwnsChildElements, ElementUniqueAspect, ExternalSource, ExternalSourceAspect, IModelDb, RepositoryLink } from "@itwin/core-backend";
import { assert, DbResult, Guid, Id64, IModelStatus, Logger } from "@itwin/core-bentley";
// eslint-disable-next-line no-duplicate-imports
import type { AccessToken, GuidString, Id64String } from "@itwin/core-bentley";
import { Code, IModel, IModelError, RelatedElement } from "@itwin/core-common";
// eslint-disable-next-line no-duplicate-imports
import type { ElementProps, ExternalSourceAspectProps, ExternalSourceProps, RepositoryLinkProps } from "@itwin/core-common";

class LoggerCategories {
  public constructor() {

  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public static Framework: any;
}

function deleteElementSubTrees(_imodel: IModelDb, _id: string, _args: any): void {

}

/** The state of the given SourceItem against the iModelDb
 * @beta
 */
export enum ItemState {
  /** The SourceItem is unchanged */
  Unchanged,
  /** The SourceItem is not currently in the iModelDb */
  New,
  /** The SourceItem has been changed */
  Changed,
}

/** @beta */
export interface ChangeResults {
  /** Id of the item, if it currently exists in the iModel */
  id?: Id64String;
  /** State of the item */
  state: ItemState;
  /** The ExternalSourceAspect, if any, that was found in the iModel. This contains the state of the item from the last time it was synchronized. */
  existingExternalSourceAspect?: ExternalSourceAspectProps;
}

type RemoveNullable<T, TKey extends keyof T> = T & {
  [K in TKey]-?: NonNullable<T[K]>
};

/** A `SourceItem` identifies an entity in an external source and the state of the content of the entity.
 * The data provided by the SourceItem is stored in the iModel as the "provenance" of the entity.
 * This provenance data enables users and applications to trace an element in an iModel back to its native, external source.
 * Provenance also enables a connector to track and synchronize changes to the entity.
 * ## Document, external source, and scope
 *  The "document" is the data source that is being read by the connector. This could be a file, a managed document, or a database connection. A document is represented in the iModel by a RepositoryLink element.
 *  The "external source" represents either the document as a whole or an area within the document. (Also see ExternalSourceGroup.) The external source is represented by an ExternalSource element. See https://www.itwinjs.org/learning/provenence-in-imodels/.
 *  The "scope" identifies either the ExternalSource or an area within in.
 * ## Kind
 *  A value that the connector uses to classify the entity.
 * ## Id
 *  The ID that was assigned to the entity by the external system that creates and manages it. This ID must be stable -- a given entity must have the same ID each time it is synchronized.
 * ## Entity identification
 *  The (kind, scope, id) triple must uniquely identify the entity in the outside world.
 *  This triple is what allows the iModel to track the entity.
 * ## Entity change detection
 *  The version and/or checksum values capture the state of the content of the entity.
 *  These values are stored in the iModel.
 *  They allow the Synchronizer to detect if the entity has changed since the last synchronization.
 *  See below for details on change-detection.
 * ## Persistence
 *  The properties of a SourceItem are stored in the ExternalSourceAspect of the Element in the iModel that represents the entity.
 *  The ExternalSourceAspect tracks the external source of the element.
 *  https://www.itwinjs.org/bis/domains/biscore.ecschema/#externalsourceaspect
 *
 * ## Change-detection using version and checksum
 * The connector must call Synchronizer.detectChanges on each entity to determine if there are changes that must be written to the iModel or not.
 *
 * The SourceItem's version and/or checksum values must capture the entity's *current* state in the external source.
 * The ExternalSourceAspect records the state of the entity as of the last synchronization.
 *
 * Synchronizer.detectChanges compares the SourceItem's current state with the stored state recorded by the aspect.
 * If they match, the entity is unchanged and should be skipped.
 * If they do not match, the entity has changed, and the connector should convert the entity and then call Synchronizer.updateIModel.
 *
 * Change-detection is based on version and/or checksum values that capture the state of the content of each entity in a summary form.
 * In principle, Synchronizer could detect changes by letting the connector convert an entity to BIS format and then comparing the results with the Elements
 * and Aspects currently in the iModel. That would be a waste of time in the common case where most entities are unchanged. To avoid this, Synchronizer
 * uses version and/or checksum values instead. This approach minimizes the cost of up-front change-detection. The connector can compute these summary values directly
 * from the raw source data, without using its conversion logic. One or both of these values may even be directly available in the source data.
 *
 * A SourceItem must have a version or a checksum, and it can have both.
 * 1. If a SourceItem defines *both* version and checksum, then the entity is considered to be unchanged if the version is unchanged. If the version has changed, then the checksum is checked.
 * 2. If a SourceItem defines version only, the entity is considered to have changed if the item's version has changed.
 * 3. If a SourceItem defines checksum only, the entity is considered to have changed if the item's checksum has changed.
 *
 * @beta
 */
export interface SourceItem {
  /** The unique identity of the entity (relative to its scope and kind) in the external source. */
  id: string;
  /** Identifies an element in the iModel that represents an area of the external source. Defaults to the Job Subject element. */
  scope?: string;
  /** Indicates what kind of thing this is in the external source. The value and purpose of this string is known only to the connector. Defaults to "". */
  kind?: string;
  /** An optional value that is typically a version number or a pseudo version number like last modified time.
   * It will be used by the synchronization process to detect that a source entity is unchanged so that computing a cryptographic hash can be avoided.
   * If present, this value must be guaranteed to change when any of the source entity's content changes. If not defined, checksum must be defined
   */
  version?: string;
  /** The optional cryptographic hash (any algorithm) of the source entity's content. If defined, it must be guaranteed to change when the source entity's content changes.
   * If defined, this function should cache its return value the first time that it is called, because it may be called multiple times.
   */
  checksum?(): string | undefined;
  /* Identifies the ExternalSource of the entity. See https://www.itwinjs.org/learning/provenence-in-imodels/.
  * If not specified or empty, then the ExternalSource of the RepositoryLink will be used by default, provided that only
  * one RepositoryLink has been recorded. That is the common case.
  */
  source?: string;
}

/** Properties that may be assigned to a document by its home document control system
 * @beta
 */
export interface DocumentProperties {
  /** The GUID assigned to the document */
  docGuid?: string;
  /** The URN to use when referring to this document over the Internet */
  webURN?: string;
  /** The URN to use when referring to this document from a desktop program */
  desktopURN?: string;
  /** Document attributes, in JSON format. These are additional attributes that may be assigned to the document by the external document management system. */
  attributesJson?: string;
}

/** Identifies an external document and its state.
 * This data is stored in the ExternalSourceAspect of the RepositoryLink Element that represents the document.
 * The ExternalSourceAspect tracks the source document.
*/
export interface SourceDocument {
  /** The stable unique ID of the source document. This must never change. Preferably this should be a GUID that is assigned once and for all to the document
   * by an external document management system. If the document is an unmanaged file, then a lower-cased, relative filename should be used.
   */
  docid: string;
  /** Additional properties that may be assigned to the document by the document management system. */
  docProps?: DocumentProperties;
  /** A human-readable description of the source document. */
  description?: string;
  /** An optional value that is typically the last modified time of the document.
  * It will be used by the synchronization process to detect that the document is unchanged so that computing a cryptographic hash can be avoided.
  * If present, this value must be guaranteed to change when any of the document's content changes. If not defined, checksum must be defined
  */
  lastModifiedTime?: string;
  /** The cryptographic hash (any algorithm) of the document's content. If defined, it must be guaranteed to change when the document's content changes.
  * The method of computing this value is known only to the connector or source repository.  If not defined, version must be defined.
  * This function will not be called if `lastModifiedTime` is defined and is not equal to the version property of the stored aspect.
  */
  checksum?(): string | undefined;
}

/** @beta */
export interface SynchronizationResults {
  /** The props of the element being synchronized */
  elementProps: ElementProps;
  /**  Children of element that have been synchronized */
  childElements?: SynchronizationResults[];
  /** The state of the element */
  itemState: ItemState;
}

export interface RecordDocumentResults extends SynchronizationResults {
  /** Identifies the ExternalSource element that corresponds to to the RepositoryLink. This may be empty or invalid. */
  source: Id64String;
  /** The RepositoryLink's previously stored state, if any. Will be undefined if the document is new. */
  preChangeAspect?: ExternalSourceAspectProps;
  /** The RepositoryLink's current state. Note that this state has not yet been written to the iModel. This is used by updateRepositoryLinks to update the iModel when synchronization is finished. */
  postChangeAspect: ExternalSourceAspectProps;
}

type ItemWithScopeAndKind = RemoveNullable<SourceItem, "scope" | "kind">;

function sourceItemHasScopeAndKind(item: SourceItem): item is ItemWithScopeAndKind {
  return item.scope !== undefined && item.kind !== undefined;
}

/** Helper class for interacting with the iModelDb during synchronization.
 * @beta
 */
export class Synchronizer {
  private _seenElements: Set<Id64String> = new Set<Id64String>();
  private _seenAspects: Set<Id64String> = new Set<Id64String>();
  private _unchangedSources: Id64String[] = new Array<Id64String>();
  private _links = new Map<string, RecordDocumentResults>();
  private _jobSubjectId: string | undefined;

  public constructor(
    public readonly imodel: IModelDb,
    private _supportsMultipleFilesPerChannel: boolean,
    protected _requestContext?: AccessToken) {
    if (imodel.isBriefcaseDb() && undefined === _requestContext)
      throw new IModelError(IModelStatus.BadArg, "RequestContext must be set when working with a BriefcaseDb");
  }

  /** @internal */
  public get linkCount() { return this._links.size; }
  public get unchangedSources() { return this._unchangedSources; }

  public set jobSubjectId(id: Id64String) { this._jobSubjectId = id; }
  public get jobSubjectId(): string {
    if (this._jobSubjectId === undefined)
      throw new IModelError(IModelStatus.MissingId, "No Job Subject");
    return this._jobSubjectId;
  }

  // __PUBLISH_EXTRACT_START__ Sychronizer-getOrCreateExternalSource.example-code
  private getOrCreateExternalSource(repositoryLinkId: Id64String, modelId: Id64String): Id64String {
    const xse = this.getExternalSourceElementByLinkId(repositoryLinkId);
    if (xse !== undefined) {
      assert(xse.id !== undefined);
      return xse.id;
    }

    const xseProps: ExternalSourceProps = {
      model: modelId,
      classFullName: ExternalSource.classFullName,
      repository: { id: repositoryLinkId, relClassName: RepositoryLink.classFullName },
      code: Code.createEmpty(),
    };

    return this.imodel.elements.insertElement(xseProps);
  }
  // __PUBLISH_EXTRACT_END__

  /** Insert or update a RepositoryLink element to represent the source document. Also inserts or updates an ExternalSourceAspect for provenance.
   * The document's ID is sourceDocument.docProps.docGuid, if defined; else, sourceDocument.docProps.desktopUrn, if defined; else, sourceDocument.description.
   * The document's ID is stored in the code value of the RepositoryLink and the identity of its ExternalSourceAspect.
   * @param sourceDocument Identifies the document.
   * @throws [[IModelError]] if a RepositoryLink for this document already exists, but there is no matching ExternalSourceAspect.
   * @see [[SourceItem]] for an explanation of how an entity from an external source is tracked in relation to the RepositoryLink.
   */

  // __PUBLISH_EXTRACT_START__ Synchronizer-recordDocument.example-code
  public recordDocument(sourceDocument: SourceDocument): RecordDocumentResults {
    const code = RepositoryLink.createCode(this.imodel, IModel.repositoryModelId, sourceDocument.docid);

    const sourceItem: ItemWithScopeAndKind = {
      kind: "DocumentWithBeGuid",
      scope: IModel.repositoryModelId,
      id: code.value,
      version: sourceDocument.lastModifiedTime,
      checksum: () => { return sourceDocument.checksum?.(); },
    };

    const key = sourceItem.scope + sourceItem.id.toLowerCase();
    const existing = this._links.get(key);
    if (existing !== undefined) {
      return existing;
    }
    // __PUBLISH_EXTRACT_END__
    const repositoryLink = this.makeRepositoryLink(code, sourceDocument.description, sourceDocument.docProps);

    if (undefined === repositoryLink) {
      throw new IModelError(IModelStatus.BadElement, `Failed to create repositoryLink for ${JSON.stringify(sourceDocument)}`);
    }

    const results = {
      elementProps: repositoryLink.toJSON(),
      itemState: ItemState.New,
      source: "", // see below
    } as RecordDocumentResults;

    // __PUBLISH_EXTRACT_START__ Synchronizer-detectChanges.example-code
    const changeResults = this.detectChanges(sourceItem);
    if (Id64.isValidId64(repositoryLink.id) && changeResults.state === ItemState.New) {
      const error = `A RepositoryLink element with code=${repositoryLink.code} and id=${repositoryLink.id} already exists in the bim file.
      However, no ExternalSourceAspect with scope=${sourceItem.scope} and kind=${sourceItem.kind} was found for this element.
      Maybe RecordDocument was previously called on this file with a different scope or kind.`;
      throw new IModelError(IModelStatus.NotFound, error);
    }

    results.itemState = changeResults.state;
    results.preChangeAspect = changeResults.existingExternalSourceAspect;
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Synchronizer-onElementsSeen.example-code
    if (changeResults.state === ItemState.Unchanged) {
      assert(changeResults.id !== undefined);
      results.elementProps.id = changeResults.id;
      results.source = this.getOrCreateExternalSource(results.elementProps.id, results.elementProps.model);
      assert(changeResults.existingExternalSourceAspect !== undefined, "detectChanges must set existingExternalSourceAspect whenever it returns Unchanged or Changed");
      results.postChangeAspect = changeResults.existingExternalSourceAspect;

      this._unchangedSources.push(changeResults.id);
      this._links.set(key, results);
      this.onElementSeen(changeResults.id);
      return results;
    }
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Synchronizer-updateIModel.example-code
    // Changed or New
    const status = this.updateIModel(results, sourceItem);

    if (results.elementProps.id === undefined)
      throw new IModelError(status, `Failed to insert repositoryLink ${JSON.stringify(results.elementProps)}`);

    results.source = this.getOrCreateExternalSource(results.elementProps.id, results.elementProps.model);

    this._links.set(key, results);

    // Fail-safety - see updateRepositoryLinks
    results.postChangeAspect = this.makeExternalSourceAspectPropsFromSourceItem(sourceItem, results.elementProps.id); // this is what we will write in updateRepositoryLinks at the finish
    const aspectNoVersion: ExternalSourceAspectProps = { ...results.postChangeAspect, version: undefined, checksum: undefined }; // at the start, erase the version and checksum values
    this.imodel.elements.updateAspect(aspectNoVersion);

    return results;
    // __PUBLISH_EXTRACT_END__
  }

  private setSourceItemDefaults(item: SourceItem) {
    if (item.scope === undefined)
      item.scope = this.jobSubjectId;
    if (item.kind === undefined)
      item.kind = "";
    if (item.source === undefined && this.linkCount === 1)
      item.source = this._links.values().next().value.source;
    assert(sourceItemHasScopeAndKind(item));
  }

  /** Detect if the item has changed or is new.
   * @param item the source item
   * @returns the results of looking in the iModelDb and comparing the existing source record, if any, with the item's current state.
   * @beta
   */
  public detectChanges(item: SourceItem): ChangeResults {
    this.setSourceItemDefaults(item);
    assert(sourceItemHasScopeAndKind(item));

    let ids: any;
    const results: ChangeResults = {
      state: ItemState.New,
    };

    if (item.id !== "") {
      ids = ExternalSourceAspect.findAllBySource(this.imodel, item.scope, item.kind, item.id);
      if (ids.length === 1)
        ids = ids[0];
    }

    // If we fail to locate the aspect with its unique (kind, identifier) tuple, we consider the
    // source item new.
    if (ids.aspectId === undefined) {
      return results;
    }

    let aspect: ExternalSourceAspect | undefined;

    try {
      aspect = this.imodel.elements.getAspect(ids.aspectId) as ExternalSourceAspect;
    } catch (err) {
      // Unfortunately, the only way we can find out if an aspect is NOT there is by getting an
      // error when asking for it.
      if (!(err instanceof IModelError) || (err.errorNumber !== IModelStatus.NotFound)) {
        throw err;
      }

      return results;
    }

    if (undefined === aspect)
      return results;

    this._seenAspects.add(aspect.id);

    results.existingExternalSourceAspect = aspect.toJSON();
    results.id = ids.elementId;

    if (item.version !== undefined && item.version === aspect.version) {
      results.state = ItemState.Unchanged;
      return results;
    }

    if ((item.checksum?.() ?? item.version) !== (aspect.checksum ?? aspect.version)) {
      results.state = ItemState.Changed;
      return results;
    }

    results.state = ItemState.Unchanged;
    return results;
  }

  /** Update the iModel with the results of converting an item to one or more Elements.
   * If the item is new or changed, the conversion writes are written to the iModel and the associated ExternalSourceAspect is updated.
   * If the item is known and unchanged, then the iModel is not updated.
   * In either case, this function will record the id of the element as having been seen.
   * @param results The Element to be inserted or updated
   * @param sourceItem Whether the element is new, changed, or unchanged
   * @see [[SourceItem]] for an explanation of how an entity from an external source is tracked.
   * @beta
   */
  public updateIModel(results: SynchronizationResults, sourceItem: SourceItem): IModelStatus {
    this.setSourceItemDefaults(sourceItem);
    assert(sourceItemHasScopeAndKind(sourceItem));

    let status: IModelStatus = IModelStatus.Success;

    if (ItemState.Unchanged === results.itemState) {
      if (results.elementProps.id === undefined || !Id64.isValidId64(results.elementProps.id)) {
        throw new IModelError(IModelStatus.BadArg, "missing id");
      }
      this.onElementSeen(results.elementProps.id);
      return status;
    }

    // __PUBLISH_EXTRACT_START__ Synchronizer-updateIModel.example-code
    let aspectId: Id64String | undefined;
    if (sourceItem.id !== "") {
      const xsas = ExternalSourceAspect.findAllBySource(this.imodel, sourceItem.scope, sourceItem.kind, sourceItem.id);
      if (xsas.length > 1)
        return IModelStatus.DuplicateName;
      const xsa = xsas[0];
      if (xsa.aspectId !== undefined) {
        aspectId = xsa.aspectId;
      }
    // __PUBLISH_EXTRACT_END__
    }

    // WIP: Handle the case where we are doing a delete + insert and are re-using the old element's id
    // let forceInsert: boolean = false;
    // if (undefined !== eid) {
    //   if (this._iModelDb.elements.tryGetElement(eid) === undefined) {
    //     forceInsert = true;
    //   }
    // }

    const aspectProps = this.makeExternalSourceAspectPropsFromSourceItem(sourceItem);

    if (undefined !== aspectId) {
      if (IModelStatus.Success !== (status = this.updateResultsInIModel(results, aspectProps))) {
        return status;
      }
    } else {
      if (IModelStatus.Success !== (status = this.insertResultsIntoIModel(results, aspectProps))) {
        return status;
      }
    }

    assert(results.elementProps.id !== undefined && Id64.isValidId64(results.elementProps.id));

    return status;
  }

  /** Adds or updates the external source aspect for the given source item onto the related element - this function is rarely needed,
   * because updateIModel automatically inserts or updates ExternalSourceAspects for the elements that it processes.
   * @param element The element to attach the ExternalSourceAspect
   * @param itemState The state of the source item
   * @param sourceItem Defines the source item
   * @beta
   */
  public setExternalSourceAspect(element: ElementProps, itemState: ItemState, sourceItem: SourceItem): IModelStatus {
    assert(element.id !== undefined && Id64.isValidId64(element.id));

    this.setSourceItemDefaults(sourceItem);
    assert(sourceItemHasScopeAndKind(sourceItem));

    const aspectProps = this.makeExternalSourceAspectPropsFromSourceItem(sourceItem, element.id);

    if (itemState === ItemState.New) {
      this.imodel.elements.insertAspect(aspectProps); // throws on error
    } else {
      this.imodel.elements.updateAspect(aspectProps);
    }

    return IModelStatus.Success;
  }

  /** Returns the External Source Element associated with a repository link
   * @param repositoryLink The repository link associated with the External Source Element
   * @beta
   */
  public getExternalSourceElement(repositoryLink: Element): ExternalSourceProps | undefined {
    return this.getExternalSourceElementByLinkId(repositoryLink.id);
  }

  /** Returns the External Source Element associated with a repository link
   * @param repositoryLinkId The ElementId of the repository link associated with the External Source Element
   * @beta
   */
  public getExternalSourceElementByLinkId(repositoryLinkId: Id64String): ExternalSourceProps | undefined {
    let sourceId;
    this.imodel.withStatement(
      "select * from BisCore.ExternalSource where repository.id=?",
      (stmt) => {
        stmt.bindValues([repositoryLinkId]);
        stmt.step();
        const row = stmt.getRow();
        sourceId = row.id;
      },
    );

    if (sourceId) {
      return this.imodel.elements.getElementProps<ExternalSourceProps>(sourceId);
    }

    return;
  }

  /** Given synchronizations results for an element (and possibly its children), insert the new element into the bim
   * @param results The result set to insert
   * @beta
   */
  public insertResultsIntoIModel(results: SynchronizationResults, aspectProps: ExternalSourceAspectProps): IModelStatus {
    const elementProps = results.elementProps;
    const elid = this.imodel.elements.insertElement(elementProps); // throws on error

    results.elementProps.id = elid;

    this.imodel.elements.insertAspect({ ...aspectProps, element: { id: elid } }); // throws on error

    this.onElementSeen(elid);
    if (undefined === results.childElements) {
      return IModelStatus.Success;
    }

    for (const child of results.childElements) {
      const parent = new RelatedElement({ id: elid, relClassName: ElementOwnsChildElements.classFullName });
      child.elementProps.parent = parent;
      const status = this.insertResultsIntoIModel(child, aspectProps);
      if (status !== IModelStatus.Success) {
        return status;
      }
    }
    return IModelStatus.Success;
  }

  /** Given synchronizations results for an element (and possibly its children), updates element in the bim
   * @param results The result set to insert
   * @beta
   */
  public updateResultsInIModel(results: SynchronizationResults, aspectProps: ExternalSourceAspectProps): IModelStatus {
    const status = this.updateResultInIModelForOneElement(results);
    if (IModelStatus.Success !== status) {
      return status;
    }

    this.imodel.elements.updateAspect({ ...aspectProps, element: { id: results.elementProps.id! } }); // throws on error

    return this.updateResultsInIModelForChildren(results, aspectProps);
  }

  /** Records that this particular element was visited during this synchronization. This information will later be used to determine which
   * previously existing elements no longer exist and should be deleted.
   * @beta
   */
  public onElementSeen(id: Id64String) {
    this._seenElements.add(id);
  }

  /** Deletes elements from a BriefcaseDb that were previously converted but not longer exist in the source data.
   * @beta
   */
  public detectDeletedElements() {
    if (this.imodel.isSnapshotDb())
      return;

    if (this._supportsMultipleFilesPerChannel)
      this.detectDeletedElementsInFiles();
    else
      this.detectDeletedElementsInChannel();
  }

  /** Detect and delete all elements and models that meet the following conditions:
   * a) are under the Job Subject,
   * b) were not "seen" by the Synchronizer, and
   * c) have an ExternalSourceAspect.
   * @see [[Synchronizer.onElementSeen]]
   */
  public detectDeletedElementsInChannel() {
    // This detection only is called for connectors that support a single source file per channel. If we skipped that file because it was unchanged, then we don't need to delete anything
    if (this._unchangedSources.length !== 0)
      return;

    deleteElementSubTrees(this.imodel, this.jobSubjectId, (elementId: string) => {
      if ((elementId === this.jobSubjectId) || this._seenElements.has(elementId))
        return false;

      // The element was not marked as having been seen.

      // Don't delete it unless we know that it is tracked.
      // Connectors create various kinds of control elements in the repository model under the Job Subject.
      // They also create definition models full of definition elements.
      // They don't always bother to add them to this._seenElements or to put ExternalSourceAspects on them.
      // We will take the presence of an ExternalSourceAspect as an indication that the element is to be tracked.
      // This is how the native-code connector framework works.
      // It's up to the connector to do GC on untracked elements.
      return this.imodel.elements.getAspects(elementId, ExternalSourceAspect.classFullName).length !== 0;
    });
  }

  private detectDeletedElementsInFiles() {
    for (const value of this._links.values()) {
      if (value.itemState === ItemState.Unchanged || value.itemState === ItemState.New)
        continue;
      assert(value.elementProps.id !== undefined && Id64.isValidId64(value.elementProps.id));
      this.detectDeletedElementsInScope(value.elementProps.id);
    }
  }

  private detectDeletedElementsInScope(scopeId: Id64String) {
    const sql = `SELECT aspect.Element.Id FROM ${ExternalSourceAspect.classFullName} aspect WHERE aspect.Scope.Id=?`;
    const elementsToDelete: Id64String[] = [];
    const defElementsToDelete: Id64String[] = [];
    this.imodel.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId(1, scopeId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const elementId = statement.getValue(0).getId();
        const element = this.imodel.elements.getElement(elementId);
        const hasSeenElement = this._seenElements.has(elementId);
        if (!hasSeenElement) {
          if (element instanceof DefinitionElement)
            defElementsToDelete.push(elementId);
          else
            elementsToDelete.push(elementId);
        }
        this.detectDeletedElementsInScope(elementId);
      }
    });
    this.deleteElements(elementsToDelete, defElementsToDelete);
  }

  private deleteElements(elementIds: Id64String[], defElementIds: Id64String[]) {
    for (const elementId of elementIds) {
      if (this.imodel.elements.tryGetElement(elementId)) {
        this.imodel.elements.deleteElement(elementIds);
        const aspects = this.imodel.elements.getAspects(elementId, ElementUniqueAspect.classFullName);
        for (const aspect of aspects) {
          if (!this._seenAspects.has(aspect.id))
            this.imodel.elements.deleteAspect(aspect.id);
        }
      }
    }
    for (const elementId of defElementIds) {
      if (this.imodel.elements.tryGetElement(elementId))
        this.imodel.elements.deleteDefinitionElements(defElementIds);
    }
  }

  private updateResultInIModelForOneElement(results: SynchronizationResults): IModelStatus {
    assert(results.elementProps !== undefined, "don't call this function if you don't have a persistent element");
    const elementProps = results.elementProps;
    if (elementProps.id === undefined || !Id64.isValidId64(elementProps.id))
      throw new IModelError(IModelStatus.BadArg, "don't call this function if you don't have a persistent element");
    this.onElementSeen(elementProps.id);
    const existing = this.imodel.elements.tryGetElement(elementProps.id);
    if (undefined === existing) {
      return IModelStatus.BadArg;
    }
    if (existing.classFullName !== elementProps.classFullName) {
      const error = `Attempt to change element's class in an update operation. Do delete + add instead. ElementId ${elementProps.id},
      old class=${existing.classFullName}, new class=${elementProps.classFullName}`;
      Logger.logError(LoggerCategories.Framework, error);
      return IModelStatus.WrongClass;
    }
    this.imodel.elements.updateElement(elementProps);

    assert(elementProps.id !== undefined && Id64.isValidId64(elementProps.id));

    return IModelStatus.Success;
  }

  private updateResultsInIModelForChildren(results: SynchronizationResults, parentAspectProps: ExternalSourceAspectProps): IModelStatus {
    if (undefined === results.childElements || results.childElements.length < 1) {
      return IModelStatus.Success;
    }
    if (results.elementProps.id === undefined || !Id64.isValidId64(results.elementProps.id)) {
      const error = `Parent element id is invalid.  Unable to update the children.`;
      Logger.logError(LoggerCategories.Framework, error);
      return IModelStatus.BadArg;
    }
    results.childElements.forEach((child) => {
      const parent = new RelatedElement({ id: results.elementProps.id!, relClassName: ElementOwnsChildElements.classFullName });
      child.elementProps.parent = parent;
    });

    const existingChildren = this.imodel.elements.queryChildren(results.elementProps.id);
    // While we could just delete all existing children and insert all new ones, we try to do better.
    // If we can figure out how the new children map to existing children, we can update them.

    // Note that in the update logic below we don't delete existing children that were not mapped.
    // Instead, we just refrain from calling the change detector's _OnElementSeen method on unmatched child elements.
    // That will allow the updater in its final phase to infer that they should be deleted.

    // If the specified children have ElementIds, then match existing child elements by ElementId.
    // This is generally the case only when updating an existing parent element.
    if (undefined !== results.childElements[0].elementProps && results.childElements[0].elementProps.id !== undefined && Id64.isValidId64(results.childElements[0].elementProps.id)) {
      for (const childRes of results.childElements) {
        if (undefined === childRes.elementProps) {
          continue;
        }
        const index = existingChildren.findIndex((c) => c === childRes.elementProps.id);
        if (-1 !== index) {
          const stat = this.updateResultsInIModel(childRes, parentAspectProps);
          if (stat !== IModelStatus.Success) {
            return stat;
          }
        }
      }
      return IModelStatus.Success;
    }

    // The specified children do not have ElementIds.
    const count = Math.min(existingChildren.length, results.childElements.length);
    let i = 0;
    for (; i < count; i++) {
      this.updateResultsInIModel(results.childElements[i], parentAspectProps);
    }
    for (; i < results.childElements.length; i++) {
      this.insertResultsIntoIModel(results.childElements[i], parentAspectProps);
    }
    return IModelStatus.Success;
  }

  private makeRepositoryLink(code: Code, userLabel: string | undefined, docProps: DocumentProperties | undefined): Element {
    let repositoryLink = this.imodel.elements.tryGetElement(code) as RepositoryLink;
    if (undefined === repositoryLink) {
      const elementProps: RepositoryLinkProps = {
        classFullName: RepositoryLink.classFullName,
        model: IModel.repositoryModelId,
        code,
        url: docProps?.desktopURN,
        userLabel,
        description: userLabel,
        repositoryGuid: docProps?.docGuid,
      };
      if (docProps !== undefined) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        elementProps.jsonProperties = { DocumentProperties: { desktopURN: docProps.desktopURN, webURN: docProps.webURN, attributes: docProps.attributesJson } };
      }
      repositoryLink = this.imodel.elements.createElement(elementProps);
    }
    return repositoryLink;
  }

  /** Utility function to parse the GUID portion of a ProjectWise URI. Returns an empty GUID if the parse fails. */
  public static parseDocGuidFromPwUri(pwUri: string): GuidString {
    const emptyGuid: GuidString = Guid.empty;
    if (!pwUri.startsWith("pw://")) {
      return emptyGuid;
    }

    let startDguid = pwUri.indexOf("/D{");
    if (-1 === startDguid) {
      startDguid = pwUri.indexOf("/d{");
    }

    if (-1 === startDguid)
      return emptyGuid;
    const endDguid = pwUri.indexOf("}", startDguid);
    if (-1 === endDguid)
      return emptyGuid;

    const startGuid = startDguid + 3;
    const guidStr = pwUri.substring(startGuid, endDguid);
    if (Guid.isV4Guid(guidStr)) {
      return guidStr;
    }
    return emptyGuid;
  }

  private makeExternalSourceAspectPropsFromSourceItem(sourceItem: ItemWithScopeAndKind, elementId?: Id64String): ExternalSourceAspectProps {
    const source = sourceItem.source ? { id: sourceItem.source } : undefined;
    return {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId ?? "" },
      scope: { id: sourceItem.scope },
      identifier: sourceItem.id,
      kind: sourceItem.kind,
      checksum: sourceItem.checksum?.(),
      version: sourceItem.version,
      source,
    };
  }

  public makeExternalSourceAspectProps(sourceItem: SourceItem): ExternalSourceAspectProps {
    this.setSourceItemDefaults(sourceItem);
    assert(sourceItemHasScopeAndKind(sourceItem));
    return this.makeExternalSourceAspectPropsFromSourceItem(sourceItem);
  }

  public updateRepositoryLinks(): void {
    for (const link of this._links.values()) {
      this.imodel.elements.updateAspect(link.postChangeAspect);
    }
  }

}
