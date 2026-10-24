import Foundation
import CoreFoundation

extension MemoryStore {
    var portraitDirectory: URL { root.appendingPathComponent("data/portraits",isDirectory:true) }
    func portraitFile(_ id:String) throws -> URL {
        guard Self.validID(id) else { throw EditorError.message("포트레이트 식별자 형식을 확인해 주세요.") }
        try fm.createDirectory(at:portraitDirectory,withIntermediateDirectories:true)
        guard portraitDirectory.resolvingSymlinksInPath().path.hasPrefix(root.path+"/data/") else { throw EditorError.message("포트레이트 경로를 확인해 주세요.") }
        let url=portraitDirectory.appendingPathComponent(id+".json")
        guard url.resolvingSymlinksInPath().deletingLastPathComponent() == portraitDirectory.resolvingSymlinksInPath() else { throw EditorError.message("포트레이트 경로를 확인해 주세요.") }
        return url
    }
    static func portraitName(_ value:String) -> String { value.replacingOccurrences(of:"\\s*[+＋]\\s*[0-5]\\s*$",with:"",options:.regularExpression).trimmingCharacters(in:.whitespacesAndNewlines) }
    static func validatePortrait(_ p:[String:Any]) throws {
        guard let id=p["id"] as? String,validID(id),let name=p["name_ko"] as? String,!portraitName(name).isEmpty,p["name_ja"] is String,[4,5].contains(p["rarity"] as? Int ?? 0),let stats=p["stats_max"] as? [String:Any] else { throw EditorError.message("포트레이트 이름·등급·최대 스테이터스를 확인해 주세요.") }
        let acquisition=p["acquisition_type"] as? String ?? "",story=p["story_id"] as? String ?? ""
        if let source=p["acquisition_type"],!(source is NSNull),!(source is String) { throw EditorError.message("입수처 형식을 확인해 주세요.") }
        if let reference=p["story_id"],!(reference is NSNull),!(reference is String) { throw EditorError.message("스토리 참조값 형식을 확인해 주세요.") }
        guard acquisition.isEmpty || ["distribution","story","puella-pictura"].contains(acquisition) else { throw EditorError.message("입수처는 배포·스토리·푸엘라 픽투러 중 하나를 선택해 주세요.") }
        guard story.isEmpty || (acquisition == "story" && Self.validID(story)) else { throw EditorError.message("스토리 참조값을 확인해 주세요.") }
        for key in ["HP","공격력","방어력"] { guard let n=stats[key] as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue >= 0,n.doubleValue <= 9_007_199_254_740_991,n.doubleValue.rounded() == n.doubleValue else { throw EditorError.message("최대 한계돌파 \(key)를 0 이상의 정수로 입력해 주세요.") } }
        guard let stages=p["ability_levels"] as? [[String:Any]],stages.count == 6 else { throw EditorError.message("어빌리티는 +0~+5 여섯 단계를 각각 기록해 주세요.") }
        var seen=Set<Int>()
        let tags=["공격력","방어력","HP","스피드","MP 회복 효율","치명타 확률","치명타 피해","주는 피해","받는 피해","필살기 피해","전투 스킬 피해","일반 공격 피해","추격 피해","반격 피해","브레이크","HP 회복","MP 회복","행동 순서","상태 이상","기타"]
        for stage in stages {
            guard let number=stage["level"] as? NSNumber,CFGetTypeID(number) != CFBooleanGetTypeID(),number.doubleValue.rounded() == number.doubleValue,(0...5).contains(number.intValue),seen.insert(number.intValue).inserted,let effects=stage["effects"] as? [[String:Any]],effects.count <= 50 else { throw EditorError.message("강화 단계·효과 목록을 확인해 주세요.") }
            for effect in effects { guard ["text_ko","text_ja","condition_ko","condition_ja"].allSatisfy({effect[$0] is String}),let text=effect["text_ko"] as? String,!text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,let values=effect["tags"] as? [String],values.allSatisfy({tags.contains($0)}) else { throw EditorError.message("어빌리티 효과의 한국어 설명·조건·분류를 확인해 주세요.") } }
        }
        if let notes=p["translation_notes"],!(notes is [String]) { throw EditorError.message("초벌 입력 검토 메모 형식을 확인해 주세요.") }
        for key in ["image_url","thumbnail_url","source_image","source_url","source_note","verification"] { if let value=p[key],!(value is NSNull),!(value is String) { throw EditorError.message("이미지·출처 자료 형식을 확인해 주세요.") } }
    }
    func loadPortraits() throws -> [[String:Any]] {
        _ = try portraitFile("directory-check")
        return try fm.contentsOfDirectory(at:portraitDirectory,includingPropertiesForKeys:nil).filter{$0.pathExtension == "json"}.sorted{$0.lastPathComponent < $1.lastPathComponent}.map { url in
            let path=try portraitFile(url.deletingPathExtension().lastPathComponent),data=try Data(contentsOf:path)
            guard let p=try JSONSerialization.jsonObject(with:data) as? [String:Any],let id=p["id"] as? String,id+".json" == url.lastPathComponent else { throw EditorError.message("포트레이트 파일명과 식별자가 다릅니다.") }
            return ["memory":p,"revision":Self.revision(data)]
        }
    }
    func savePortrait(_ value:[String:Any],expected:String?) throws -> String {
        try Self.validatePortrait(value)
        var p=value;p["name_ko"]=Self.portraitName(value["name_ko"] as! String);p["name_ja"]=Self.portraitName(value["name_ja"] as! String)
        let id=p["id"] as! String,target=try portraitFile(id)
        if fm.fileExists(atPath:target.path) {
            let old=try Data(contentsOf:target)
            guard let expected,expected == Self.revision(old) else { throw EditorError.message("다른 곳에서 변경된 자료이거나 같은 식별자가 있습니다. 다시 불러와 주세요.") }
            let backup=root.appendingPathComponent("data/editor-backups/portraits/"+id,isDirectory:true);try fm.createDirectory(at:backup,withIntermediateDirectories:true);try old.write(to:backup.appendingPathComponent(UUID().uuidString+".json"),options:.atomic)
        }else if expected != nil { throw EditorError.message("원본 파일이 사라졌습니다. 다시 불러와 주세요.") }
        let data=try JSONSerialization.data(withJSONObject:p,options:[.prettyPrinted,.sortedKeys,.withoutEscapingSlashes])+Data([10]);try data.write(to:target,options:.atomic);return Self.revision(data)
    }
    func exportPortraitMigration() throws -> URL {
        let entries=try loadPortraits();guard !entries.isEmpty else { throw EditorError.message("내보낼 포트레이트가 없습니다.") }
        var sql=["-- 포트레이트 입력 도구에서 만든 자료입니다. 원격 DB에는 아직 반영되지 않았습니다.","CREATE TABLE IF NOT EXISTS portraits (id TEXT PRIMARY KEY, payload TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1);"]
        for entry in entries { let p=entry["memory"] as! [String:Any];try Self.validatePortrait(p);let json=String(data:try JSONSerialization.data(withJSONObject:p,options:[.sortedKeys,.withoutEscapingSlashes]),encoding:.utf8)!.replacingOccurrences(of:"'",with:"''");sql.append("INSERT INTO portraits(id,payload,published) VALUES ('\(p["id"] as! String)','\(json)',1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,published=excluded.published;") }
        let directory=root.appendingPathComponent("migrations",isDirectory:true),maxNumber=try fm.contentsOfDirectory(atPath:directory.path).compactMap{Int($0.prefix(while:{$0.isNumber}))}.max() ?? 0
        let path=directory.appendingPathComponent(String(format:"%04d_portraits_editor.sql",maxNumber+1));guard !fm.fileExists(atPath:path.path) else { throw EditorError.message("같은 배포 파일이 있습니다.") };try (sql.joined(separator:"\n")+"\n").write(to:path,atomically:true,encoding:.utf8);return path
    }
}
