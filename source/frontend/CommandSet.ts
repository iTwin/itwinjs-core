/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { iModelApp } from "./IModelApp";
import { Tool } from "./tools/Tool";
import * as Fuse from "fuse.js";

export type CommandMap = Map<string, typeof Tool>;

export class CommandSet {
  private allCommands: CommandMap;
  private fuseOptions: Fuse.FuseOptions;

  constructor() {
    this.fuseOptions = {
      shouldSort: true,
      threshold: 0.33,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
      includeMatches: true,
      includeScore: true,
      keys: ["tags"],
    };
    this.allCommands = new Map<string, typeof Tool>();
  }

  // get an iterator of the CommandMap
  public async getAllCommands(): Promise<CommandMap> {
    this.allCommands = await iModelApp.tools.getKeyinMap();
    return this.allCommands;
  }

  public async findPartialMatches(keyin: string): Promise<SearchResults | undefined> {
    const commandMap: CommandMap = await this.getAllCommands();
    const fuse = new Fuse([...commandMap.keys()], this.fuseOptions);
    let searchResults: SearchResults = new SearchResults([]);
    if (keyin.length > 0) {
      searchResults = new SearchResults(fuse.search(keyin));
      searchResults.dump();
      return searchResults;
    }
    return undefined;
  }

  public async findExactMatch(keyin: string): Promise<typeof Tool | undefined> {
    const commandMap: CommandMap = await (this.getAllCommands());
    return commandMap.get(keyin);
  }

  public async executeExactMatch(keyin: string, args?: string): Promise<boolean> {
    const found: typeof Tool | undefined = await this.findExactMatch(keyin);
    return (found) ? this.runCommand(found, args) : false;
  }

  public runCommand(tool: typeof Tool, _args?: string): boolean {
    // test to see if we command a Tool class object or a Tool subclass class object.
    return iModelApp.tools.run(tool.toolId);
  }
}

export class SearchResults {
  public results: any[];

  constructor(results: any[]) {
    this.results = results;
  }

  public dump(): void {
    for (let iResult = 0; iResult < this.results.length; iResult++) {
      const result: any = this.results[iResult];
      // tslint:disable-next-line:no-console
      console.log("Result", iResult, ":", result);
    }
  }

}
