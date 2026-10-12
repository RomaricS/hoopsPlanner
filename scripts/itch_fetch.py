"""Download the free files of an itch.io page (name-your-price / free assets).

Usage: python3 scripts/itch_fetch.py <page url> <out dir> [file name filter regex]
"""
import http.cookiejar, json, re, sys, os, urllib.parse, urllib.request

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.addheaders = [('User-Agent', 'Mozilla/5.0'), ('X-Requested-With', 'XMLHttpRequest')]

def fetch(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    with opener.open(url, body, timeout=300) as r:
        return r.read()

page_url, out = sys.argv[1].rstrip('/'), sys.argv[2]
pattern = re.compile(sys.argv[3] if len(sys.argv) > 3 else '.', re.I)
page = fetch(page_url).decode('utf-8', 'replace')
csrf = re.search(r'name="csrf_token" value="([^"]+)"', page).group(1)
dl = json.loads(fetch(page_url + '/download_url', {'csrf_token': csrf}))['url']
dpage = fetch(dl).decode('utf-8', 'replace')
csrf = re.search(r'name="csrf_token" value="([^"]+)"', dpage).group(1)
os.makedirs(out, exist_ok=True)
for m in re.finditer(r'data-upload_id="(\d+)".*?title="([^"]+)" class="name"', dpage, re.S):
    uid, name = m.groups()
    if not pattern.search(name):
        print('skip', name)
        continue
    info = json.loads(fetch(f'{page_url}/file/{uid}?source=view_game&as_props=1&after_download_lightbox=1', {'csrf_token': csrf}))
    if 'url' not in info:
        print('no url', name, info)
        continue
    data = fetch(info['url'])
    name = re.sub(r'[^\w.-]+', '_', name) + ('' if name.lower().endswith('.zip') else '.zip')
    with open(os.path.join(out, name), 'wb') as f:
        f.write(data)
    print(len(data), name, flush=True)
