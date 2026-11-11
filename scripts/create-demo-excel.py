"""Build the F6 demo import files from the real templates in public/templates.

Run: python3 scripts/create-demo-excel.py
Output: demo/excel/*.xlsx (see docs/demo-script.md, flow F6).

Each error file holds a single row: the importer stops at the first bad row
and keeps the rows before it, so one error per file keeps the demo clean.
"""

from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "public" / "templates"
OUT = ROOT / "demo" / "excel"

ROOMS = ("rooms-import-template.xlsx", "Rooms")
OWNERS = ("owners-import-template.xlsx", "Owners")
ROOM_OWNERS = ("room-owners-import-template.xlsx", "RoomOwners")

FILES = {
    # Good files, imported in this order: rooms -> owners -> room owners.
    "demo-1-rooms.xlsx": (
        ROOMS,
        [
            ["upsert", "B-301", 0.5, "B", "3", 35.5, "true"],
            ["upsert", "B-302", 0.5, "B", "3", 35.5, "true"],
            ["upsert", "B-303", 0.5, "B", "3", 42, "true"],
        ],
    ),
    "demo-2-owners.xlsx": (
        OWNERS,
        [
            ["upsert", "Import · B-301 new owner", "import.b301.new@example.test", "0810000301", "", "true"],
            ["upsert", "Import · B-302 new owner", "import.b302.new@example.test", "0810000302", "", "true"],
            ["upsert", "Import · B-303 new owner", "import.b303.new@example.test", "", "import_b303", "true"],
            # Existing seeded owner: upsert by email updates the phone only.
            ["upsert", "Owner A · TH · 2 ห้อง + รับมอบฉันทะ", "owner.th.2rooms-proxy@example.test", "0899999999", "", "true"],
        ],
    ),
    "demo-3-room-owners.xlsx": (
        ROOM_OWNERS,
        [
            ["upsert", "B-301", "import.b301.new@example.test"],
            ["upsert", "B-302", "import.b302.new@example.test"],
            ["upsert", "B-303", "import.b303.new@example.test"],
        ],
    ),
    # Error files, one case each.
    "demo-err-rooms-zero-percent.xlsx": (
        ROOMS,
        [["upsert", "B-399", 0, "B", "3", 30, "true"]],
    ),
    "demo-err-room-owners-unknown-room.xlsx": (
        ROOM_OWNERS,
        [["upsert", "Z-999", "import.b301.new@example.test"]],
    ),
    "demo-err-room-owners-unknown-email.xlsx": (
        ROOM_OWNERS,
        [["upsert", "B-302", "nobody.missing@example.test"]],
    ),
    "demo-err-room-owners-active-owner.xlsx": (
        ROOM_OWNERS,
        [["upsert", "A-101", "import.b301.new@example.test"]],
    ),
}


def build(name, template, rows):
    file_name, sheet = template
    wb = openpyxl.load_workbook(TEMPLATES / file_name)
    ws = wb[sheet]
    for r, row in enumerate(rows, start=5):
        for c, value in enumerate(row, start=1):
            ws.cell(row=r, column=c, value=value if value != "" else None)
    wb.save(OUT / name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (template, rows) in FILES.items():
        build(name, template, rows)
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
