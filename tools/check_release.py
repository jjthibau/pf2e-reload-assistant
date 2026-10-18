"""Verify install metadata, source/archive parity, privacy boundaries and hashes."""
import hashlib
import json
import re
import zipfile
from build_release import ROOT,FILES

m=json.loads((ROOT/'module.json').read_text(encoding='utf-8'))
p=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
base='https://github.com/jjthibau/pf2e-reload-assistant'
assert m['id']=='pf2e-reload-assistant' and m['version']==p['version']
assert m['manifest']==base+'/releases/latest/download/module.json'
assert m['download']==base+'/releases/download/v'+m['version']+'/module.zip'
assert m['license']=='LICENSE' and m['socket'] is True
assert m['esmodules']==['scripts/main.js'] and m['styles']==['styles/reload.css']
assert m['relationships']['systems'][0]['id']=='pf2e'
assert m['compatibility']['verified']=='14.369' and 'packs' not in m
out=ROOT/'dist'
assert (out/'module.json').read_bytes()==(ROOT/'module.json').read_bytes()
with zipfile.ZipFile(out/'module.zip') as z:
    assert sorted(z.namelist())==sorted(FILES) and z.testzip() is None
    for name in FILES:
        assert z.read(name)==(ROOT/name).read_bytes(),name
        assert not re.search(r'C:[/\\]codex|\.cloudapp\.azure\.com|/data/maintenance|FOUNDRY_ADMIN_KEY|session=|Creed|creed-local-source',z.read(name).decode('utf-8')),name
for line in (out/'SHA256SUMS').read_text().splitlines():
    digest,name=line.split('  ',1)
    assert digest==hashlib.sha256((out/name).read_bytes()).hexdigest()
assert (out/'RELEASE_NOTES.md').read_text().strip()
print('Manifest, exact archive allowlist, source parity, privacy boundaries and checksums verified.')
