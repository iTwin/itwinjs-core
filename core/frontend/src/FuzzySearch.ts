/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import Fuse from "fuse.js";

/** @public */
export class FuzzySearch<T> {

  /** Override to provide non-standard FuseOptions for searches where the a single word pattern is used */
  public onGetSingleWordSearchOptions(): Fuse.FuseOptions<T> {
    return {
      shouldSort: true,
      threshold: 0.40,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 2,
      includeMatches: true,
      includeScore: true,
    };
  }

  /** Override to provide non-standard FuseOptions for searches where the a multiple word pattern is used */
  public onGetMultiWordSearchOptions(): Fuse.FuseOptions<T> {
    return {
      shouldSort: true,
      threshold: 0.40,
      tokenize: true,
      matchAllTokens: true,
      maxPatternLength: 32,
      minMatchCharLength: 2,
      includeMatches: true,
      includeScore: true,
    };
  }

  /** Call to conduct a fuzzy search of searchedObjects, looking at the 'key' member of each such object
   * @param searchedObjects An array of objects to search.
   * @param keys The name of the members to search in the searchedObjects.
   * @param pattern The pattern for which each searchedObject is searched.
   * @return FuzzySearchResults.
   */
  public search(searchedObjects: T[], keys: Array<keyof T>, pattern: string): FuzzySearchResults<T> {
    if (!pattern || pattern.length < 2)
      return new FuzzySearchResults<T>(undefined);

    // it is a multi-word pattern if there's a space other than at the end of the pattern.
    const spaceIndex: number = pattern.indexOf(" ");
    const multiWord: boolean = (-1 !== spaceIndex) && (spaceIndex !== (pattern.length - 1));
    const options: Fuse.FuseOptions<T> = multiWord ? this.onGetMultiWordSearchOptions() : this.onGetSingleWordSearchOptions();
    options.keys = keys;
    const fuse = new Fuse(searchedObjects, options);
    let results: any[] = fuse.search(pattern);

    // We need to set the threshold fairly high to get results when the user misspells words (otherwise they are not returned),
    // but doing that results in matches that don't make sense when there are "good" matches. So we discard matches where the match
    // score increases by a large amount between results.
    let checkScoreDelta: boolean = false;
    let averageScoreDeltaThreshold = 1;
    if (results.length > 30) {
      averageScoreDeltaThreshold = ((results[results.length - 1].score - results[0].score) / results.length) * 10;
      if (averageScoreDeltaThreshold > 0.01)
        checkScoreDelta = true;
    }

    // Sometimes fuse returns results in the array where the matches array is empty. That seems like a bug to me, but it happens when
    // the input  is something like "fjt" and the string it matches is "fit". If we have more than three actual matches, we just truncate the set when we see one.
    // The other use for this loop is to truncate when we see a dramatic increase in the score. The ones after are unlikely
    // to be useful, so we truncate the results when we hit that point also.
    for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
      const thisResult = results[resultIndex];
      if (0 === thisResult.matches.length) {
        // here we have a result with no matches. If we have other matches, just discard this and the rest.
        if (resultIndex > 2) {
          results = results.slice(0, resultIndex);
          break;
        }
        // otherwise we want to keep this result, but we have to add the matched value to the object because we can't get it from the matches array.
        // we assume it came from the first key (usually there's only one anyway).

        thisResult.matchedValue = thisResult.item[keys[0]];
        thisResult.matchedKey = keys[0];
      }

      if (checkScoreDelta && (resultIndex > 0)) {
        const resultScore = results[resultIndex].score;
        if (resultScore < 0.101)
          continue;
        if ((resultScore - results[resultIndex - 1].score) > averageScoreDeltaThreshold) {
          results = results.slice(0, resultIndex);
          break;
        }
      }
    }

    // put the functions on each result so it fulfils the FuzzySearchResult interface.
    for (const thisResult of results) {
      thisResult.getResult = getResult.bind(thisResult);
      thisResult.getBoldMask = getBoldMask.bind(thisResult);
      thisResult.getMatchedKey = getMatchedKey.bind(thisResult);
      thisResult.getMatchedValue = getMatchedValue.bind(thisResult);
    }
    return new FuzzySearchResults<T>(results);
  }
}

/** Interface implemented by objects returned while iterating through FuzzySearchResults
 * @public
 */
export interface FuzzySearchResult<T> {
  /** Return the current result object */
  getResult(): T;

  /** Return the key found in this result object */
  getMatchedKey(): string;

  /** Return the value matched in this result object */
  getMatchedValue(): string;

  /** Return a boolean array that contains true for each letter in the matched value that was matched part of the search pattern */
  getBoldMask(): boolean[];
}

/** Added to each result to support the FuzzySearchResult interface. */
function getResult(this: any) { return this.item; }

/** Added to each result to support the FuzzySearchResult interface. */
function getMatchedKey(this: any): string { return (this.matches.length > 0) ? this.matches[0].key : this.matchedKey; }

/** Added to each result to support the FuzzySearchResult interface. */
function getMatchedValue(this: any): string { return (this.matches.length > 0) ? this.matches[0].value : this.matchedValue; }

/** this function is added to each result to support the FuzzySearchResult interface. */
function getBoldMask(this: any): boolean[] | undefined {
  if (this.boldMask)
    return this.boldMask;

  // if we had no matches, we return a bold mask with all false.
  if (0 === this.matches.length) {
    const noBoldMask = new Array<boolean>(this.matchedValue.length);
    noBoldMask.fill(false);
    return this.boldMask = noBoldMask;
  }

  // we have some matched portions.
  const thisMatchedString: string = this.matches[0].value;
  const valueLength = thisMatchedString.length;
  const boldMask: boolean[] = new Array<boolean>(valueLength);
  boldMask.fill(false);
  const indicesArray: number[][] = this.matches[0].indices;
  indicesArray.forEach((set: number[]) => {
    for (let start = set[0], end = set[1]; start <= end; start++) {
      boldMask[start] = true;
    }
  });
  // cache it so if someone asks again we don't have to recalculate it.
  return this.boldMask = boldMask;
}

/**
 * This class is used to return the results of FuzzySearch.search. It is iterable, with each iteration
 * returning an object implementing the FuzzySearchResult interface.
 * @public
 */
export class FuzzySearchResults<T> implements Iterable<T> {
  public results: any[];

  constructor(results: any[] | undefined) {
    this.results = [];
    if (results)
      this.results = results;
  }

  public [Symbol.iterator](): any { return new FuzzySearchResultsIterator(this); }

  public get length(): number { return this.results.length; }

  public getResult(resultIndex: number): FuzzySearchResult<T> | undefined {
    if ((resultIndex < 0) || (resultIndex > this.results.length))
      return undefined;
    return this.results[resultIndex];
  }
}
class FuzzySearchResultsIterator<T> {
  public counter: number;
  public fsr: FuzzySearchResults<T>;

  constructor(fsr: FuzzySearchResults<T>) {
    this.fsr = fsr;
    this.counter = 0;
  }

  public next: any = () => {
    return {
      done: this.counter === this.fsr.results.length,
      value: this.fsr.results[this.counter++] as FuzzySearchResult<T>,
    };
  };
}
