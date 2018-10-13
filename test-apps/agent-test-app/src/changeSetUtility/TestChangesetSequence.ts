/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** Class containing changeset sequence meta-data. Can be used to generate changesets over elements in the iModelDb */
export class TestChangesetSequence {
    public readonly elementsUpdatedPerChangeset: number;
    public readonly elementsDeletedPerChangeset: number;
    public constructor(public changesetCount: number, public elementsCreatedPerChangeset: number = 2,
        public changesetPushDelay: number = 1000) {
        // Each Changeset will consist of inserting N elements, and updating and deleting N elements if they exist.
        // Each changeset creation/push will pause for 'changesetPushDelay' ms before creating another changeset
        this.elementsUpdatedPerChangeset = Math.floor(elementsCreatedPerChangeset / 2);
        this.elementsDeletedPerChangeset = this.elementsUpdatedPerChangeset;
    }
}
