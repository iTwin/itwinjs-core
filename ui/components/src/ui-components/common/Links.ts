/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

// cSpell:ignore linkify

import LinkifyIt = require("linkify-it");

const linkify = new LinkifyIt();

linkify.add("pw:", {
  validate: (text: string, pos: number, self: LinkifyIt.LinkifyIt): number => {
    const tail = text.slice(pos);

    if (!self.re.pw) {
      self.re.pw = new RegExp(
        "//" + self.re.src_host + ":" +
        // Regex for path according to RFC 3986 standards plus the possibility to write '{}' brackets for ProjectWise monikers
        "([a-zA-Z0-9-._~!$&'()*+,;=@%{}]+/)+[a-zA-Z0-9-._~!$&'()*+,;=@%{}]*",
        "i");
    }
    if (self.re.pw.test(tail)) {
      const matches = tail.match(self.re.pw);
      if (matches !== null)
        return matches[0].length;
    }
    return 0;
  },
});

/** Returns a list of links from a text
 * @public
 */
export const matchLinks = (text: string): Array<{ index: number; lastIndex: number; schema: string; url: string }> => {
  const matches = linkify.match(text);
  return matches ? matches as Array<{ index: number; lastIndex: number; schema: string; url: string }> : [];
};
