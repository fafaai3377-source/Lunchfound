#!/usr/bin/env python3
"""
사옥 주변 식당 목록(stores.json) 만들기 — 분기마다 한 번 다시 돌리면 돼요.

1) 공공데이터포털에서 "소상공인시장진흥공단_상가(상권)정보" 파일(zip)을 받기
   https://www.data.go.kr/data/15083033/fileData.do  (이용허락범위 제한 없음, 분기 갱신)
2) python3 tools/build-stores.py 받은파일.zip 2026-06-30   ← 저장소 맨 위 폴더에서 (뒤 날짜 = 데이터 기준일, 파일 이름의 _YYYYMMDD)
3) 생긴 stores.json 확인 → sw.js VERSION 올려서 푸시

· 서울 파일만 읽고, 업종 대분류가 "음식"인 곳 중 사옥(config.js의 office) 반경 RADIUS m 안만 남겨요
· 좌표는 사옥 기준 차이 × 100000(약 1m 단위 정수)로 줄여서 파일을 작게
"""
import csv, io, json, math, re, sys, zipfile
from collections import Counter
from pathlib import Path

RADIUS = 2000           # m — 장소 추가 검색 범위와 같게
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "stores.json"


def office():
    s = (ROOT / "config.js").read_text(encoding="utf-8")
    m = re.search(r"office:\s*\{[^}]*?lat:\s*([\d.]+),\s*lng:\s*([\d.]+)", s, re.S)
    return float(m.group(1)), float(m.group(2))


def dist(a, b, c, d):
    r = math.radians
    h = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def open_csv(zf, name):
    # 큰 파일(서울 약 300MB)이라 통째로 읽지 않고 한 줄씩. 요즘 파일은 UTF-8, 옛 파일은 CP949
    with zf.open(name) as f:
        head = f.read(65536)
    try:
        head.decode("utf-8")
        enc = "utf-8-sig"
    except UnicodeDecodeError as e:
        enc = "utf-8-sig" if e.start > 65000 else "cp949"   # 끝에서 잘린 글자 때문이면 UTF-8
    return csv.DictReader(io.TextIOWrapper(zf.open(name), encoding=enc, newline=""))


def num(main, sub):
    main, sub = str(main or "").strip(), str(sub or "").strip()
    if not main or main == "0":
        return ""
    return main + (f"-{sub}" if sub and sub != "0" else "")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1])
    oy, ox = office()
    zf = zipfile.ZipFile(src)
    seoul = [n for n in zf.namelist() if n.lower().endswith(".csv") and "서울" in n]
    if not seoul:   # zip 안 파일 이름이 깨져 있으면(옛 방식 인코딩) 다시 읽기
        seoul = [n for n in zf.namelist() if n.lower().endswith(".csv") and "서울" in n.encode("cp437", "replace").decode("cp949", "replace")]
    if not seoul:
        raise SystemExit("zip 안에서 서울 CSV를 못 찾았어요: " + ", ".join(zf.namelist()[:20]))
    asof = sys.argv[2] if len(sys.argv) > 2 else ""
    if not asof:
        m = re.search(r"(20\d{2})(\d{2})(\d{2})?", src.name) or re.search(r"(20\d{2})(\d{2})", seoul[0].encode("cp437", "replace").decode("cp949", "replace"))
        asof = f"{m.group(1)}-{m.group(2)}-{m.group(3) or '01'}" if m else ""

    cats, rows, seen = {}, [], set()
    for name in seoul:
        for r in open_csv(zf, name):
            if (r.get("상권업종대분류명") or "").strip() != "음식":
                continue
            try:
                lat, lng = float(r["위도"]), float(r["경도"])
            except (KeyError, ValueError):
                continue
            if dist(oy, ox, lat, lng) > RADIUS:
                continue
            nm = (r.get("상호명") or "").strip()
            br = (r.get("지점명") or "").strip()
            if br and br not in nm:
                nm = f"{nm} {br}"
            if not nm:
                continue
            road = (r.get("도로명") or "").split()[-1:] or [""]
            road = f"{road[0]} {num(r.get('건물본번지'), r.get('건물부번지'))}".strip()
            lot = f"{(r.get('법정동명') or '').strip()} {num(r.get('지번본번지'), r.get('지번부번지'))}".strip()
            k = f"{(r.get('상권업종중분류명') or '').strip()}|{(r.get('상권업종소분류명') or '').strip()}"
            if k not in cats:
                cats[k] = len(cats)
            dy, dx = round((lat - oy) * 1e5), round((lng - ox) * 1e5)
            key = (nm, dy, dx)
            if key in seen:
                continue
            seen.add(key)
            floor = (r.get("층정보") or "").strip()
            rows.append([nm, cats[k], dy, dx, road, lot, floor] if floor else [nm, cats[k], dy, dx, road, lot])

    rows.sort(key=lambda x: (x[2] ** 2 + x[3] ** 2))
    out = {"asof": asof, "src": "소상공인시장진흥공단 상가(상권)정보", "radius": RADIUS, "o": [oy, ox],
           "k": list(cats), "s": rows}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    top = Counter(k.split("|")[0] for k in (list(cats)[x[1]] for x in rows)).most_common(12)
    print(f"{OUT.name}: {len(rows)}곳 · {OUT.stat().st_size / 1024:.0f}KB · 기준일 {asof}")
    print("업종:", ", ".join(f"{a} {b}" for a, b in top))


if __name__ == "__main__":
    main()
