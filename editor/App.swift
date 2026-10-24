import AppKit
import WebKit
import UniformTypeIdentifiers

@MainActor
final class EditorApp: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var store: MemoryStore?
    var dirty = false
    var operation: Process?
    var operationTimer: Timer?
    var preparedPlan: URL?
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu(); let item = NSMenuItem(); menu.addItem(item)
        let submenu = NSMenu(); submenu.addItem(withTitle: "기억 입력 도구 종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"); item.submenu = submenu; NSApp.mainMenu = menu
        let editItem=NSMenuItem();let editMenu=NSMenu(title:"편집");editItem.title="편집";editItem.submenu=editMenu;menu.addItem(editItem)
        for (title,selector,key) in [("실행 취소","undo:","z"),("잘라내기","cut:","x"),("복사","copy:","c"),("붙여넣기","paste:","v"),("전체 선택","selectAll:","a")] { editMenu.addItem(withTitle:title,action:NSSelectorFromString(selector),keyEquivalent:key) }
        let config = WKWebViewConfiguration(); config.userContentController.add(self, name: "editor")
        config.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: .zero, configuration: config); web.navigationDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0,y: 0,width: 1250,height: 850), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = "엑세드라 레코드 · 기억 입력 도구"; window.minSize = NSSize(width: 850,height: 620); window.contentView = web; window.delegate = self; window.center(); window.makeKeyAndOrderFront(nil)
        if let index = CommandLine.arguments.firstIndex(of: "--project"), CommandLine.arguments.count > index+1 {
            store = try? MemoryStore(root: URL(fileURLWithPath: CommandLine.arguments[index+1]))
        }
        if store == nil, let path = UserDefaults.standard.string(forKey: "projectPath") { store = try? MemoryStore(root: URL(fileURLWithPath: path)) }
        if store == nil { store = try? MemoryStore(root: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Projects/ExedraRecord", isDirectory: true)) }
        let resources = Bundle.main.resourceURL!.appendingPathComponent("ui", isDirectory: true)
        web.loadFileURL(resources.appendingPathComponent("index.html"), allowingReadAccessTo: resources)
        NSApp.activate(ignoringOtherApps: true)
    }
    func confirmDiscard() -> Bool {
        if operation != nil { let alert=NSAlert();alert.messageText="작업이 실행 중입니다.";alert.informativeText="작업을 마치거나 작업 취소를 누른 뒤 종료해 주세요.";alert.runModal();return false }
        guard dirty else { return true }
        let alert = NSAlert(); alert.messageText = "저장하지 않은 변경이 있습니다."; alert.informativeText = "변경을 버리고 계속할까요?"; alert.addButton(withTitle: "계속 편집"); alert.addButton(withTitle: "변경 버리기")
        let discard = alert.runModal() == .alertSecondButtonReturn
        if discard { dirty = false }
        return discard
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { confirmDiscard() }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { confirmDiscard() ? .terminateNow : .terminateCancel }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let allowed = Bundle.main.resourceURL!.appendingPathComponent("ui/index.html").standardizedFileURL
        decisionHandler(navigationAction.request.url?.standardizedFileURL == allowed ? .allow : .cancel)
    }
    func reply(_ id: String, value: Any? = nil, error: String? = nil) {
        var response: [String:Any] = ["id":id]
        if let error { response["error"] = error } else { response["value"] = value ?? NSNull() }
        guard let data = try? JSONSerialization.data(withJSONObject: response), let json = String(data: data,encoding: .utf8) else { return }
        web.evaluateJavaScript("window.receiveNative(\(json))", completionHandler: nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.standardizedFileURL == Bundle.main.resourceURL!.appendingPathComponent("ui/index.html").standardizedFileURL, let body = message.body as? [String:Any], let id = body["id"] as? String, let action = body["action"] as? String else { return }
        do {
            if action == "dirty" { dirty = body["value"] as? Bool ?? false; reply(id,value:true); return }
            if action == "chooseProject" {
                guard confirmDiscard() else { reply(id,value:NSNull()); return }
                let panel = NSOpenPanel();panel.canChooseDirectories=true;panel.canChooseFiles=false;panel.prompt="프로젝트 선택";panel.message="ExedraRecord 프로젝트 폴더를 선택해 주세요."
                if panel.runModal() == .OK, let url=panel.url { store=try MemoryStore(root:url);UserDefaults.standard.set(url.path,forKey:"projectPath");dirty=false } else { reply(id,value:NSNull());return }
            }
            if action == "cancelOperation" { operation?.terminate();reply(id,value:true);return }
            if operation != nil && action != "dirty" { throw EditorError.message("작업이 실행 중입니다. 잠시 기다려 주세요.") }
            guard let store else { throw EditorError.message("프로젝트 폴더를 먼저 선택해 주세요.") }
            switch action {
            case "load", "chooseProject": reply(id,value:["path":store.root.path,"entries":try store.load()])
            case "save":
                guard let memory = body["memory"] as? [String:Any] else { throw EditorError.message("저장할 자료가 없습니다.") }
                let revision=try store.save(memory,expected:body["revision"] as? String);dirty=false;reply(id,value:["revision":revision,"entries":try store.load()])
            case "openWiki":
                guard let raw=body["url"] as? String, let url=URL(string:raw), url.scheme == "https", ["namu.wiki","ko.wikipedia.org","ja.wikipedia.org"].contains(url.host ?? ""), url.user == nil, url.password == nil, url.port == nil else { throw EditorError.message("위키 주소를 확인해 주세요.") }
                NSWorkspace.shared.open(url);reply(id,value:true)
            case "upload":
                let panel=NSOpenPanel();panel.allowedContentTypes=[.png,.jpeg,.webP,.heic,.tiff];panel.prompt="이미지 가져오기";panel.message="프로젝트에 복사할 이미지를 선택해 주세요."
                guard panel.runModal() == .OK, let source=panel.url else { reply(id,value:NSNull());return }
                let size=try source.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0
                guard size <= 50_000_000, let image=NSImage(contentsOf:source), image.size.width>0, image.size.height>0 else { throw EditorError.message("50MB 이하의 올바른 이미지 파일을 선택해 주세요.") }
                let key="upload-"+UUID().uuidString.lowercased()
                let imagePath="/images/"+key+".png";let thumbPath="/images/"+key+"-thumb.jpg"
                try bitmap(image,maxSide:3000,type:.png).write(to:store.localAsset(imagePath),options:.atomic)
                try bitmap(image,maxSide:640,type:.jpeg).write(to:store.localAsset(thumbPath),options:.atomic)
                reply(id,value:["image":imagePath,"thumbnail":thumbPath])
            case "preview":
                guard let path=body["path"] as? String, !path.isEmpty else { reply(id,value:NSNull());return }
                let url=try store.localAsset(path)
                guard let image=NSImage(contentsOf:url) else { reply(id,value:NSNull());return }
                reply(id,value:"data:image/jpeg;base64," + (try bitmap(image,maxSide:1000,type:.jpeg)).base64EncodedString())
            case "connections", "loginCodex", "loginCloudflare": try startOnline(action,id:id)
            case "prepareDeploy":
                guard !dirty else { throw EditorError.message("편집 중인 기억을 먼저 저장해 주세요.") }
                for entry in try store.load() { try MemoryStore.validate(entry["memory"] as! [String:Any]) }
                try startOnline(action,id:id)
            case "publish":
                guard !dirty,let plan=preparedPlan else { throw EditorError.message("서버 반영 준비를 먼저 진행해 주세요.") }
                try startOnline(action,id:id,payload:["plan":plan.path])
            case "translate":
                var imagePath=body["image"] as? String ?? ""
                if imagePath.isEmpty {
                    let panel=NSOpenPanel();panel.allowedContentTypes=[.png,.jpeg,.webP,.heic,.tiff];panel.prompt="초벌 번역할 이미지 선택";panel.message="공식 소개 이미지를 Codex로 보내 초벌 번역합니다. 인터넷 연결과 Codex 사용량이 필요합니다."
                    guard panel.runModal() == .OK,let url=panel.url else { reply(id,value:NSNull());return }
                    let size=try url.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0
                    guard size<=50_000_000,let image=NSImage(contentsOf:url) else { throw EditorError.message("50MB 이하의 이미지 파일을 선택해 주세요.") }
                    imagePath="/images/translation-"+UUID().uuidString.lowercased()+".png"
                    try bitmap(image,maxSide:3000,type:.png).write(to:store.localAsset(imagePath),options:.atomic)
                }
                let url=try store.localAsset(imagePath)
                try startOnline(action,id:id,payload:["image":url.path,"sourceImage":imagePath])
            case "export":
                guard !dirty else { throw EditorError.message("편집 중인 기억을 먼저 저장해 주세요.") }
                let url=try store.exportMigration();reply(id,value:url.path)
            default: throw EditorError.message("지원하지 않는 요청입니다.")
            }
        } catch { reply(id,error:error.localizedDescription) }
    }
    func bitmap(_ image: NSImage, maxSide: CGFloat, type: NSBitmapImageRep.FileType) throws -> Data {
        let ratio=min(1,maxSide/max(image.size.width,image.size.height));let width=max(1,Int(image.size.width*ratio));let height=max(1,Int(image.size.height*ratio))
        guard let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0),let context=NSGraphicsContext(bitmapImageRep:rep) else { throw EditorError.message("이미지를 변환하지 못했습니다.") }
        NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=context;NSColor.white.setFill();NSRect(x:0,y:0,width:width,height:height).fill();image.draw(in:NSRect(x:0,y:0,width:width,height:height));NSGraphicsContext.restoreGraphicsState()
        guard let data=rep.representation(using:type,properties:[.compressionFactor:0.85]) else { throw EditorError.message("이미지를 저장하지 못했습니다.") };return data
    }
}
@main
struct Main {
    @MainActor static func main() {
        let application=NSApplication.shared
        let delegate=EditorApp()
        application.delegate=delegate
        application.setActivationPolicy(.regular)
        application.run()
    }
}
