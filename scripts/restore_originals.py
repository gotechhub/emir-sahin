"""Extract the PPT's embedded video bytes. Never transcode or resize."""
from pathlib import Path
import hashlib, json, zipfile

root = Path(__file__).resolve().parents[1]
deck = root.parent / 'EMIR_SAHIN_PORTFOLIO_l.pptx'
destination = root / 'site' / 'videos'
destination.mkdir(parents=True, exist_ok=True)
report = []
with zipfile.ZipFile(deck) as archive:
    entries = [info for info in archive.infolist()
               if info.filename.startswith('ppt/media/') and
               Path(info.filename).suffix.lower() in ('.mov', '.mp4')]
    assert len(entries) == 49, 'Unexpected video count'
    for entry in entries:
        data = archive.read(entry)
        target = destination / Path(entry.filename).name
        target.write_bytes(data)
        original_hash = hashlib.sha256(data).hexdigest()
        assert hashlib.sha256(target.read_bytes()).hexdigest() == original_hash
        # Read the sample description without changing the container.
        index = data.find(b'stsd')
        while index >= 0 and data[index + 16:index + 20] not in (b'avc1', b'hvc1', b'hev1', b'apch', b'apcn'):
            index = data.find(b'stsd', index + 4)
        codec = data[index + 16:index + 20].decode('ascii', errors='replace') if index >= 0 else None
        width = int.from_bytes(data[index + 44:index + 46], 'big') if index >= 0 else None
        height = int.from_bytes(data[index + 46:index + 48], 'big') if index >= 0 else None
        report.append(dict(file=target.name, ppt_entry=entry.filename, bytes=len(data),
                           sha256=original_hash, codec=codec, width=width, height=height))
expected = {item['file'] for item in report}
# Only remove generated reduced copies in this exact videos directory.
for target in destination.iterdir():
    if target.is_file() and target.name not in expected:
        assert target.parent.resolve() == (root / 'site' / 'videos').resolve()
        target.unlink()
out = root / 'verification' / 'original-videos.json'
out.write_text(json.dumps(dict(count=len(report), bytes=sum(r['bytes'] for r in report),
                              source=deck.name, videos=report), indent=2), encoding='utf-8')
print(json.dumps(dict(verified=len(report), bytes=sum(r['bytes'] for r in report),
                     codecs=sorted({r['codec'] for r in report}),
                     dimensions=sorted({f"{r['width']}x{r['height']}" for r in report}))))
