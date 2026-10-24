import Foundation
import CryptoKit

enum EditorError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}
struct MemoryStore {
    let root: URL
    let fm = FileManager.default
    var records: URL { root.appendingPathComponent("data/memories", isDirectory: true) }
    init(root: URL) throws {
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
        for path in ["data/memories", "public/images", "migrations"] {
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: self.root.appendingPathComponent(path).path, isDirectory: &isDirectory), isDirectory.boolValue else {
                throw EditorError.message("ExedraRecord 프로젝트 폴더를 선택해 주세요. 필요한 폴더: \(path)")
            }
        }
    }
    static func revision(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    static func validID(_ id: String) -> Bool { id.range(of: "^[a-z0-9]+(?:-[a-z0-9]+)*$", options: .regularExpression) != nil && id.count <= 100 }
    func file(_ id: String) throws -> URL {
        guard Self.validID(id) else { throw EditorError.message("식별자는 영문 소문자·숫자·하이픈만 사용할 수 있습니다.") }
        let url = records.appendingPathComponent(id + ".json")
        guard url.resolvingSymlinksInPath().deletingLastPathComponent() == records.resolvingSymlinksInPath() else { throw EditorError.message("자료 경로를 확인해 주세요.") }
        return url
    }
    var charactersFile: URL { root.appendingPathComponent("public/characters.json") }
    func characters() throws -> [[String:Any]] {
        guard fm.fileExists(atPath:charactersFile.path) else { return [] }
        guard let values=try JSONSerialization.jsonObject(with:Data(contentsOf:charactersFile)) as? [[String:Any]] else { throw EditorError.message("캐릭터 공통 자료 형식을 확인해 주세요.") }
        return values
    }
    static func characterName(_ value: Any?) -> String {
        (value as? String ?? "").precomposedStringWithCompatibilityMapping.components(separatedBy:.whitespacesAndNewlines).joined().lowercased()
    }
    static func sameCharacter(_ a:[String:Any],_ b:[String:Any]) -> Bool {
        let ja=characterName(a["character_ja"]), jb=characterName(b["character_ja"])
        if !ja.isEmpty && !jb.isEmpty { return ja == jb }
        let ko=characterName(a["character_ko"]);return !ko.isEmpty && ko == characterName(b["character_ko"])
    }
    func entryRevision(_ data:Data) throws -> String {
        Self.revision(data + (fm.fileExists(atPath:charactersFile.path) ? try Data(contentsOf:charactersFile) : Data()))
    }
    func load() throws -> [[String: Any]] {
        try fm.contentsOfDirectory(at: records, includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }.map { url in
            let data = try Data(contentsOf: url)
            guard var memory = try JSONSerialization.jsonObject(with: data) as? [String: Any], let id = memory["id"] as? String, id + ".json" == url.lastPathComponent else { throw EditorError.message("자료 형식을 확인해 주세요: \(url.lastPathComponent)") }
            _ = try file(id)
            if let shared=try characters().first(where:{Self.sameCharacter(memory,$0)}) {
                memory["voice_actor"]=shared["voice_actor"] ?? "";memory["voice_actor_url"]=shared["voice_actor_url"] ?? ""
            }
            return ["memory": memory, "revision": try entryRevision(data)]
        }
    }
    static func validate(_ memory: [String: Any]) throws {
        guard let id = memory["id"] as? String, validID(id) else { throw EditorError.message("식별자 형식을 확인해 주세요.") }
        for key in ["character_ko", "name_ko"] {
            guard let value = memory[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw EditorError.message("캐릭터명과 기억 이름은 필수입니다.") }
        }
        guard [3,4,5].contains(memory["rarity"] as? Int ?? 0), ["불속성","물속성","나무속성","빛속성","어둠속성","무속성"].contains(memory["element"] as? String ?? ""), ["어태커","브레이커","힐러","버퍼","디버퍼","디펜더"].contains(memory["role"] as? String ?? ""), ["한정","통상","배포"].contains(memory["acquisition"] as? String ?? "") else { throw EditorError.message("희귀도·속성·역할·입수 구분을 확인해 주세요.") }
        if let actor=memory["voice_actor"], !(actor is NSNull), !(actor is String) { throw EditorError.message("성우는 이름으로 입력해 주세요.") }
        if let raw=memory["voice_actor_url"], !(raw is NSNull) {
            guard let link=raw as? String else { throw EditorError.message("성우 문서 주소를 입력해 주세요.") }
            if !link.isEmpty {
                guard let url=URL(string:link),url.scheme == "https",url.user == nil,url.password == nil,url.port == nil,["namu.wiki","ko.wikipedia.org","ja.wikipedia.org"].contains(url.host ?? ""),url.path.hasPrefix(url.host == "namu.wiki" ? "/w/" : "/wiki/"),url.path.split(separator:"/").count >= 2 else { throw EditorError.message("나무위키 또는 한국어·일본어 위키백과의 문서 주소를 입력해 주세요.") }
                guard !(memory["voice_actor"] as? String ?? "").trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else { throw EditorError.message("성우 문서 주소와 함께 성우 이름을 입력해 주세요.") }
            }
        }
        guard let stats = memory["stats"] as? [String: Any] else { throw EditorError.message("능력치를 입력해 주세요.") }
        for key in ["HP","공격력","방어력","스피드"] {
            guard let number = stats[key] as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue >= 0, number.doubleValue.rounded() == number.doubleValue else { throw EditorError.message("\(key)는 0 이상의 정수로 입력해 주세요.") }
        }
        guard memory["skills"] is [[String: Any]], memory["limit_breaks"] is [[String: Any]] else { throw EditorError.message("스킬과 한계돌파 자료 형식을 확인해 주세요.") }
        if let pv = memory["pv_url"] as? String, !pv.isEmpty {
            guard let url = URL(string: pv), ["https","http"].contains(url.scheme ?? ""), ["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtu.be","youtube-nocookie.com","www.youtube-nocookie.com"].contains(url.host?.lowercased() ?? ""), url.user == nil, url.password == nil, url.port == nil else { throw EditorError.message("PV에는 유튜브 영상 주소를 입력해 주세요.") }
            let path = url.path.split(separator: "/").map(String.init)
            let videoID: String?
            if url.host == "youtu.be" { videoID = path.count == 1 ? path.first : nil }
            else if url.path == "/watch" { videoID = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "v" }?.value }
            else { videoID = path.count == 2 && ["embed","shorts","live"].contains(path[0]) ? path[1] : nil }
            guard let id = videoID, id.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil else { throw EditorError.message("유튜브 영상 주소 형식을 확인해 주세요.") }
        }
    }
    func save(_ memory: [String: Any], expected: String?) throws -> String {
        try Self.validate(memory)
        let work=memory["work"] as? String ?? ""
        let selected: [String]
        if let values=memory["groups"] { guard let list=values as? [String] else { throw EditorError.message("그룹 목록 형식을 확인해 주세요.") };selected=list }
        else { let legacy=memory["group"] as? String ?? "";selected=legacy.isEmpty ? [] : [legacy] }
        let works=["madoka","magia-record","oriko","tart","suzune","sorana","collaboration"]
        let groups=["mikazuki","daito","tsutsuji","nanaka","momoko","emily","blossom","yachiyo","magius","unaffiliated"]
        guard (work.isEmpty || works.contains(work)), (work == "magia-record" ? !selected.isEmpty && selected.allSatisfy({groups.contains($0)}) && Set(selected).count == selected.count : selected.isEmpty) else { throw EditorError.message("작품과 그룹을 확인해 주세요. 마기아 레코드는 그룹을 하나 이상 선택해야 합니다.") }
        let target = try file(memory["id"] as! String)
        if fm.fileExists(atPath: target.path) {
            let old = try Data(contentsOf: target)
            guard let expected, expected == (try entryRevision(old)) else { throw EditorError.message("다른 곳에서 변경된 자료이거나 같은 식별자가 있습니다. 다시 불러온 뒤 수정해 주세요.") }
            let directory = root.appendingPathComponent("data/editor-backups/" + (memory["id"] as! String), isDirectory: true)
            try fm.createDirectory(at: directory, withIntermediateDirectories: true)
            try old.write(to: directory.appendingPathComponent(UUID().uuidString + ".json"), options: .atomic)
        } else if expected != nil { throw EditorError.message("원본 파일이 사라졌습니다. 다시 불러와 주세요.") }
        let data = try JSONSerialization.data(withJSONObject: memory, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]) + Data([10])
        let previous=try? Data(contentsOf:target)
        let previousCharacters=try? Data(contentsOf:charactersFile)
        do {
        try data.write(to: target, options: .atomic)
        if memory["voice_actor"] != nil || memory["voice_actor_url"] != nil {
            var shared=try characters()
            let actor:[String:Any] = ["character_ko":memory["character_ko"] ?? "","character_ja":memory["character_ja"] ?? "","voice_actor":memory["voice_actor"] ?? "","voice_actor_url":memory["voice_actor_url"] ?? ""]
            if let index=shared.firstIndex(where:{Self.sameCharacter(memory,$0)}) { shared[index]=actor } else { shared.append(actor) }
            if fm.fileExists(atPath:charactersFile.path) {
                let backup=root.appendingPathComponent("data/editor-backups/characters",isDirectory:true)
                try fm.createDirectory(at:backup,withIntermediateDirectories:true)
                try Data(contentsOf:charactersFile).write(to:backup.appendingPathComponent(UUID().uuidString+".json"),options:.atomic)
            }
            try JSONSerialization.data(withJSONObject:shared,options:[.prettyPrinted,.sortedKeys,.withoutEscapingSlashes]).write(to:charactersFile,options:.atomic)
        }
        return try entryRevision(data)
        } catch {
            if let previous { try? previous.write(to:target,options:.atomic) } else { try? fm.removeItem(at:target) }
            if let previousCharacters { try? previousCharacters.write(to:charactersFile,options:.atomic) } else { try? fm.removeItem(at:charactersFile) }
            throw error
        }
    }
    func localAsset(_ path: String) throws -> URL {
        guard path.hasPrefix("/images/"), !path.contains("\\"), !path.contains("..") else { throw EditorError.message("프로젝트의 이미지 경로가 아닙니다.") }
        let base = root.appendingPathComponent("public", isDirectory: true).resolvingSymlinksInPath()
        let url = base.appendingPathComponent(String(path.dropFirst())).resolvingSymlinksInPath()
        guard url.path.hasPrefix(base.path + "/images/") else { throw EditorError.message("허용된 이미지 경로가 아닙니다.") }
        return url
    }
    func exportMigration() throws -> URL {
        let entries = try load()
        guard !entries.isEmpty else { throw EditorError.message("내보낼 기억이 없습니다.") }
        var statements = ["-- 기억 입력 도구에서 만든 로컬 자료입니다. 원격 DB에는 아직 반영되지 않았습니다."]
        for entry in entries {
            let memory = entry["memory"] as! [String: Any]
            try Self.validate(memory)
            let payload = String(data: try JSONSerialization.data(withJSONObject: memory, options: [.sortedKeys, .withoutEscapingSlashes]), encoding: .utf8)!
            let id = memory["id"] as! String
            let quoted = payload.replacingOccurrences(of: "'", with: "''")
            statements.append("INSERT INTO memories(id,payload,published) VALUES ('\(id)','\(quoted)',1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,published=excluded.published;")
        }
        let directory = root.appendingPathComponent("migrations", isDirectory: true)
        let maxNumber = try fm.contentsOfDirectory(atPath: directory.path).compactMap { Int($0.prefix(while: { $0.isNumber })) }.max() ?? 0
        let file = directory.appendingPathComponent(String(format: "%04d_editor.sql", maxNumber + 1))
        guard !fm.fileExists(atPath: file.path) else { throw EditorError.message("같은 배포 파일이 있습니다. 다시 시도해 주세요.") }
        try (statements.joined(separator: "\n") + "\n").write(to: file, atomically: true, encoding: .utf8)
        return file
    }
}
import CoreFoundation
