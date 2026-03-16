/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { editTxnOf } from "../TestEditTxn";
import {
  Code, ExternalSourceAttachmentProps, ExternalSourceProps, IModel, RepositoryLinkProps, SynchronizationConfigLinkProps,
} from "@itwin/core-common";
import {
  ExternalSource, ExternalSourceAttachment, ExternalSourceAttachmentAttachesSource, ExternalSourceGroup, ExternalSourceGroupGroupsSources,
  ExternalSourceIsInRepository, ExternalSourceOwnsAttachments, FolderContainsRepositories, FolderLink, IModelDb, LinkElement, RepositoryLink,
  SnapshotDb, SynchronizationConfigLink, SynchronizationConfigProcessesSources, SynchronizationConfigSpecifiesRootSources,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("ExternalSource", () => {

  it("should create elements and relationships like an iModel Connector would", () => {
    const iModelFileName = IModelTestUtils.prepareOutputFile("ExternalSource", "ExternalSource.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "ExternalSource Test" } });

    assert.isTrue(iModelDb.containsClass(SynchronizationConfigLink.classFullName));
    assert.isTrue(iModelDb.containsClass(ExternalSource.classFullName));
    assert.isTrue(iModelDb.containsClass(ExternalSourceIsInRepository.classFullName));
    assert.isTrue(iModelDb.containsClass(ExternalSourceAttachment.classFullName));
    assert.isTrue(iModelDb.containsClass(ExternalSourceGroup.classFullName));

    const syncJob = insertSynchronizationConfigLink(iModelDb, "Synchronization Job");

    const folder = insertFolderLink(iModelDb, "Folder", "https://test.bentley.com/folder");

    const repositoryM = insertRepositoryLink(iModelDb, folder, "master.dgn", "https://test.bentley.com/folder/master.dgn", "DGN");
    const repositoryA = insertRepositoryLink(iModelDb, folder, "a.dgn", "https://test.bentley.com/folder/a.dgn", "DGN");
    const repositoryB = insertRepositoryLink(iModelDb, folder, "b.dgn", "https://test.bentley.com/folder/b.dgn", "DGN");
    const repositoryC = insertRepositoryLink(iModelDb, folder, "c.dgn", "https://test.bentley.com/folder/c.dgn", "DGN");

    const modelM = insertExternalSource(iModelDb, repositoryM, "M");
    const modelA = insertExternalSource(iModelDb, repositoryA, "A");
    const modelB = insertExternalSource(iModelDb, repositoryB, "B");
    const modelC = insertExternalSource(iModelDb, repositoryC, "C");

    editTxnOf(iModelDb).insertRelationship({ classFullName: SynchronizationConfigSpecifiesRootSources.classFullName, sourceId: syncJob, targetId: modelM });
    editTxnOf(iModelDb).insertRelationship({ classFullName: SynchronizationConfigProcessesSources.classFullName, sourceId: syncJob, targetId: modelA });
    editTxnOf(iModelDb).insertRelationship({ classFullName: SynchronizationConfigProcessesSources.classFullName, sourceId: syncJob, targetId: modelB });
    editTxnOf(iModelDb).insertRelationship({ classFullName: SynchronizationConfigProcessesSources.classFullName, sourceId: syncJob, targetId: modelC });

    const group1 = insertExternalSourceGroup(iModelDb, "Group1");
    editTxnOf(iModelDb).insertRelationship({ classFullName: ExternalSourceGroupGroupsSources.classFullName, sourceId: group1, targetId: modelA });
    editTxnOf(iModelDb).insertRelationship({ classFullName: ExternalSourceGroupGroupsSources.classFullName, sourceId: group1, targetId: modelB });
    editTxnOf(iModelDb).insertRelationship({ classFullName: ExternalSourceGroupGroupsSources.classFullName, sourceId: group1, targetId: modelC });

    const _attachmentMA = insertExternalSourceAttachment(iModelDb, modelM, modelA, "A");
    const _attachmentMB = insertExternalSourceAttachment(iModelDb, modelM, modelB, "B");
    const _attachmentAC = insertExternalSourceAttachment(iModelDb, modelA, modelC, "C");
    const _attachmentBC = insertExternalSourceAttachment(iModelDb, modelB, modelC, "C");

    editTxnOf(iModelDb).saveChanges();
    iModelDb.close();
  });

  function insertSynchronizationConfigLink(iModelDb: IModelDb, name: string): Id64String {
    const configProps: SynchronizationConfigLinkProps = {
      classFullName: SynchronizationConfigLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(iModelDb, IModel.repositoryModelId, name),
    };
    return editTxnOf(iModelDb).insertElement(configProps);
  }

  function insertFolderLink(iModelDb: IModelDb, codeValue: string, url: string): Id64String {
    const folderLinkProps: RepositoryLinkProps = {
      classFullName: FolderLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(iModelDb, IModel.repositoryModelId, codeValue),
      url,
    };
    return editTxnOf(iModelDb).insertElement(folderLinkProps);
  }

  function insertRepositoryLink(iModelDb: IModelDb, folderId: Id64String, codeValue: string, url: string, format: string): Id64String {
    const repositoryLinkProps: RepositoryLinkProps = {
      classFullName: RepositoryLink.classFullName,
      model: IModel.repositoryModelId,
      parent: new FolderContainsRepositories(folderId),
      code: LinkElement.createCode(iModelDb, IModel.repositoryModelId, codeValue),
      url,
      format,
    };
    return editTxnOf(iModelDb).insertElement(repositoryLinkProps);
  }

  function insertExternalSource(iModelDb: IModelDb, repository: Id64String, userLabel: string): Id64String {
    const externalSourceProps: ExternalSourceProps = {
      classFullName: ExternalSource.classFullName,
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
      userLabel,
      repository: new ExternalSourceIsInRepository(repository),
      connectorName: "Connector",
      connectorVersion: "0.0.1",
    };
    return editTxnOf(iModelDb).insertElement(externalSourceProps);
  }

  function insertExternalSourceAttachment(iModelDb: IModelDb, masterModel: Id64String, attachedModel: Id64String, label: string): Id64String {
    const attachmentProps: ExternalSourceAttachmentProps = {
      classFullName: ExternalSource.classFullName,
      model: IModel.repositoryModelId,
      parent: new ExternalSourceOwnsAttachments(masterModel),
      code: Code.createEmpty(),
      userLabel: label,
      attaches: new ExternalSourceAttachmentAttachesSource(attachedModel),
    };
    return editTxnOf(iModelDb).insertElement(attachmentProps);
  }

  function insertExternalSourceGroup(iModelDb: IModelDb, userLabel: string): Id64String {
    const groupProps: ExternalSourceProps = {
      classFullName: ExternalSourceGroup.classFullName,
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
      userLabel,
      repository: undefined,
      connectorName: "Connector",
      connectorVersion: "0.0.1",
    };
    return editTxnOf(iModelDb).insertElement(groupProps);
  }
});
