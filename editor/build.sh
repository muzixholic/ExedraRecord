#!/bin/zsh
set -eu
cd "${0:A:h}"
APP="../dist/기억 입력 도구.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/ui" "$APP/Contents/Resources/service"
xcrun swiftc -target arm64-apple-macos13.0 Core.swift Portraits.swift Online.swift App.swift -o "$APP/Contents/MacOS/ExedraEditor" -framework AppKit -framework WebKit -O
cp ../public/affiliations.js "$APP/Contents/Resources/ui/"
cp service/portrait-model.js "$APP/Contents/Resources/ui/"
cp ui/* "$APP/Contents/Resources/ui/"
cp service/* "$APP/Contents/Resources/service/"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>ExedraEditor</string>
<key>CFBundleIdentifier</key><string>local.exedra.record.editor</string>
<key>CFBundleName</key><string>기억 입력 도구</string>
<key>CFBundleDisplayName</key><string>기억 입력 도구</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.5.0</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$APP"
printf '앱 생성 완료: %s\n' "$APP"
