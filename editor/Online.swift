import Foundation
import AppKit

@MainActor
extension EditorApp {
    func startOnline(_ action: String, id: String, payload: [String: Any] = [:]) throws {
        guard operation == nil else { throw EditorError.message("다른 작업이 실행 중입니다.") }
        guard let store else { throw EditorError.message("프로젝트 폴더를 먼저 선택해 주세요.") }
        let nodePaths=["/opt/homebrew/bin/node","/usr/local/bin/node"]
        guard let node=nodePaths.first(where:{ FileManager.default.isExecutableFile(atPath:$0) }) else { throw EditorError.message("온라인 기능에 필요한 Node.js를 찾을 수 없습니다.") }
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("exedra-job-"+UUID().uuidString,isDirectory:true)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        var job=payload;job["action"]=action;job["root"]=store.root.path
        let request=directory.appendingPathComponent("request.json");let output=directory.appendingPathComponent("output.jsonl")
        try JSONSerialization.data(withJSONObject:job).write(to:request,options:.atomic)
        FileManager.default.createFile(atPath:output.path,contents:nil)
        let handle=try FileHandle(forWritingTo:output)
        let process=Process();process.executableURL=URL(fileURLWithPath:node);process.arguments=[Bundle.main.resourceURL!.appendingPathComponent("service/runner.mjs").path,request.path];process.currentDirectoryURL=store.root
        var environment=ProcessInfo.processInfo.environment;environment["PATH"]="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:"+(environment["PATH"] ?? "");process.environment=environment
        process.standardOutput=handle;process.standardError=handle
        var delivered=0
        func reportProgress() {
            guard let data=try? Data(contentsOf:output),let text=String(data:data,encoding:.utf8) else { return }
            let lines=text.components(separatedBy:"\n").dropLast();guard lines.count>delivered else { return }
            for line in lines.dropFirst(delivered) {
                if let event=try? JSONSerialization.jsonObject(with:Data(line.utf8)) as? [String:Any],event["event"] as? String == "progress",let message=event["message"] as? String,let encoded=try? JSONSerialization.data(withJSONObject:["message":message]),let json=String(data:encoded,encoding:.utf8) { web.evaluateJavaScript("window.nativeProgress(\(json))",completionHandler:nil) }
            }
            delivered=lines.count
        }
        process.terminationHandler={ _ in Task { @MainActor in
            self.operationTimer?.invalidate();self.operationTimer=nil;self.operation=nil;try? handle.close();reportProgress()
            defer { try? FileManager.default.removeItem(at:directory) }
            guard let data=try? Data(contentsOf:output),let text=String(data:data,encoding:.utf8) else { self.reply(id,error:"작업 결과를 읽지 못했습니다.");return }
            let events=text.split(separator:"\n").compactMap { try? JSONSerialization.jsonObject(with:Data($0.utf8)) as? [String:Any] }
            if let result=events.last(where:{$0["event"] as? String == "result"}) {
                if action == "prepareDeploy",let value=result["value"] as? [String:Any],let path=value["directory"] as? String { self.preparedPlan=URL(fileURLWithPath:path).appendingPathComponent("plan.json") }
                if action == "prepareSync",let value=result["value"] as? [String:Any],let path=value["directory"] as? String { self.preparedSync=URL(fileURLWithPath:path).appendingPathComponent("plan.json") }
                if action == "applySync" { self.preparedSync=nil;self.preparedPlan=nil }
                self.reply(id,value:result["value"])
            } else { self.reply(id,error:events.last(where:{$0["event"] as? String == "error"})?["message"] as? String ?? "작업이 종료되었습니다. 연결 상태를 확인해 주세요.") }
        }}
        try process.run();operation=process
        operationTimer=Timer.scheduledTimer(withTimeInterval:0.4,repeats:true) { _ in Task { @MainActor in reportProgress() } }
    }
}
