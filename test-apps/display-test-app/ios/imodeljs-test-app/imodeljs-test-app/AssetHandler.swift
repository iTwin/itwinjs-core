/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import WebKit
import MobileCoreServices
class AssetHandler: NSObject, WKURLSchemeHandler {
    private var wwwRoot: URL
    private let indexHtml: String
    
    init(root: URL, defaultPage: String = "index.html") {
        self.wwwRoot = root;
        self.indexHtml = defaultPage;
        super.init()
    }
    func mimeTypeForPath(url: URL) -> String {
        let pathExtension = url.pathExtension

        if let uti = UTTypeCreatePreferredIdentifierForTag(kUTTagClassFilenameExtension, pathExtension as NSString, nil)?.takeRetainedValue() {
            if let mimetype = UTTypeCopyPreferredTagWithClass(uti, kUTTagClassMIMEType)?.takeRetainedValue() {
                return mimetype as String
            }
        }
        return "application/octet-stream"
    }
    func resolveUrl(urlSchemeTask: WKURLSchemeTask) -> URL? {
        var fileUrl = URL.init(fileURLWithPath: self.wwwRoot.path, isDirectory: true)
        let req = urlSchemeTask.request.url!.path;
        if (req.isEmpty || req == "/") {
            fileUrl.appendPathComponent(self.indexHtml);
        } else {
            fileUrl.appendPathComponent(req)
        }
        
        if (!FileManager.default.fileExists(atPath: fileUrl.path)) {
            return nil
        }
        return fileUrl
    }
    func respondWithDiskFile(urlSchemeTask: WKURLSchemeTask, fileUrl: URL) {
        let task = URLSession.shared.dataTask(with: fileUrl, completionHandler: { data, response, error in
            if (error != nil) {
                urlSchemeTask.didFailWithError(error!)
                return;
            }
            // let mimeType = self.mimeTypeForPath(url: fileUrl)
            let fileResp = HTTPURLResponse.init(url: urlSchemeTask.request.url!, mimeType: response?.mimeType, expectedContentLength: Int(response!.expectedContentLength), textEncodingName: response!.textEncodingName)

            urlSchemeTask.didReceive(fileResp)
            urlSchemeTask.didReceive(data!)
            urlSchemeTask.didFinish()
            })
        
        task.resume()
    }
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let fileUrl = self.resolveUrl(urlSchemeTask: urlSchemeTask)
        if (fileUrl != nil) {
            self.respondWithDiskFile(urlSchemeTask: urlSchemeTask, fileUrl: fileUrl!)
        } else {
            urlSchemeTask.didFailWithError(URLError.init(URLError.Code.badURL))
        }
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    }
}
