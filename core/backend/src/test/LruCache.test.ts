import { assert, expect } from "chai";
import { LruCache } from "../LRUCaches";

describe('LruCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LruCache<string, string>(3);

    cache.set('a', '1').set('b', '2').set('c', '3');
    expect(Array.from(cache.keys())).deep.equal(['a', 'b', 'c']);

    assert.equal(cache.get('a'), '1');
    expect(Array.from(cache.keys())).deep.equal(['b', 'c', 'a']);

    assert.equal(cache.get('b'), '2');
    expect(Array.from(cache.keys())).deep.equal(['c', 'a', 'b']);

    assert.equal(cache.get('c'), '3');
    expect(Array.from(cache.keys())).deep.equal(['a', 'b', 'c']);

    cache.set('d', '4');
    expect(Array.from(cache.keys())).deep.equal(['b', 'c', 'd']);

    cache.set('e', '5');
    expect(Array.from(cache.keys())).deep.equal(['c', 'd', 'e']);

    cache.set('f', '6');
    expect(Array.from(cache.keys())).deep.equal(['d', 'e', 'f']);

    expect(cache.get('a')).to.be.undefined;
    expect(cache.get('b')).to.be.undefined;
    expect(cache.get('c')).to.be.undefined;
    expect(cache.get('d')).to.equal('4');
    expect(cache.get('e')).to.equal('5');
    expect(cache.get('f')).to.equal('6');
    expect(cache[Symbol.toStringTag]).to.equal("LruCache(this.size=3, capacity=3)");
    expect(cache.size).to.equal(3);
    cache.clear();
    expect(cache.size).to.equal(0);
    expect(cache.get('d')).to.be.undefined;
    expect(cache.get('e')).to.be.undefined;
    expect(cache.get('f')).to.be.undefined;
    expect(cache[Symbol.toStringTag]).to.equal("LruCache(this.size=0, capacity=3)");
  });
});
