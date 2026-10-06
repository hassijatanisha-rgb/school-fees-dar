"""Render a store PRIVACY.md to a standalone HTML page for the public site.

Usage: python3 scripts/privacy_page.py <PRIVACY.md> <out.html> <title>
"""
import html
import re
import sys


def inline(s):
    s = html.escape(s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    s = re.sub(r'(?<![_\w])_(.+?)_(?![_\w])', r'<em>\1</em>', s)
    return re.sub(r'(https://[^\s)<]+)', r'<a href="\1">\1</a>', s)


def render(src):
    out, in_list = [], False
    for line in src.splitlines():
        if line.startswith('- '):
            if not in_list:
                out.append('<ul>')
                in_list = True
            out.append('<li>' + inline(line[2:]) + '</li>')
            continue
        if in_list:
            out.append('</ul>')
            in_list = False
        if line.startswith('## '):
            out.append('<h2>' + inline(line[3:]) + '</h2>')
        elif line.startswith('# '):
            out.append('<h1>' + inline(line[2:]) + '</h1>')
        elif line.strip():
            out.append('<p>' + inline(line) + '</p>')
    if in_list:
        out.append('</ul>')
    return '\n'.join(out)


def main(src_path, out_path, title):
    body = render(open(src_path, encoding='utf-8').read())
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>:root{{--bg:#fff;--text:#1a1f24}}@media (prefers-color-scheme:dark){{:root{{--bg:#111518;--text:#e6ebef}}}}
body{{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,sans-serif}}main{{max-width:720px;margin:0 auto;padding:24px 16px 48px}}h2{{margin-top:28px;font-size:19px}}code{{font-size:14px}}a{{color:inherit}}</style>
</head><body><main>
{body}
</main></body></html>
'''
    open(out_path, 'w', encoding='utf-8').write(page)


if __name__ == '__main__':
    main(*sys.argv[1:4])
