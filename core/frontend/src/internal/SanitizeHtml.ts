/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import DOMPurify from "dompurify";

/** Sanitizes formatted HTML, excluding inline CSS and non-HTML markup.
 * @internal
 */
export function sanitizeHtml(html: string): DocumentFragment {
  return DOMPurify.sanitize(html, {
    /* eslint-disable @typescript-eslint/naming-convention -- DOMPurify defines these option names. */
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["style"],
    RETURN_DOM_FRAGMENT: true,
    /* eslint-enable @typescript-eslint/naming-convention */
  });
}
