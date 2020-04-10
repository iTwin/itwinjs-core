/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.storage;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { FileContent } from "./FileContent";
import { FileRange } from "./FileRange";
import { FileStorage } from "./FileStorage";

import { ABuffer } from "../buffer/ABuffer";
import { AList } from "../collection/AList";
import { StringMap } from "../collection/StringMap";
import { ALong } from "../runtime/ALong";
import { ASystem } from "../runtime/ASystem";
import { Message } from "../runtime/Message";
import { CacheList } from "./CacheList";

/**
 * Class PageCachedFile defines a paged content cache of a single file.
 */
/** @internal */
export class PageCachedFile extends FileStorage {
	private _fileStorage: FileStorage;
	private _fileName: string;
	private _fileSize: ALong;
	private _pageSize: int32;
	private _pageCount: int32;

	private _contentCache: CacheList<ABuffer>;
	private _requestCount: int32;
	private _requestSize: int32;

	/**
	 * Create a new cached file.
	 * @param fileStorage the underlying file storage.
	 * @param fileName the name of the file to cache.
	 * @param fileSize the length of the file to cache.
	 * @param pageSize the byte size of a cache page (common sizes are 32768, 65536, 131072 or 262144).
	 * @param maxPageCount the maximum number of pages to cache (the oldest pages are purged when the cache is full).
	 */
	public constructor(fileStorage: FileStorage, fileName: string, fileSize: ALong, pageSize: int32, maxPageCount: int32) {
		super();
		this._fileStorage = fileStorage;
		this._fileName = fileName;
		this._fileSize = fileSize;
		this._pageSize = pageSize;
		this._pageCount = fileSize.subInt(1).divInt(this._pageSize).addInt(1).toInt();
		this._contentCache = new CacheList<ABuffer>(maxPageCount);
		this._requestCount = 0;
		this._requestSize = 0;
	}

	/**
	 * FileStorage method.
	 */
	public close(): void {
		this._fileStorage.close(); // deep close
	}

	/**
	 * FileStorage method.
	 */
	public async getFileLength(fileName: string): Promise<ALong> {
		return this._fileSize;
	}

	/**
	 * FileStorage method.
	 */
	public async readFileParts(fileName: string, ranges: AList<FileRange>): Promise<AList<FileContent>> {
		/* Define the set of pages we need to fulfill the request */
		let pageMap: StringMap<ABuffer> = new StringMap<ABuffer>();
		/* Create a list of missing pages */
		let missingPages: AList<FileRange> = new AList<FileRange>();
		let missingKeys: AList<string> = new AList<string>();
		for (let r: number = 0; r < ranges.size(); r++) {
			/* Scan the needed pages of the next range */
			let range: FileRange = ranges.get(r);
			let page0: int32 = range.offset.divInt(this._pageSize).toInt();
			let page1: int32 = range.offset.addInt(range.size - 1).divInt(this._pageSize).toInt() + 1; // exclusive
			for (let i: number = page0; i < page1; i++) {
				/* Try to get the page from the cache */
				let pageKey: string = ("" + i);
				let page: ABuffer = this._contentCache.findEntry(pageKey);
				if (page == null) {
					/* Do not request the same page twice */
					if (missingKeys.contains(pageKey) == false) {
						/* Add a request to read the missing page */
						let pageOffset0: ALong = ALong.fromInt(this._pageSize).mulInt(i);
						let pageOffset1: ALong = ALong.min(pageOffset0.addInt(this._pageSize), this._fileSize);
						let pageSize: int32 = pageOffset1.sub(pageOffset0).toInt();
						missingPages.add(new FileRange(pageOffset0, pageSize));
						missingKeys.add(pageKey);
					}
				}
				else {
					/* Keep */
					pageMap.set(pageKey, page);
				}
			}
		}
		/* Do we have to load missing pages? */
		if (missingPages.size() > 0) {
			/* Load all missing pages with one call to the storage */
			Message.log("Requesting " + missingPages.size() + " missing cache pages for '" + this._fileName + "'");
			let loadedPages: AList<FileContent> = await this._fileStorage.readFileParts(fileName, missingPages);
			/* Add to the cache for reuse */
			for (let i: number = 0; i < loadedPages.size(); i++) {
				let pageKey: string = missingKeys.get(i);
				let pageContent: FileContent = loadedPages.get(i);
				this._contentCache.addEntry(pageKey, pageContent.content);
				pageMap.set(pageKey, pageContent.content);
			}
		}
		/* Create the responses from the cached content */
		let responseList: AList<FileContent> = new AList<FileContent>();
		for (let r: number = 0; r < ranges.size(); r++) {
			/* Create the response for the next range */
			let range: FileRange = ranges.get(r);
			let rangeExtent: ALong = range.offset.addInt(range.size);
			let response: ABuffer = new ABuffer(range.size);
			let responseOffset: int32 = 0;
			this._requestCount++;
			this._requestSize += range.size;
			/* Scan the needed pages */
			let page0: int32 = range.offset.divInt(this._pageSize).toInt();
			let page1: int32 = range.offset.addInt(range.size - 1).divInt(this._pageSize).toInt() + 1; // exclusive
			for (let i: number = page0; i < page1; i++) {
				/* Get the next page from the cache */
				let pageKey: string = ("" + i);
				let page: ABuffer = pageMap.get(pageKey);
				ASystem.assertNot(page == null, "Missing cache page " + pageKey);
				/* Get the extent of the page */
				let pageOffset0: ALong = ALong.fromInt(this._pageSize).mulInt(i);
				let pageOffset1: ALong = ALong.min(pageOffset0.addInt(this._pageSize), this._fileSize);
				/* Copy the overlapping part of the page to the response */
				let currentOffset: ALong = range.offset.addInt(responseOffset);
				let copyOffset: int32 = currentOffset.sub(pageOffset0).toInt();
				let copySize: int32 = ALong.min(pageOffset1, rangeExtent).sub(currentOffset).toInt();
				ABuffer.arrayCopy(page, copyOffset, response, responseOffset, copySize);
				responseOffset += copySize;
			}
			/* Add the response to the list */
			ASystem.assertNot(responseOffset != range.size, "Expected " + range.size + " response size, not " + responseOffset);
			responseList.add(new FileContent(range.offset, response));
		}
		return responseList;
	}

	/**
	 * FileStorage method.
	 */
	public async readFilePart(fileName: string, offset: ALong, size: int32): Promise<ABuffer> {
		let ranges: AList<FileRange> = new AList<FileRange>();
		ranges.add(new FileRange(offset, size));
		let reponses: AList<FileContent> = await this.readFileParts(fileName, ranges);
		let reponse: FileContent = reponses.get(0);
		return reponse.content;
	}

	/**
	 * FileStorage method.
	 */
	public printStatistics(clear: boolean): void {
		Message.log("Page cache of file '" + this._fileName + "':");
		Message.log("Request count is " + this._requestCount);
		Message.log("Request size is " + this._requestSize);
		Message.log("Cache hit count is " + this._contentCache.hitCount);
		Message.log("Cache miss count is " + this._contentCache.missCount);
		if (clear) this._contentCache.hitCount = 0;
		if (clear) this._contentCache.missCount = 0;
		this._fileStorage.printStatistics(clear);
	}
}
