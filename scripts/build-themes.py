"""Regenerate the scoped Typora theme CSS and the export styles.
Usage: python scripts/build-themes.py <typora-resources-style-themes-dir>
"""
import json
import os
import re
import shutil
import sys

THEMES = ['github', 'newsprint', 'night', 'pixyll', 'whitey']
NIGHT_EXTRA = ['codeblock.dark.css', 'mermaid.dark.css', 'sourcemode.dark.css']

DROP_AT = ('@include-when-export', '@import', '@charset', '@page', '@keyframes', '@-webkit-keyframes')
UI_MARKERS = (
    '.md-', '#md-', '.ty-', '.popover', '.code-tooltip', '.native-window',
    'textarea', '.typora-export', '.md-focus', '.md-hover-tip',
    '.md-notification', '.md-image', '.md-rawblock', '.md-end-block',
    '.md-inline-math', '.md-math-block', '.md-grid-board', '.btn',
    '.modal', '.dropdown', '.tooltip', '.footnotes', '.ui-', '.sidebar',
    '.file-list', '.md-table-fig', '.context-menu'
)
CODE_MARKERS = ('.cm-', '.CodeMirror', "[lang='mermaid']", '[lang="mermaid"]')


def clean_text(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    lines = [
        line for line in css.splitlines()
        if not line.lstrip().startswith(DROP_AT) and line.strip() not in ('--', '')
    ]
    return '\n'.join(lines)


def split_blocks(css):
    out, buf, i, n = [], '', 0, len(css)
    while i < n:
        if css[i] == '{':
            depth, j = 1, i + 1
            while j < n and depth:
                if css[j] == '{':
                    depth += 1
                elif css[j] == '}':
                    depth -= 1
                j += 1
            header = buf.strip()
            out.append((header, css[i + 1:j - 1], header.startswith('@')))
            buf, i = '', j
        else:
            buf += css[i]
            i += 1
    return out


def font_face(header, body, theme):
    if header != '@font-face':
        return None
    body = re.sub(r"url\(\s*['\"]\./" + theme + r"/([^'\"]+)['\"]\s*\)",
                  "url('./fonts/" + theme + r"/\1')", body)
    return '@font-face {' + body + '}\n'


def scoped_selector(selector, theme):
    s = selector.strip()
    if not s or s.startswith('@') or any(m in s for m in UI_MARKERS):
        return None
    if any(m in s for m in CODE_MARKERS):
        return '[data-theme="' + theme + '"] ' + s
    if s in ('body', 'html', ':root', '*'):
        return '[data-theme="' + theme + '"] .milkdown'
    if s.startswith(('body ', 'html ', ':root ')):
        s = s.split(' ', 1)[1]
    s = s.replace('#write', '.editor').replace('.md-fences', 'pre')
    return '[data-theme="' + theme + '"] .milkdown ' + s


def process(css, theme):
    result = []
    for header, body, is_at in split_blocks(css):
        face = font_face(header, body, theme)
        if face:
            result.append(face)
            continue
        if is_at:
            if header.startswith('@media') and not header.startswith('@media print'):
                inner = process(body, theme)
                if inner.strip():
                    result.append(header + ' {\n' + inner + '}\n')
            continue
        selectors = [x for x in (scoped_selector(p, theme) for p in header.split(',')) if x]
        if selectors:
            result.append(', '.join(selectors) + ' {\n' + body.strip() + '\n}\n')
    return ''.join(result)


def to_export_css(css, theme):
    css = re.sub(r'@font-face\s*\{[^}]*\}', '', css)
    css = css.replace('[data-theme="' + theme + '"] .milkdown ', 'body ')
    css = css.replace('[data-theme="' + theme + '"] .milkdown', 'body')
    css = css.replace('[data-theme="' + theme + '"] ', '')
    for family, replacement in (
        ("'Open Sans'", "'Segoe UI'"), ("'Lato'", "'Segoe UI'"),
        ("'PT Serif'", "'Georgia'"), ("'Merriweather'", "'Georgia'")
    ):
        css = css.replace(family, replacement)
    return css.strip()


def main():
    src = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dst = os.path.join(root, 'src', 'themes')
    os.makedirs(os.path.join(dst, 'fonts'), exist_ok=True)

    scoped_parts, export_styles = [], {}
    for theme in THEMES:
        with open(os.path.join(src, theme + '.css'), encoding='utf-8') as f:
            css = clean_text(f.read())

        if theme == 'night':
            for extra in NIGHT_EXTRA:
                path = os.path.join(src, 'night', extra)
                if os.path.isfile(path):
                    with open(path, encoding='utf-8') as f:
                        css += '\n' + clean_text(f.read())

        scoped = process(css, theme)
        scoped_parts.append('/* ' + theme + ' theme, scoped to the editor */\n' + scoped + '\n')
        export_styles[theme] = to_export_css(scoped, theme)

        font_dir = os.path.join(src, theme)
        if os.path.isdir(font_dir):
            shutil.copytree(font_dir, os.path.join(dst, 'fonts', theme), dirs_exist_ok=True)

    with open(os.path.join(dst, 'typora.css'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(scoped_parts))

    with open(os.path.join(dst, 'exportStyles.ts'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/build-themes.py, do not edit\n')
        f.write('export const exportStyles: Record<string, string> = {\n')
        for theme in THEMES:
            f.write('    ' + json.dumps(theme) + ': ' + json.dumps(export_styles[theme]) + ',\n')
        f.write('};\n')

    print('generated typora.css and exportStyles.ts')


if __name__ == '__main__':
    main()
