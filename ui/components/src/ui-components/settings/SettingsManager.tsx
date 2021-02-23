/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import { BeUiEvent, Logger } from "@bentley/bentleyjs-core";
import { ConditionalBooleanValue } from "@bentley/ui-abstract";
import { UiComponents } from "../UiComponents";

/** @alpha */
export interface SettingsEntry {
  /** unique id for entry */
  readonly tabId: string;
  /** localized display label */
  readonly label: string;
  /** Setting page content to display when tab item is selected. */
  readonly page: JSX.Element;
  /** Setting to true if page will register to watch for stage closing event so it can save any dirty settings. Page component should register and handle the events:
   * `settingsManager.onProcessSettingsTabActivation` and `settingsManager.onProcessSettingsContainerClose` */
  readonly pageWillHandleCloseRequest?: boolean;
  /** used to determine position in tablist */
  readonly itemPriority: number;
  /** Optional Subtitle to show below label. */
  readonly subLabel?: string;
  /** Icon specification */
  readonly icon?: string | JSX.Element;
  /** Tooltip. Allows JSX|Element to support react-tooltip component */
  readonly tooltip?: string | JSX.Element;
  /** Allows Settings entry to be disabled */
  readonly isDisabled?: boolean | ConditionalBooleanValue;
}

/** Event class for [[this.onSettingsProvidersChanged]] which is emitted when a new SettingsProvider is added or removed.
 * @internal
 */
export class SettingsProvidersChangedEvent extends BeUiEvent<SettingsProvidersChangedEventArgs> { }

/** Arguments of [[this.onSettingsProvidersChanged]] event.
 * @internal
 */
export interface SettingsProvidersChangedEventArgs {
  readonly providers: ReadonlyArray<SettingsProvider>;
}

/** Event class for [[this.onProcessSettingsTabActivation]] which is emitted when a new Tab needs to be activated. This allows the current
 * settings page to save its settings before activating the new SettingTab.
 * @internal
 */
export class ProcessSettingsTabActivationEvent extends BeUiEvent<ProcessSettingsTabActivationEventArgs> { }

/** Arguments of [[this.onProcessSettingsTabActivation]] event.
 * @internal
 */
export interface ProcessSettingsTabActivationEventArgs {
  readonly requestedSettingsTabId: string;
  readonly tabSelectionFunc: (tabId: string) => void;
}

/** Event class for [[this.onProcessSettingsContainerClose]] which is emitted when the settings container will be close. This allows the current
 * settings page to save its settings before calling the function to close the container.
 * @internal
 */
export class ProcessSettingsContainerCloseEvent extends BeUiEvent<ProcessSettingsContainerCloseEventArgs> { }

/** Event class for [[this.onCloseSettingsContainer]] which is emitted when the settings container should be closed given the closing function and its args.
 * @internal
 */
export class CloseSettingsContainerEvent extends BeUiEvent<ProcessSettingsContainerCloseEventArgs> { }

/** Arguments of [[this.onProcessSettingsContainerClose]] event.
 * @internal
 */
export interface ProcessSettingsContainerCloseEventArgs {
  readonly closeFunc: (args: any) => void;
  readonly closeFuncArgs?: any;
}

/** Event class for [[this.onActivateSettingsTab]] which is emitted when API call needs to set the active settings tab (ie via Tool key-in).
 * @internal
 */
export class ActivateSettingsTabEvent extends BeUiEvent<ActivateSettingsTabEventArgs> { }

/** Arguments of [[this.onActivateSettingsTab]] event.
 * @internal
 */
export interface ActivateSettingsTabEventArgs {
  readonly settingsTabId: string;
}

/** Setting Provider interface.
 * @alpha
 */
export interface SettingsProvider {
  /** Id of provider */
  readonly id: string;
  getSettingEntries(stageId: string, stageUsage: string): ReadonlyArray<SettingsEntry> | undefined;
}

/** Settings Manager class.
 * @alpha
 */
export class SettingsManager {
  private _providers: ReadonlyArray<SettingsProvider> = [];

  /** Event raised when SettingsProviders are changed.
   * @internal
   */
  public readonly onSettingsProvidersChanged = new SettingsProvidersChangedEvent();

  /** Event raised to for settings page to monitor to intercept SettingTab changes so changed settings can be saved before continuing tab activation.
   * @internal
   */
  public readonly onProcessSettingsTabActivation = new ProcessSettingsTabActivationEvent();

  /** Event raised to change the active settings tab shown in UI.
   * @internal
   */
  public readonly onActivateSettingsTab = new ActivateSettingsTabEvent();

  /** Event raised to change the active settings tab shown in UI.
   * @internal
   */
  public readonly onProcessSettingsContainerClose = new ProcessSettingsContainerCloseEvent();

  public readonly onCloseSettingsContainer = new CloseSettingsContainerEvent();

  /** @internal */
  public get providers(): ReadonlyArray<SettingsProvider> { return this._providers; }
  public set providers(p: ReadonlyArray<SettingsProvider>) {
    this._providers = p;
    this.onSettingsProvidersChanged.emit({ providers: p });
  }

  public processSettingsTabActivation(settingsTabId: string, tabSelectionFunc: (tabId: string) => void) {
    this.onProcessSettingsTabActivation.emit({ requestedSettingsTabId: settingsTabId, tabSelectionFunc });
  }

  public activateSettingsTab(settingsTabId: string) {
    this.onActivateSettingsTab.emit({ settingsTabId });
  }

  public processSettingsContainerClose(closeFunc: (args: any) => void, closeFuncArgs?: any) {
    this.onProcessSettingsContainerClose.emit({ closeFunc, closeFuncArgs });
  }

  public closeSettingsContainer(closeFunc: (args: any) => void, closeFuncArgs?: any) {
    this.onCloseSettingsContainer.emit({ closeFunc, closeFuncArgs});
  }

  public addSettingsProvider(settingsProvider: SettingsProvider): void {
    const foundProvider = this._providers.find((p) => p.id === settingsProvider.id);
    if (!foundProvider) {
      const updatedProviders = [
        ...this.providers,
        settingsProvider,
      ];
      this.providers = updatedProviders;
    } else {
      Logger.logInfo(UiComponents.loggerCategory(UiComponents), `Settings Provider with id of ${settingsProvider.id} has already been registered`);
    }
  }

  public removeSettingsProvider(providerId: string): boolean {
    let result = false;
    const updatedProviders = this._providers.filter((p) => p.id !== providerId);
    if (updatedProviders.length !== this._providers.length) {
      this.providers = updatedProviders;
      result = true;
    }

    return result;
  }

  /** Get an array of SettingsEntry objects to populate the settings container. */
  public getSettingEntries(stageId: string, stageUsage: string): Array<SettingsEntry> | undefined {
    const allSettingEntries: SettingsEntry[] = [];
    // Consult the registered SettingsProviders
    this._providers.forEach((p) => {
      const entries = p.getSettingEntries(stageId, stageUsage);
      if (entries) {
        allSettingEntries.push(...entries);
      }
    });

    return allSettingEntries.length > 0 ? allSettingEntries : undefined;
  }
}
