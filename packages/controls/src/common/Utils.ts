/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { ECPresentation } from "@bentley/ecpresentation-frontend";

/**
 * An interface of something that has a priority.
 * @hidden
 */
export interface IPrioritized {
  priority: number;
}
/**
 * A sorting algorithm for `Array.sort` that sorts items by priority.
 * Higher priority items appear first in the list.
 * @hidden
 */
export const prioritySortFunction = (a: IPrioritized, b: IPrioritized): number => {
  if (a.priority > b.priority)
    return -1;
  if (a.priority < b.priority)
    return 1;
  return 0;
};

let localizationNamespace: I18NNamespace | undefined;
/**
 * Translate a string with the specified id from `ECPresentationControls`
 * localization namespace. The `stringId` should not contain namespace - it's
 * prepended automatically.
 * @hidden
 */
export const translate = async (stringId: string): Promise<string> => {
  const localizationNamespaceName = "ECPresentationControls";
  if (!localizationNamespace) {
    localizationNamespace = ECPresentation.i18n.registerNamespace(localizationNamespaceName);
  }
  await localizationNamespace.readFinished;
  stringId = `${localizationNamespaceName}:${stringId}`;
  return ECPresentation.i18n.translate(stringId);
};

export const getDisplayName = <P>(component: React.ComponentType<P>): string => {
  if (component.displayName)
    return component.displayName;
  if (component.name)
    return component.name;
  return "Component";
};
