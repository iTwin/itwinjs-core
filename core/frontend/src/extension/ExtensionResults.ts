/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Extension } from "./Extension";
import { IModelApp } from "../IModelApp";

/**
 * Returns Extension load results
 * @beta
 */
export type ExtensionLoadResults = Extension | undefined | string | string[];

/** @internal */
export function detailsFromExtensionLoadResults(extensionName: string, results: ExtensionLoadResults, reportSuccess: boolean): { detailHTML: HTMLElement | undefined; detailStrings: string[] | undefined } {
  let problems: undefined | string[];
  if (results && "string" === typeof (results))
    problems = [results];
  else if (Array.isArray(results))
    problems = results;
  else if (reportSuccess)
    problems = [IModelApp.i18n.translate("iModelJs:ExtensionErrors.Success", { extensionName })];
  else
    return { detailHTML: undefined, detailStrings: undefined };

  // report load errors to the user.
  let allDetails: string = "";
  for (const thisMessage of problems) {
    allDetails = allDetails.concat("<span>", thisMessage, "<br>", "</span>");
  }
  const allDetailsFragment: any = document.createRange().createContextualFragment(allDetails);
  const allDetailsHtml: HTMLElement = document.createElement("span");
  allDetailsHtml.appendChild(allDetailsFragment);
  return { detailHTML: allDetailsHtml, detailStrings: problems };
}
