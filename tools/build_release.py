"""Build an installable archive from an explicit public allowlist."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
FILES=['module.json','scripts/main.js','styles/reload.css','README.md','LICENSE','CHANGELOG.md','docs/architecture.md','docs/testing.md']

def build(tag=None):
    manifest=json.loads((ROOT/'module.json').read_text(encoding='utf-8'))
    if tag is not None and tag!='v'+manifest['version']:
        raise SystemExit('Release tag must match module.json version.')
    out=ROOT/'dist'
    out.mkdir(exist_ok=True)
    with zipfile.ZipFile(out/'module.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            info=zipfile.ZipInfo(name,(2026,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,(ROOT/name).read_bytes())
    (out/'module.json').write_bytes((ROOT/'module.json').read_bytes())
    (out/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256((out/name).read_bytes()).hexdigest()}  {name}\n' for name in ['module.json','module.zip']),encoding='utf-8')
    (out/'RELEASE_NOTES.md').write_text(f"## PF2e Reload Assistant {manifest['version']}\n\nDefault ammunition, outside-combat loading, quiet chat Reload controls, depletion choices and an optional ignore-ammunition mode.\n\nTested on Foundry14.369/PF2e8.6.0. Native character inventory weapons; see README for scope.\n\nInstall manifest: {manifest['manifest']}\n",encoding='utf-8')
    print(f'Built {len(FILES)} original/public files; private and licensed data excluded.')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--tag')
    build(parser.parse_args().tag)
