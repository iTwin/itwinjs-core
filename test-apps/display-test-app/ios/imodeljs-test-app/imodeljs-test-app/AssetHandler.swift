/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import WebKit

class AssetHandler: NSObject, WKURLSchemeHandler {
    private var wwwRoot: URL
    private let indexHtml: String
    
    init(root: URL, defaultPage: String = "index.html") {
        self.wwwRoot = root
        self.indexHtml = defaultPage
        super.init()
    }

    func resolveUrl(urlSchemeTask: WKURLSchemeTask) -> URL? {
        var fileUrl = URL(fileURLWithPath: self.wwwRoot.path, isDirectory: true)
        let req = urlSchemeTask.request.url!.path
        fileUrl.appendPathComponent(req.isEmpty || req == "/" ? self.indexHtml : req)
        
        if !FileManager.default.fileExists(atPath: fileUrl.path) {
            return nil
        }
        return fileUrl
    }

    func respondWithDiskFile(urlSchemeTask: WKURLSchemeTask, fileUrl: URL) {
        let task = URLSession.shared.dataTask(with: fileUrl) { data, response, error in
            if let error = error {
                urlSchemeTask.didFailWithError(error)
                return
            }
            let fileResp = HTTPURLResponse(url: urlSchemeTask.request.url!, mimeType: response?.mimeType, expectedContentLength: Int(response!.expectedContentLength), textEncodingName: response!.textEncodingName)

            urlSchemeTask.didReceive(fileResp)
            urlSchemeTask.didReceive(data!)
            urlSchemeTask.didFinish()
        }
        
        task.resume()
    }
    
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        if let fileUrl = self.resolveUrl(urlSchemeTask: urlSchemeTask) {
            self.respondWithDiskFile(urlSchemeTask: urlSchemeTask, fileUrl: fileUrl)
        } else {
            urlSchemeTask.didFailWithError(URLError(URLError.Code.badURL))
        }
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    }
}
