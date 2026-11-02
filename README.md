<div align="center">

<img src="./images/typability-icon.svg" width="150" />

# Typability
a WYSIWYG markdown editor based on [Milkdown](https://milkdown.dev/).
(Thanks to [SoilZhu](https://github.com/SoilZhu) for drawing this icon!)

[![build(nightly)](https://github.com/SimonShiki/Typability/actions/workflows/validate.yml/badge.svg)](https://github.com/SimonShiki/Typability/actions/workflows/validate.yml)


<img src="./images/typability-screenshot.png" width="400" />
</div>

# ✨ Features
- [x] **🌈 Fluent Design - Use FluentUI components with Mica\Arcylic background**
- [x] **🪶 Lightweight - Bundle with tauri for smaller installer size and memory usage**
- [x] 📝 **WYSIWYG Markdown - provides Typora-like seamless Markdown editing experience**
# 📝 What's new

## 0.6.3
- Find/replace matches are highlighted in the editor, the current match is emphasized; match positions in nested blocks(e.g. list items) are fixed
- The search box gets the focus automatically when the find/replace toolbar opens

## 0.6.2
- The link editing chip is wider and gets an `OPEN` button that opens the link with the default browser

## 0.6.1
- `Two-column Editor` is now right above `Source code view`; the two views are mutually exclusive and both are unchecked when a document is opened or created

## 0.6.0
- Remember the size and position of the window (optional, in Preferences); the default size/position is used when the saved one doesn't fit any monitor
- Only ask to save when the document was really modified, no matter if it's closing, opening, creating or dropping a file
- `Save` is enabled only when there are changes, and `Save as` no longer shows a confirmation dialog on top of the system save dialog
- Drop a markdown file onto the window to open it
- A source code view (`Edit → Source code view`) to edit the raw markdown, every document opens in the WYSIWYG view
- The current file name is shown in the title bar, the full path is available on hover
- `Check Update` in the About dialog opens the GitHub releases page
- Windows releases also ship a portable `Typability_<version>_x64_windows.zip` next to the installers

# 🚧 Todo
- [x] Multi-language support
- [x] Find/Replace
- [x] LaTeX support
- [ ] More export options
- [x] Two-column editor
- [ ] Picture bed integration

# ☔ System Requirements
- [x] Windows 7+ (Recommend: Windows 10 1803 +)
- [x] macOS 11.3+ (Reasons: see [Fluent UI's broswer support matrix](https://react.fluentui.dev/?path=/docs/concepts-developer-browser-support-matrix--page))
- [x] most Linux distributions (Recommend/Tested: Ubuntu 18.04 +)

# 📦 How to build
This project is bundled with [tauri](https://tauri.app), You should follow [this guide](https://tauri.app/v1/guides/getting-started/prerequisites/) first.
```bash
yarn install # Install dependencies
yarn tauri dev # Start development server
yarn tauri build # Bundle App
```
# 🌍 Translation

Typability add i18n support since version 0.3.0. Here is the [Transifex Project](https://www.transifex.com/typability/typability). If you're intersted in translating this project, contact me please!
