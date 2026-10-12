"""Download (part of) a public Google Drive folder without an API key.

Usage: python3 scripts/drive_fetch.py <folder_id> <out_dir> [path filter regex]
Used to fetch CC0 model packs (e.g. Quaternius) that are hosted on Drive.
"""
import html, os, re, sys, urllib.request

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def listing(fid):
    page = get(f'https://drive.google.com/embeddedfolderview?id={fid}').decode('utf-8', 'replace')
    for m in re.finditer(r'href="https://drive\.google\.com/(drive/folders|file/d)/([\w-]+)[^"]*".*?flip-entry-title">([^<]+)', page, re.S):
        yield m.group(1) == 'drive/folders', m.group(2), html.unescape(m.group(3))

def walk(fid, out, pattern, rel=''):
    for is_dir, cid, name in listing(fid):
        path = f'{rel}/{name}' if rel else name
        if is_dir:
            if pattern.search(path + '/') or any(pattern.search(path + '/' + x) for x in ['']):
                walk(cid, out, pattern, path)
            elif not rel:
                walk(cid, out, pattern, path)
            continue
        if not pattern.search(path):
            continue
        dest = os.path.join(out, path)
        if os.path.exists(dest):
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        data = get(f'https://drive.usercontent.google.com/download?id={cid}&export=download&confirm=t')
        with open(dest, 'wb') as f:
            f.write(data)
        print(f'{len(data):>9}  {path}', flush=True)

if __name__ == '__main__':
    fid, out = sys.argv[1], sys.argv[2]
    pattern = re.compile(sys.argv[3] if len(sys.argv) > 3 else '.')
    walk(fid, out, pattern)
