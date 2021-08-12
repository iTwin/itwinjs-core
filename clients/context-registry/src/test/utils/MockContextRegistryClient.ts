/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ContextRegistryNTBD, ITwin } from "../../ContextAccessProps";

class MockITwin implements ITwin {
  public name?: string | undefined;
  public id: string;
  public iTwinNumber?: string | undefined;

  public constructor(id: string, name?: string, iTwinNumber?: string) {
    this.id = id;
    this.name = name;
    this.iTwinNumber = iTwinNumber;
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars */

class MockContextRegistryClient implements ContextRegistryNTBD {
  public readonly iTwinList: MockITwin[];

  public constructor(customITwinList?: ITwin[]) {
    this.iTwinList = [];

    if (customITwinList !== undefined) {
      // Use provided list
      this.iTwinList = customITwinList;
    } else {
      // Create list if none provided
      for (let i = 0; i < 3; i++) {
        const iTwin = new MockITwin(Guid.createValue(), `ITwin name ${i}`, `ITwin number ${i}`);
        this.iTwinList.push(iTwin);
      }
    }
  }

  public async getITwins(requestContext: AuthorizedClientRequestContext): Promise<ITwin[]> {
    // Shuffle to prevent tests from being order dependent
    return this.iTwinList.sort(() => 0.5 - Math.random());
  }

  public async getITwinByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const matches = this.iTwinList.filter((iTwin) => (iTwin.name === name));

    if (matches.length === 0)
      throw new Error("Could not find an iTwin with the specified criteria that the user has access to");
    else if (matches.length > 1)
      throw new Error("More than one iTwin found with the specified criteria");
    return matches[0];
  }

  public async getITwinById(requestContext: AuthorizedClientRequestContext, id: string): Promise<ITwin> {
    const matches = this.iTwinList.filter((iTwin) => (iTwin.id === id));

    if (matches.length === 0)
      throw new Error("Could not find an iTwin with the specified criteria that the user has access to");
    else if (matches.length > 1)
      throw new Error("More than one iTwin found with the specified criteria");
    return matches[0];
  }
}
