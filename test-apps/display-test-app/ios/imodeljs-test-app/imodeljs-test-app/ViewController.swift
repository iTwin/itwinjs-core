/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit
import IModelJsNative

class ViewController: UIViewController, WKUIDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil
    private var documentCompletion : ((URL?) -> Void)? = nil
    
    private lazy var argFileName : String? = {
        let args = ProcessInfo.processInfo.arguments
        if args.count == 2 && args[1].hasSuffix(".bim") {
            return args[1]
        }
        return nil
    }()

    func setupBackend () {
        let url = URL(fileURLWithPath: Bundle.main.bundlePath.appending("/Assets/main.js"))
        IModelJsHost.sharedInstance().loadBackend(url, withAuthClient: nil, withInspect: true)
    }
    
    func setupFrontend (bimFile: URL? = nil) {
        let config = WKWebViewConfiguration()
        let wwwRoot = URL(fileURLWithPath: Bundle.main.resourcePath!.appending("/Assets/www"))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        let webView = WKWebView(frame: .zero, configuration: config)
        self.webView = webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(webView)
        webView.uiDelegate = self
        NSLayoutConstraint.activate([
            webView.leftAnchor.constraint(equalTo: self.view.leftAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            webView.rightAnchor.constraint(equalTo: self.view.rightAnchor),
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
        ])
        self.view.setNeedsLayout()
    
        let host = IModelJsHost.sharedInstance()
        var queryParam = "#port=\(host.getPort())&platform=ios&standalone=true"

        if let bimFile = bimFile {
            // Note: URL strings probably allow other characters, but we know for sure that these all work.
            // Also, we can't use `CharacterSet.alphanumerics` as a base, because that includes all Unicode
            // upper case and lower case letters, and we only want ASCII upper case and lower case letters.
            // Similarly, `CharacterSet.decimalDigits` includes the Unicode category Number, Decimal Digit,
            // which contains 660 characters.
            let allowedCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.")
            if let encodedPath = bimFile.path.addingPercentEncoding(withAllowedCharacters: allowedCharacters) {
                queryParam.append("&iModelName=" + encodedPath)
            }
        }

        webView.addUserContentController(OpenModelHander(self))
        webView.addUserContentController(ModelOpenedHandler(exitOnMessage: self.argFileName != nil))
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
    
    func pickSnapshot(completion: @escaping (URL?) -> Void) {
        self.documentCompletion = completion
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

    private func callDocumentCompletion(_ url: URL?) {
        if let completion = self.documentCompletion {
            completion(url)
            self.documentCompletion = nil
        }
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
            callDocumentCompletion(url)
        } else {
            // The picked file is not in our Documents directory; copy it there so that SQLite lock file and
            // iTwin tiles file can be created.
            let destUrl = URL(fileURLWithPath: documentsDirectoryPath).appendingPathComponent(url.lastPathComponent)
            copyExternalFileWithPrompt(srcUrl: url, destUrl: destUrl) {
                self.callDocumentCompletion(destUrl)
            }
        }
    }
    
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        callDocumentCompletion(nil)
    }
  
    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
        
        // Try to open file in Documents dir passed as argument
        if let fileName = argFileName {
            let url = URL(fileURLWithPath: getDocumentsDirectory().path).appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: url.path) {
                setupFrontend(bimFile: url)
            } else {
                NSLog("ERROR: \(fileName) does not exist in the app's Documents directory")
                exit(EXIT_FAILURE)
            }
        } else {
            setupFrontend()
        }
    }
    
    class OpenModelHander: NSObject, MessageHandler {
        static let NAME = "openModel"
        private var viewController: ViewController
        
        init (_ viewController: ViewController) {
            self.viewController = viewController
        }
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if let webView = self.viewController.webView, let promiseName = message.body as? String, promiseName.count > 0 {
                viewController.pickSnapshot() { url in
                    let fileName = (url?.path.count ?? 0) > 0 ? "\"\(url!.path)\"" : "undefined";
                    let js = "window.\(promiseName)(\(fileName));"
                    webView.evaluateJavaScript(js)
                }
            }
        }
    }
    
    class ModelOpenedHandler : NSObject, MessageHandler {
        static let NAME = "modelOpened"
        private var exitOnMessage: Bool
        
        init(exitOnMessage: Bool) {
            self.exitOnMessage = exitOnMessage
        }
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if let stringMessage = message.body as? String {
                NSLog("iModel opened: \(stringMessage)")
            }
            if exitOnMessage {
                exit(EXIT_SUCCESS)
            }
        }
    }
}

protocol MessageHandler : WKScriptMessageHandler {
    static var NAME: String { get }
}

extension WKWebView {
    func addUserContentController(_ messageHandler: MessageHandler) {
        self.configuration.userContentController.add(messageHandler, name: type(of: messageHandler).NAME)
    }
}

