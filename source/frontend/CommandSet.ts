/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { iModelApp } from "./IModelApp";
import { Tool } from "./tools/Tool";
import * as Fuse from "fuse.js";

export type CommandFunction = ((args?: string) => boolean);
export type CommandDispatcher = typeof Tool | CommandFunction;
export type CommandMap = Map<string, CommandDispatcher>;

export interface CommandProvider {
  getCommands(): CommandMap;
}

export class CommandSet {
  private commandProviders: CommandProvider[];
  private allCommands: CommandMap[];
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
    this.allCommands = new Array<CommandMap>();
    this.commandProviders = new Array<CommandProvider>();
  }

  // get an iterator of the CommandMap
  public async getAllCommands(): Promise<CommandMap[]> {
    this.allCommands[0] = await iModelApp.tools.getKeyinMap();

    for (let iProvider: number = 0; iProvider < this.commandProviders.length; iProvider++) {
      const thisProvider: CommandProvider = this.commandProviders[iProvider];

      if (thisProvider)
        this.allCommands[iProvider + 1] = thisProvider.getCommands();
      else
        this.allCommands[iProvider + 1] = undefined as any;
    }
    return this.allCommands;
  }

  // register a command provider with the CommandSet
  public registerCommandProvider(provider: CommandProvider): void {
    if (!this.commandProviders.includes(provider)) {
      this.commandProviders.push(provider);
    }
  }

  public async findPartialMatches(keyin: string): Promise<void> {
    const commandLists: CommandMap[] = await this.getAllCommands();
    const fuse = new Fuse(commandLists, this.fuseOptions);
    let searchResults: SearchResults = new SearchResults([]);
    if (keyin.length > 0) {
      searchResults = new SearchResults(fuse.search(keyin));
      searchResults.dump();
    }
  }

  public async findExactMatch(keyin: string): Promise<CommandDispatcher | undefined> {
    const commandLists: CommandMap[] = await (this.getAllCommands());
    for (const commandList of commandLists) {
      const found: CommandDispatcher | undefined = commandList.get(keyin);
      if (found)
        return found;
    }
    return undefined;
  }

  public async executeExactMatch(keyin: string, args?: string): Promise<boolean> {
    const found: CommandDispatcher | undefined = await this.findExactMatch(keyin);
    return (found) ? this.runCommand(found, args) : false;
  }

  public runCommand(command: CommandDispatcher, args?: string): boolean {
    // test to see if we command a Tool class object or a Tool subclass class object.
    if ((command.prototype instanceof Tool) || (command === Tool)) {
      const thisTool: typeof Tool = command as typeof Tool;
      return iModelApp.tools.run(thisTool.toolId);
    } else {
      const thisCommandFunction: CommandFunction = command as CommandFunction;
      return thisCommandFunction(args);
    }
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
