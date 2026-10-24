import Foundation
@main
struct CoreTests {
 static func main() throws {
  let fm=FileManager.default
  let root=URL(fileURLWithPath:"/private/tmp/exedra-editor-test-"+UUID().uuidString)
  defer { try? fm.removeItem(at:root) }
  for path in ["data/memories","public/images","migrations"] { try fm.createDirectory(at:root.appendingPathComponent(path),withIntermediateDirectories:true) }
  let store=try MemoryStore(root:root)
  var memory:[String:Any] = ["id":"test-memory","character_ko":"확인용 캐릭터","name_ko":"확인용 기억","rarity":5,"element":"물속성","role":"버퍼","acquisition":"통상","stats":["HP":100,"공격력":20,"방어력":30,"스피드":100],"skills":[["kind":"일반 공격","ja":"原文","ko":"원문","adjacent_break":10]],"limit_breaks":[["stage":1,"ja":"原文","ko":"원문"]],"unknown_future_field":["유지":true],"pv_url":"https://youtu.be/M7lc1UVf-VE"]
  let revision=try store.save(memory,expected:nil)
  let initialEntries=try store.load();precondition(initialEntries.count == 1)
  func mustFail(_ action:()throws->Void) { do { try action();fatalError("거부해야 하는 요청이 성공했습니다.") } catch {} }
  mustFail { _=try store.save(memory,expected:nil) }
  mustFail { _=try store.file("../../outside") }
  mustFail { _=try store.localAsset("/images/../../secret") }
  memory["name_ko"]="수정한 기억 '검증'"
  let updated=try store.save(memory,expected:revision)
  precondition(updated != revision)
  let loaded=try store.load()[0]["memory"] as! [String:Any]
  precondition(loaded["name_ko"] as? String == "수정한 기억 '검증'")
  precondition((loaded["unknown_future_field"] as? [String:Bool])?["유지"] == true)
  let backups=try fm.contentsOfDirectory(atPath:root.appendingPathComponent("data/editor-backups/test-memory").path);precondition(backups.count==1)
  mustFail { _=try store.save(memory,expected:revision) }
  let migration=try store.exportMigration()
  let sql=try String(contentsOf:migration,encoding:.utf8)
  precondition(sql.contains("''검증''"));precondition(sql.contains("ON CONFLICT"))
  let second=try store.exportMigration();precondition(second.lastPathComponent=="0002_editor.sql")
  var bad=memory;bad["stats"]=["HP":true,"공격력":20,"방어력":30,"스피드":100];mustFail { try MemoryStore.validate(bad) }
  bad=memory;bad["pv_url"]="https://youtube.com.evil.test/watch?v=M7lc1UVf-VE";mustFail { try MemoryStore.validate(bad) }
  bad=memory;bad["pv_url"]="https://youtube.com/watch?v=bad";mustFail { try MemoryStore.validate(bad) }
  var actorMemory=memory;actorMemory["voice_actor"]="공통 성우";actorMemory["voice_actor_url"]="https://namu.wiki/w/성우"
  _=try store.save(actorMemory,expected:updated)
  var sibling=actorMemory;sibling["id"]="another-memory";sibling.removeValue(forKey:"voice_actor");sibling.removeValue(forKey:"voice_actor_url")
  _=try store.save(sibling,expected:nil)
  var actorEntries=try store.load()
  precondition(actorEntries.allSatisfy { ($0["memory"] as? [String:Any])?["voice_actor"] as? String == "공통 성우" })
  let active=actorEntries.first { ($0["memory"] as? [String:Any])?["id"] as? String == "test-memory" }!
  actorMemory["voice_actor"]="수정한 성우";actorMemory["voice_actor_url"]="https://ja.wikipedia.org/wiki/声優"
  _=try store.save(actorMemory,expected:active["revision"] as? String)
  actorEntries=try store.load();precondition(actorEntries.allSatisfy { ($0["memory"] as? [String:Any])?["voice_actor"] as? String == "수정한 성우" })
  mustFail { _=try store.save(sibling,expected:active["revision"] as? String) }
  bad=actorMemory;bad["voice_actor_url"]="javascript:alert(1)";mustFail { try MemoryStore.validate(bad) }
  var affiliation=memory;affiliation["id"]="affiliation-memory";affiliation["work"]="magia-record"
  mustFail { _=try store.save(affiliation,expected:nil) }
  affiliation["group"]="unknown";mustFail { _=try store.save(affiliation,expected:nil) }
  affiliation["group"]="mikazuki";let affiliationRevision=try store.save(affiliation,expected:nil)
  affiliation["work"]="madoka";mustFail { _=try store.save(affiliation,expected:affiliationRevision) }
  affiliation["group"]="";_=try store.save(affiliation,expected:affiliationRevision)
  var multiple=memory;multiple["id"]="multiple-groups";multiple["work"]="magia-record";multiple["groups"]=["mikazuki","yachiyo"]
  let multiRevision=try store.save(multiple,expected:nil)
  let multiLoaded=try store.load().first { ($0["memory"] as? [String:Any])?["id"] as? String == "multiple-groups" }!["memory"] as! [String:Any]
  precondition(multiLoaded["groups"] as? [String] == ["mikazuki","yachiyo"])
  multiple["groups"]=[] as [String];mustFail { _=try store.save(multiple,expected:multiRevision) }
  multiple["groups"]=["mikazuki","unknown"];mustFail { _=try store.save(multiple,expected:multiRevision) }
  multiple["groups"]=["mikazuki","mikazuki"];mustFail { _=try store.save(multiple,expected:multiRevision) }
  multiple["groups"]=["mikazuki","yachiyo"];multiple["work"]="madoka";mustFail { _=try store.save(multiple,expected:multiRevision) }
  var portrait:[String:Any] = ["id":"test-portrait","name_ko":"이름+5","name_ja":"名前+5","rarity":4,"stats_max":["HP":637,"공격력":90,"방어력":85],"ability_levels":(0...5).map { level -> [String:Any] in ["level":level,"effects":level == 0 ? [["text_ko":"공격력 +5%","text_ja":"攻撃力+5%","condition_ko":"캐릭터 조건","condition_ja":"条件","tags":["공격력"]]] : []] }]
  let portraitRevision=try store.savePortrait(portrait,expected:nil)
  let portraitLoaded=try store.loadPortraits()[0]["memory"] as! [String:Any];precondition(portraitLoaded["name_ko"] as? String == "이름")
  portrait["name_ko"]="수정+5";_=try store.savePortrait(portrait,expected:portraitRevision);mustFail { _=try store.savePortrait(portrait,expected:portraitRevision) }
  let portraitSQL=try String(contentsOf:store.exportPortraitMigration(),encoding:.utf8);precondition(portraitSQL.contains("INSERT INTO portraits"))
  var badPortrait=portrait;badPortrait["rarity"]=3;mustFail { try MemoryStore.validatePortrait(badPortrait) }
  badPortrait=portrait;badPortrait["ability_levels"]=[] as [[String:Any]];mustFail { try MemoryStore.validatePortrait(badPortrait) }
  var acquiredPortrait=portrait
  for source in ["distribution","story","puella-pictura"] { acquiredPortrait["acquisition_type"]=source;try MemoryStore.validatePortrait(acquiredPortrait) }
  acquiredPortrait["acquisition_type"]="story";acquiredPortrait["story_id"]="main-story-one";try MemoryStore.validatePortrait(acquiredPortrait)
  acquiredPortrait["acquisition_type"]="distribution";mustFail { try MemoryStore.validatePortrait(acquiredPortrait) }
  acquiredPortrait["acquisition_type"]="unknown";acquiredPortrait["story_id"]="";mustFail { try MemoryStore.validatePortrait(acquiredPortrait) }
  var homura=memory;homura["id"]="homura-base";homura["character_ko"]="아케미 호무라";homura["character_ja"]="暁美ほむら";homura["character_group"]="akemi-homura";homura["voice_actor"]="그룹 성우"
  _=try store.save(homura,expected:nil)
  var devil=homura;devil["id"]="homura-devil";devil["character_ko"]="악마 호무라";devil["character_ja"]="悪魔ほむら";devil["voice_actor"]="개별 성우";devil["voice_actor_override"]=true
  _=try store.save(devil,expected:nil)
  precondition(MemoryStore.sameCharacter(homura,devil))
  precondition(MemoryStore.sameCharacter(["character_ja":"鹿目まどか"],["character_ja":"アルティメットまどか"]))
  var groupEntries=try store.load();var baseEntry=groupEntries.first{($0["memory"] as? [String:Any])?["id"] as? String == "homura-base"}!
  homura["voice_actor"]="그룹 변경";_=try store.save(homura,expected:baseEntry["revision"] as? String)
  groupEntries=try store.load();let devilEntry=groupEntries.first{($0["memory"] as? [String:Any])?["id"] as? String == "homura-devil"}!
  precondition((devilEntry["memory"] as? [String:Any])?["voice_actor"] as? String == "개별 성우")
  devil["voice_actor_override"]=false;devil["voice_actor"]="그룹 재변경";_=try store.save(devil,expected:devilEntry["revision"] as? String)
  baseEntry=try store.load().first{($0["memory"] as? [String:Any])?["id"] as? String == "homura-base"}!
  precondition((baseEntry["memory"] as? [String:Any])?["voice_actor"] as? String == "그룹 재변경")
  let groupCommon=try store.characters().first{$0["character_group"] as? String == "akemi-homura"}!
  precondition(groupCommon["character_ko"] as? String == "아케미 호무라")
  bad=memory;bad["character_group"]="bad group";mustFail{try MemoryStore.validate(bad)}
  bad=memory;bad["voice_actor_override"]="false";mustFail{try MemoryStore.validate(bad)}
  print("로컬 저장·수정·백업·충돌 방지·자료 보존·주소 검증·배포 파일 검증 통과")
 }
}
