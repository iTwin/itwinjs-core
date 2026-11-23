/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import DOMPurify from "dompurify";

/** Allows HTML formatting in tooltips, but not CSS or non-HTML markup.
 * @internal
 */
export function sanitizeTooltipHtml(html: string): DocumentFragment {
  return DOMPurify.sanitize(html, {
    /* eslint-disable @typescript-eslint/naming-convention -- DOMPurify defines these option names. */
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["style"],
    RETURN_DOM_FRAGMENT: true,
    /* eslint-enable @typescript-eslint/naming-convention */
  });
}
