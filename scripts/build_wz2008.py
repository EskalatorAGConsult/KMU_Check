#!/usr/bin/env python3
"""
Baut src/lib/wz2008.json aus der OFFIZIELLEN WZ-2008-Gliederung des
Statistischen Bundesamtes (Destatis).

Quelle (Destatis, offizielles Gliederungs-PDF, WZ 2008):
https://www.destatis.de/DE/Methoden/Klassifikationen/Gueter-Wirtschaftsklassifikationen/Downloads/gliederung-klassifikation-wz-3100130089004.pdf?__blob=publicationFile&v=2

Ausfuehren: python scripts/build_wz2008.py
Ausgabe:  src/lib/wz2008.json  { "28.29": "Herstellung von ...", "C": "Verarbeitendes Gewerbe", ... }
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

QUELLE = (
    "https://www.destatis.de/DE/Methoden/Klassifikationen/Gueter-Wirtschaftsklassifikationen/"
    "Downloads/gliederung-klassifikation-wz-3100130089004.pdf?__blob=publicationFile&v=2"
)
ZIEL = Path(__file__).resolve().parent.parent / "src" / "lib" / "wz2008.json"
PDF_TMP = Path("/tmp/wz2008-gliederung.pdf")

# Zeilenanfaenge: Abschnitt (A-U), Abteilung (2), Gruppe (3, z. B. 01.3),
# Klasse (4, z. B. 01.28), Unterklasse (5, z. B. 01.28.0)
CODE_RE = re.compile(r"^([A-U]|\d{2}(?:\.\d{1,2})?(?:\.\d)?)\s+(\S.*)$")
# ISIC-Spalte am Zeilenende (z. B. "0128" oder "0141*") abschneiden
ISIC_RE = re.compile(r"\s+\d{4}\*?\s*$")
SOFT_HYPHEN = "­"


def main() -> int:
    if not PDF_TMP.exists():
        print(f"Lade offizielle Gliederung: {QUELLE}")
        urllib.request.urlretrieve(QUELLE, PDF_TMP)

    from pypdf import PdfReader

    reader = PdfReader(str(PDF_TMP))
    eintraege: dict[str, str] = {}
    letzter_code: str | None = None

    for seite in reader.pages:
        text = seite.extract_text() or ""
        for zeile in text.replace(SOFT_HYPHEN, "").splitlines():
            zeile = zeile.strip()
            if not zeile:
                continue
            m = CODE_RE.match(zeile)
            if m:
                code, titel = m.group(1), ISIC_RE.sub("", m.group(2)).strip()
                if not titel:
                    continue
                # Erste Angabe gewinnt (Unterklassen wiederholen Klassen-Titel)
                if code not in eintraege:
                    eintraege[code] = titel
                letzter_code = code
            elif letzter_code and not zeile.startswith(("WZ 2008", "Kode", "ISIC")):
                # Fortsetzungszeile des vorherigen Titels
                if not re.match(r"^(Rev\.|Seite|\d+ / \d+)", zeile):
                    eintraege[letzter_code] = (eintraege[letzter_code] + " " + zeile).strip()

    # Mehrfach-Leerzeichen normalisieren; Abschnitts-Titel aufhuebschen
    # („ABSCHNITT C – VERARBEITENDES GEWERBE" -> „Verarbeitendes Gewerbe")
    bereinigt: dict[str, str] = {}
    for k, v in eintraege.items():
        t = re.sub(r"\s+", " ", v).strip()
        if len(k) == 1:
            m = re.match(r"^ABSCHNITT [A-U]\s*[-–]\s*(.+)$", t, re.IGNORECASE)
            if m:
                t = m.group(1).strip().title().replace(" Und ", " und ").replace(" Der ", " der ").replace(" Des ", " des ").replace(" Von ", " von ").replace(" Fuer ", " für ").replace(" In ", " in ").replace(" Und  ", " und ")
        bereinigt[k] = t
    eintraege = bereinigt

    # Plausibilitaetschecks (offizielle Umfangsgroessenordnung der WZ 2008)
    abschnitte = [k for k in eintraege if len(k) == 1]
    klassen4 = [k for k in eintraege if re.match(r"^\d{2}\.\d{2}$", k)]
    unterklassen5 = [k for k in eintraege if re.match(r"^\d{2}\.\d{2}\.\d$", k)]
    print(f"Abschnitte: {len(abschnitte)} · Klassen (4-stellig): {len(klassen4)} · Unterklassen (5-stellig): {len(unterklassen5)} · gesamt: {len(eintraege)}")
    assert len(abschnitte) == 21, "21 Abschnitte (A-U) erwartet"
    assert len(klassen4) > 200, "deutlich ueber 200 Klassen erwartet"
    assert len(unterklassen5) > 500, "deutlich ueber 500 Unterklassen erwartet"
    # Stichprobe: MABE-relevanter Code (Maschinen-/Behälterbau)
    assert "28.29" in eintraege, "28.29 (Maschinenbau) muss enthalten sein"
    assert "28.29.0" in eintraege, "28.29.0 (Unterklasse) muss enthalten sein"

    ZIEL.write_text(
        json.dumps(dict(sorted(eintraege.items(), key=lambda kv: kv[0])), ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8",
    )
    print(f"OK: {ZIEL} ({ZIEL.stat().st_size} Bytes)")
    print(f"Stichprobe 28.29.0: {eintraege['28.29.0']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
