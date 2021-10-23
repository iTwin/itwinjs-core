/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { IModelTestUtils } from "../IModelTestUtils";

import { IModel, RepositoryLinkProps } from "@itwin/core-common";
import { RepositoryLink } from "../../Element";
import { SnapshotDb } from "../../IModelDb";

const testFileName = "UrlLinkTest.bim";
const subDirName = "UrlLinkTrip";
const iModelPath = IModelTestUtils.prepareOutputFile(subDirName, testFileName);

describe("UrlLink tests", () => {
  it("Link should construct properly", () => {
    const imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "UrlLinkTest" } });
    const linkProps: RepositoryLinkProps = {
      description: "This is a test repository link",
      url: "http://itwinjs.org",
      repositoryGuid: Guid.createValue(),
      classFullName: RepositoryLink.classFullName,
      code: RepositoryLink.createCode(imodel, IModel.repositoryModelId, "MyTestValue"),
      model: IModel.repositoryModelId,
    };

    const linkElement = imodel.elements.createElement(linkProps);
    const id = imodel.elements.insertElement(linkElement);
    assert.isTrue(Id64.isValidId64(id), "insert worked");
    imodel.saveChanges();

    // verify inserted element properties
    const actualValue = imodel.elements.getElementProps<RepositoryLink>(id);
    assert.equal(actualValue.url, linkProps.url, "Repository link url not set as expected");
    assert.equal(actualValue.description, linkProps.description, "Repository link description not set as expected");
    assert.equal(actualValue.repositoryGuid, linkProps.repositoryGuid, "Repository link guid not set as expected.");
  });
});
