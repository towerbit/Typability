<div align="center">

<img src="./images/typability-icon.svg" width="150" />

# Typability
一个基于 [Milkdown](https://milkdown.dev/) 的所见即所得 Markdown 编辑器。
(感谢 [SoilZhu](https://github.com/SoilZhu) 绘制了这个图标!)

[![build(nightly)](https://github.com/SimonShiki/Typability/actions/workflows/validate.yml/badge.svg)](https://github.com/SimonShiki/Typability/actions/workflows/validate.yml)


<img src="./images/typability-screenshot-zh-CN.png" width="400" />
</div>

# ✨ 特性
- [x] **🌈 使用流畅设计 (Fluent Design) - 基于微软的 Fluent UI 组件库和使用原生的云母/亚克力窗口**
- [x] **🪶 足够轻量化 - 使用 tauri 进行构建来获得更小的体积和内存占用**
- [x] 📝 **所见即所得的 Markdown - 提供类似于 Typora 的无缝编辑体验**
# 📝 最近更新

## 0.6.5
- 新增大纲侧边栏：按标题层级树形展示，点击定位到对应标题（所见即所得与源代码视图均支持）；宽度可拖拽调整并自动记住（200px ~ 窗口宽度-300px）
- 双栏编辑器左右两栏滚动同步：以标题为锚点，标题之间线性插值
- 修正源代码视图下点击大纲需要点两次、甚至完全失效的问题

## 0.6.4
- 新增「外观」设置（跟随系统 / 浅色 / 深色），编辑器主题不再被系统深色模式强制接管
- 修复：从源代码视图切回后勾选双栏编辑器不生效、勾选状态与实际视图不一致；点击该项后菜单自动收起
- 源代码视图下禁用「插入图表」「插入公式」
- 点击链接气泡的 OPEN 后自动关闭气泡

## 0.6.3
- 查找/替换的匹配会在编辑器里高亮显示，当前项加重显示；修正了嵌套块(如列表项)中匹配位置偏移的问题
- 打开查找/替换弹窗时自动聚焦输入框

## 0.6.2
- 链接编辑气泡加宽，并在 APPLY 后新增 OPEN 按钮，用默认浏览器打开链接

## 0.6.1
- 「双栏编辑器」下移到「源代码视图」上方，两者互斥；打开或新建文档时都恢复为未勾选

## 0.6.0
- 可记住窗口大小和位置（在首选项中开启）；保存的尺寸或位置在显示器上放不下时回退到默认值
- 仅在文档确实有修改时才提示保存，关闭、打开、新建和拖拽文件都是如此
- 文件菜单的「保存」随改动状态启用/禁用，「另存为」不再在系统保存对话框之外多弹一次确认
- 支持把 Markdown 文件拖到窗口里打开
- 编辑菜单新增「源代码视图」，可直接编辑 Markdown 源码；打开和新建文档时总是回到所见即所得视图
- 标题栏显示当前文件名，鼠标悬停可查看完整路径
- 关于页的「检查更新」会打开 GitHub Releases 页面
- Windows 版本除安装包外，还提供免安装的 `Typability_版本号_x64_windows.zip`（仅为可执行文件）

# 🚧 开发目标
- [x] 多语言支持
- [x] 查找/替换
- [x] LaTeX 支持
- [ ] 更多导出选项
- [x] 双栏编辑器

# ☔ 系统要求
- [x] Windows 7+ (推荐: Windows 10 1803 +)
- [x] macOS 11.3+ (原因: [Fluent UI's broswer support matrix](https://react.fluentui.dev/?path=/docs/concepts-developer-browser-support-matrix--page))
- [x] 大多数 Linux 发行版 (推荐/已测试: Ubuntu 18.04 +)

# 📦 如何编译
本项目使用 [tauri](https://tauri.app) 构建, 请先跟随 [这篇教程](https://tauri.app/v1/guides/getting-started/prerequisites/)。
```bash
yarn install # Install dependencies
yarn tauri dev # Start development server
yarn tauri build # Bundle App
```
# 🌍 翻译

Typability 从 0.3.0 版本开始添加了多语言支持([Transifex 项目](https://www.transifex.com/typability/typability))。 如果你有意向翻译本项目, 欢迎联系我!
