/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
// based on file https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/filters.test.ts

import {
  IMatch,
  matchesWords,
} from "../../appui-abstract/utils/filter/filters";

type IFilter = (word: string, wordToMatchAgainst: string) => IMatch[] | null;

function filterNotOk(filter: IFilter, word: string, wordToMatchAgainst: string) {
  assert(!filter(word, wordToMatchAgainst), `${word} matched ${wordToMatchAgainst}`);
}

function filterOk(filter: IFilter, word: string, wordToMatchAgainst: string, highlights?: IMatch[]) {
  const r = filter(word, wordToMatchAgainst);
  assert(r, `${word} didn't match ${wordToMatchAgainst}`);
  if (highlights) {
    assert.deepStrictEqual(r, highlights);
  }
}

describe("Filters", () => {
  it("WordFilter", () => {
    filterOk(matchesWords, "alpha", "alpha", [{ start: 0, end: 5 }]);
    filterOk(matchesWords, "alpha", "alphasomething", [{ start: 0, end: 5 }]);
    filterNotOk(matchesWords, "alpha", "alp");
    filterOk(matchesWords, "a", "alpha", [{ start: 0, end: 1 }]);
    filterNotOk(matchesWords, "x", "alpha");
    filterOk(matchesWords, "A", "alpha", [{ start: 0, end: 1 }]);
    filterOk(matchesWords, "AlPh", "alPHA", [{ start: 0, end: 4 }]);
    assert(matchesWords("Debug Console", "Open: Debug Console"));

    filterOk(matchesWords, "gp", "Git: Pull", [{ start: 0, end: 1 }, { start: 5, end: 6 }]);
    filterOk(matchesWords, "g p", "Git: Pull", [{ start: 0, end: 1 }, { start: 3, end: 4 }, { start: 5, end: 6 }]);
    filterOk(matchesWords, "gipu", "Git: Pull", [{ start: 0, end: 2 }, { start: 5, end: 7 }]);

    filterOk(matchesWords, "gp", "Category: Git: Pull", [{ start: 10, end: 11 }, { start: 15, end: 16 }]);
    filterOk(matchesWords, "g p", "Category: Git: Pull", [{ start: 10, end: 11 }, { start: 13, end: 14 }, { start: 15, end: 16 }]);
    filterOk(matchesWords, "gipu", "Category: Git: Pull", [{ start: 10, end: 12 }, { start: 15, end: 17 }]);

    filterNotOk(matchesWords, "it", "Git: Pull");
    filterNotOk(matchesWords, "ll", "Git: Pull");

    filterOk(matchesWords, "git: プル", "git: プル", [{ start: 0, end: 7 }]);
    filterOk(matchesWords, "git プル", "git: プル", [{ start: 0, end: 4 }, { start: 5, end: 7 }]);

    filterOk(matchesWords, "öäk", "Öhm: Älles Klar", [{ start: 0, end: 1 }, { start: 5, end: 6 }, { start: 11, end: 12 }]);

    filterOk(matchesWords, "bar", "foo-bar");
    filterOk(matchesWords, "bar test", "foo-bar test");
    filterOk(matchesWords, "fbt", "foo-bar test");
    filterOk(matchesWords, "bar test", "foo-bar (test)");
    filterOk(matchesWords, "foo bar", "foo (bar)");

    filterNotOk(matchesWords, "bar est", "foo-bar test");
    filterNotOk(matchesWords, "fo ar", "foo-bar test");
    filterNotOk(matchesWords, "for", "foo-bar test");

    filterOk(matchesWords, "foo bar", "foo-bar");
    filterOk(matchesWords, "foo bar", "123 foo-bar 456");
    filterOk(matchesWords, "foo+bar", "foo-bar");
    filterOk(matchesWords, "foo-bar", "foo bar");
    filterOk(matchesWords, "foo:bar", "foo:bar");
  });

  describe("string tests", () => {
    it("matchesWords returns null", function () {
      assert.ok(matchesWords("A", "") === null);
    });

  });
});
