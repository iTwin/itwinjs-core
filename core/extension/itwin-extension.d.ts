/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

declare module "itwin-extension" {
  /**
   * @alpha
   */
  export type ActivationEvent =
    | "onIModelAppStartup"
    | "onIModelAppStartupFinished"
    | "onIModelConnected"
    | `onCommand:${string}` // key-ins too?
    | "onSelectionChanged"
    | `onSchemaLoaded:${string}`; // for civil

  /**
   * @alpha
   */
  export interface ContributionPoint {
    commands?: Command[];
    tools?: Tool[];
  }

  /**
   * @alpha
   */
  export interface ExtensionManifest {
    /** The extension name */
    readonly name: string;
    /** The extension display name */
    readonly displayName?: string;
    /** The extension version */
    readonly version: string;
    /** The minimum compatible version of iTwin.js used */
    readonly coreVersion: string;
    /** The minimum compatible version of iTwin.js Extension Api used */
    readonly apiVersion: string;
    /** The extension description */
    readonly description?: string;
    /** The extension author */
    readonly author: string;
    /** List of all Activation Events */
    readonly activationEvents: ActivationEvent[];
    /** List of all Contribution Points */
    readonly contributionPoints: ContributionPoint[];
  }

  /**
   * @alpha
   */
  export interface Command {
    name: string;
    description?: string;
    arguments?: any[];
    execute: (args: any) => void;
  }

  export namespace Commands {
    export function registerCommand(command: Command): void;
    export function executeCommand(command: string, ...args: any[]): void;
  }

  /**
   * @alpha
   */
  export interface Tool {
    readonly name: string;
    readonly toolId: string;
    readonly icon: HTMLElement;
    readonly label?: string;
    tooltip?: string;
    arguments?: any[];
    readonly execute: (...args: any[]) => void;
  }

  export namespace Tools {
    /** Registers a tool that can be invoked */
    export function registerTool(tool: Tool);

    /** Executes the tool denoted by the identifier.
     *
     * @param toolId Identifier of the tool to execute
     * @param args Parameters passed to the tool when executed.
     */
    export function executeTool<T>(
      toolId: string,
      ...args: any[]
    ): Promise<void>;
  }
}
