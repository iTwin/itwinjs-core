/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { EditTxn, withEditTxn } from "../../EditTxn";
import {
  Code, ExternalSourceAttachmentProps, ExternalSourceProps, IModel, RepositoryLinkProps, SynchronizationConfigLinkProps,
} from "@itwin/core-common";
import {
  ExternalSource, ExternalSourceAttachment, ExternalSourceAttachmentAttachesSource, ExternalSourceGroup, ExternalSourceGroupGroupsSources,
  ExternalSourceIsInRepository, ExternalSourceOwnsAttachments, FolderContainsRepositories, FolderLink, LinkElement, RepositoryLink,
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

    withEditTxn(iModelDb, (txn) => {
      const syncJob = insertSynchronizationConfigLink(txn, "Synchronization Job");

      const folder = insertFolderLink(txn, "Folder", "https://test.bentley.com/folder");

      const repositoryM = insertRepositoryLink(txn, folder, "master.dgn", "https://test.bentley.com/folder/master.dgn", "DGN");
      const repositoryA = insertRepositoryLink(txn, folder, "a.dgn", "https://test.bentley.com/folder/a.dgn", "DGN");
      const repositoryB = insertRepositoryLink(txn, folder, "b.dgn", "https://test.bentley.com/folder/b.dgn", "DGN");
      const repositoryC = insertRepositoryLink(txn, folder, "c.dgn", "https://test.bentley.com/folder/c.dgn", "DGN");

      const modelM = insertExternalSource(txn, repositoryM, "M");
      const modelA = insertExternalSource(txn, repositoryA, "A");
      const modelB = insertExternalSource(txn, repositoryB, "B");
      const modelC = insertExternalSource(txn, repositoryC, "C");

      txn.insertRelationship({ classFullName: SynchronizationConfigSpecifiesRootSources.classFullName, sourceId: syncJob, targetId: modelM });
      txn.insertRelationship({ classFullName: SynchronizationConfigProcessesSources.classFullName, sourceId: syncJob, targetId: modelA });
      txn.insertRelationship({ classFullName: SynchronizationConfigProcessesSources.classFullName, sourceId: syncJob, targetId: modelB });
      txn.insertRelationship({ classFullName: SynchronizationConfigProcessesSources.classFullName, sourceId: syncJob, targetId: modelC });

      const group1 = insertExternalSourceGroup(txn, "Group1");
      txn.insertRelationship({ classFullName: ExternalSourceGroupGroupsSources.classFullName, sourceId: group1, targetId: modelA });
      txn.insertRelationship({ classFullName: ExternalSourceGroupGroupsSources.classFullName, sourceId: group1, targetId: modelB });
      txn.insertRelationship({ classFullName: ExternalSourceGroupGroupsSources.classFullName, sourceId: group1, targetId: modelC });

      insertExternalSourceAttachment(txn, modelM, modelA, "A");
      insertExternalSourceAttachment(txn, modelM, modelB, "B");
      insertExternalSourceAttachment(txn, modelA, modelC, "C");
      insertExternalSourceAttachment(txn, modelB, modelC, "C");
    });
    iModelDb.close();
  });

  function insertSynchronizationConfigLink(txn: EditTxn, name: string): Id64String {
    const configProps: SynchronizationConfigLinkProps = {
      classFullName: SynchronizationConfigLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(txn.iModel, IModel.repositoryModelId, name),
    };
    return txn.insertElement(configProps);
  }

  function insertFolderLink(txn: EditTxn, codeValue: string, url: string): Id64String {
    const folderLinkProps: RepositoryLinkProps = {
      classFullName: FolderLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(txn.iModel, IModel.repositoryModelId, codeValue),
      url,
    };
    return txn.insertElement(folderLinkProps);
  }

  function insertRepositoryLink(txn: EditTxn, folderId: Id64String, codeValue: string, url: string, format: string): Id64String {
    const repositoryLinkProps: RepositoryLinkProps = {
      classFullName: RepositoryLink.classFullName,
      model: IModel.repositoryModelId,
      parent: new FolderContainsRepositories(folderId),
      code: LinkElement.createCode(txn.iModel, IModel.repositoryModelId, codeValue),
      url,
      format,
    };
    return txn.insertElement(repositoryLinkProps);
  }

  function insertExternalSource(txn: EditTxn, repository: Id64String, userLabel: string): Id64String {
    const externalSourceProps: ExternalSourceProps = {
      classFullName: ExternalSource.classFullName,
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
      userLabel,
      repository: new ExternalSourceIsInRepository(repository),
      connectorName: "Connector",
      connectorVersion: "0.0.1",
    };
    return txn.insertElement(externalSourceProps);
  }

  function insertExternalSourceAttachment(txn: EditTxn, masterModel: Id64String, attachedModel: Id64String, label: string): Id64String {
    const attachmentProps: ExternalSourceAttachmentProps = {
      classFullName: ExternalSource.classFullName,
      model: IModel.repositoryModelId,
      parent: new ExternalSourceOwnsAttachments(masterModel),
      code: Code.createEmpty(),
      userLabel: label,
      attaches: new ExternalSourceAttachmentAttachesSource(attachedModel),
    };
    return txn.insertElement(attachmentProps);
  }

  function insertExternalSourceGroup(txn: EditTxn, userLabel: string): Id64String {
    const groupProps: ExternalSourceProps = {
      classFullName: ExternalSourceGroup.classFullName,
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
      userLabel,
      repository: undefined,
      connectorName: "Connector",
      connectorVersion: "0.0.1",
    };
    return txn.insertElement(groupProps);
  }
});
