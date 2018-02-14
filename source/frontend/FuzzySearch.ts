import * as Fuse from "fuse.js";

export class FuzzySearch<T> {

  /** Override to provide non-standard FuseOptions for searches where the a single word pattern is used */
  public onGetSingleWordSearchOptions(): Fuse.FuseOptions {
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
  public onGetMultiWordSearchOptions(): Fuse.FuseOptions {
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
  public search(searchedObjects: T[], keys: string[], pattern: string): FuzzySearchResults<T> {
    if (!pattern || pattern.length < 2)
      return new FuzzySearchResults<T>(undefined);

    const singleWord = (-1 === pattern.indexOf(" "));
    const options: Fuse.FuseOptions = singleWord ? this.onGetSingleWordSearchOptions() : this.onGetMultiWordSearchOptions();
    options.keys = keys;
    const fuse = new Fuse(searchedObjects, options);
    let results: any[] = fuse.search(pattern);

    // We need to set the threshold fairly high to get results when the user misspells words (otherwise they are not returned),
    // but doing that results in matches that don't make sense when there are "good" matches. So we discard matches where the match
    // score increases by a large amount between results.
    if (results.length > 30) {
      const averageScoreDeltaThreshold = ((results[results.length - 1].score - results[0].score) / results.length) * 10;
      if (averageScoreDeltaThreshold > 0.01)
        for (let resultIndex = 1; resultIndex < results.length; resultIndex++) {
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

/** Interface implemented by objects returned while iterating through FuzzySearchResults */
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

// this function is added to each result to support the FuzzySearchResult interface.
function getResult(this: any) {
  return this.item;
}

// this function is added to each result to support the FuzzySearchResult interface.
function getMatchedKey(this: any): string {
  return this.matches[0].key;
}

// this function is added to each result to support the FuzzySearchResult interface.
function getMatchedValue(this: any): string {
  return this.matches[0].value;
}

// this function is added to each result to support the FuzzySearchResult interface.
function getBoldMask(this: any): boolean[] {
  if (this.boldMask)
    return this.boldMask;

  const thisMatchedString: string = this.matches[0].value;
  const keyinLength = thisMatchedString.length;
  const boldMask: boolean[] = new Array<boolean>(keyinLength);
  boldMask.fill(false);
  const indicesArray: number[][] = this.matches[0].indices;
  indicesArray.forEach((set: number[]) => {
    for (let start = set[0], end = set[1]; start <= end; start++) {
      boldMask[start] = true;
    }
  });
  // cache it so if someone asks again we don't have to recalculate it.
  this.boldMask = boldMask;
  return boldMask;
}

/** This class is used to return the results of FuzzySearch.search. It is iterable, with each iteration
 * returning an object implementing the FuzzySearchResult interface.
 */
export class FuzzySearchResults<T> implements Iterable<T> {
  private results: any[];
  private counter = 0;

  constructor(results: any[] | undefined) {
    this.results = [];
    if (results)
      this.results = results;
  }

  public [Symbol.iterator]() {
    const nextFunc = () => {
      const thisFSR: FuzzySearchResults<T> = this as FuzzySearchResults<T>;
      return {
        done: thisFSR.counter === thisFSR.results.length,
        value: thisFSR.results[thisFSR.counter++] as FuzzySearchResult<T>,
      };
    };
    return {
      next: nextFunc.bind(this),
    };
  }

  public get length(): number {
    return this.results.length;
  }

  public getResult(resultIndex: number): FuzzySearchResult<T> | undefined {
    if ((resultIndex < 0) || (resultIndex > this.results.length))
      return undefined;
    return this.results[resultIndex];
  }
}
