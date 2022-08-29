/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit
import IModelJsNative

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil

    func setupBackend () {
        let url = URL(fileURLWithPath: Bundle.main.bundlePath.appending("/Assets/main.js"))
        IModelJsHost.sharedInstance().loadBackend(url, withAuthClient: nil, withInspect: true)
    }
    
    func setupFrontend (bimFile: URL?) {
        let config = WKWebViewConfiguration()
        let wwwRoot = URL(fileURLWithPath: Bundle.main.resourcePath!.appending("/Assets/www"))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        let webView = WKWebView(frame: .zero, configuration: config)
        self.webView = webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(webView)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        NSLayoutConstraint.activate([
            webView.leftAnchor.constraint(equalTo: self.view.leftAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            webView.rightAnchor.constraint(equalTo: self.view.rightAnchor),
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
        ])
        self.view.setNeedsLayout()
    
        let host = IModelJsHost.sharedInstance()
        var queryParam = "#port=\(host.getPort())&platform=ios"

        if let bimFile = bimFile {
            // Note: URL strings probably allow other characters, but we know for sure that these all work.
            // Also, we can't use `CharacterSet.alphanumerics` as a base, because that includes all Unicode
            // upper case and lower case letters, and we only want ASCII upper case and lower case letters.
            // Similarly, `CharacterSet.decimalDigits` includes the Unicode category Number, Decimal Digit,
            // which contains 660 characters.
            let allowedCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.")
            if let encodedPath = bimFile.path.addingPercentEncoding(withAllowedCharacters: allowedCharacters) {
                queryParam.append("&standalone=true&iModelName=" + encodedPath)
            }
        }

        webView.load(URLRequest(url: URL(string: "imodeljs://app" + queryParam)!))
        host.register(webView)
    }
    
    /// Show alert for webkit alert
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: message, message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .cancel) { action in
            completionHandler()
        })
        self.present(alert, animated: true)
    }
    
    @IBAction func onOpenSnapshotIModel(_ sender: Any) {
        pickSnapshot()
    }
    
    func pickSnapshot() {
        let picker = UIDocumentPickerViewController(documentTypes: ["com.bentley.bim-imodel"], in: .open)
        picker.modalPresentationStyle = .fullScreen
        picker.allowsMultipleSelection = false
        picker.directoryURL = getDocumentsDirectory()
        picker.delegate = self
        self.present(picker, animated: true)
    }
    
    func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        setupFrontend(bimFile: nil)
    }
  
    func copyExternalFileWithPrompt(srcUrl: URL, destUrl: URL, handler: @escaping () -> ()) {
        if FileManager.default.fileExists(atPath: destUrl.path) {
            // File exists, check if it is the same
            if FileManager.default.contentsEqual(atPath: srcUrl.path, andPath: destUrl.path) {
                // If src and dst have the same contents, skip the copy and just call handler()
                handler()
                return
            }
            let alert = UIAlertController(title: "Replace File?", message: "'\(destUrl.lastPathComponent)' already exists in the app's Documents folder. Do you want to replace it?", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Yes", style: .destructive) { _ in
                do {
                    try FileManager.default.removeItem(at: destUrl)
                    if self.copyExternalFile(srcUrl: srcUrl, destUrl: destUrl) {
                        handler()
                    }
                } catch {
                    print("Error deleting file '\(destUrl.path)': \(error)")
                }
            })
            alert.addAction(UIAlertAction(title: "No", style: .cancel))
            present(alert, animated: true)
        } else {
            if copyExternalFile(srcUrl: srcUrl, destUrl: destUrl) {
                handler()
            }
        }
    }

    func copyExternalFile(srcUrl: URL, destUrl: URL) -> Bool {
        let secure = srcUrl.startAccessingSecurityScopedResource()
        defer {
            if secure {
                srcUrl.stopAccessingSecurityScopedResource()
            }
        }
        do {
            try FileManager.default.copyItem(at: srcUrl, to: destUrl)
        } catch {
            print("Error copying file '\(srcUrl.path)' to '\(destUrl.path)': \(error)")
            return false
        }
        return true
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentAt url: URL) {
        let documentsDirectory = getDocumentsDirectory()
        let documentsDirectoryPath = documentsDirectory.path
        // For some reason, the path we get from the document picker has a "/private" prefix which is
        // missing from the path that we get from FileManager.default.urls(for:,in:). So allow either
        // path to be accepted as our Documents directory.
        let privateDocumentsDirectoryPath = "/private\(documentsDirectoryPath)"
        let urlPath = url.path
        if urlPath.hasPrefix(documentsDirectoryPath) || urlPath.hasPrefix(privateDocumentsDirectoryPath) {
            // The picked file is already in our Documents directory; no need to copy.
            setupFrontend(bimFile: url)
        } else {
            // The picked file is not in our Documents directory; copy it there so that SQLite lock file and
            // iTwin tiles file can be created.
            let destUrl = URL(fileURLWithPath: documentsDirectoryPath).appendingPathComponent(url.lastPathComponent)
            copyExternalFileWithPrompt(srcUrl: url, destUrl: destUrl) {
                self.setupFrontend(bimFile: destUrl)
            }
        }
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
    }
}
