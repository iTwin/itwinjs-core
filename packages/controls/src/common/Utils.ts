/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { ECPresentation } from "@bentley/ecpresentation-frontend";

export interface IPrioritized {
  priority: number;
}
export const prioritySortFunction = (a: IPrioritized, b: IPrioritized): number => {
  if (a.priority > b.priority)
    return -1;
  if (a.priority < b.priority)
    return 1;
  return 0;
};

let localizationNamespace: I18NNamespace | undefined;
export const translate = async (stringId: string): Promise<string> => {
  const localizationNamespaceName = "ECPresentationControls";
  if (!localizationNamespace) {
    localizationNamespace = ECPresentation.i18n.registerNamespace(localizationNamespaceName);
  }
  await localizationNamespace.readFinished;
  stringId = `${localizationNamespaceName}:${stringId}`;
  return ECPresentation.i18n.translate(stringId);
};
