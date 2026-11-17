# Vollständige Funktions-Analyse – MABE KMU-Förderportal (KMU_Check)

Stand: 17.11.2026 · Analysestand: Commit `81f18df` (main) · Verifiziert: `npm test` (219/220 Unit-Tests grün, 4 ENV-abhängige Integrations-Tests erwartbar rot ohne Credentials), `npm run lint` (0 Fehler), `npm run build` (31 Routen, sauber).

Diese Dokumentation erfasst **jede Funktion und Server Action** des Projekts mit Zweck, Verhalten, Seiteneffekten und Sicherheitsaspekten. Grundlagen-Infos (Stack, Deployment, ENV-Variablen) stehen in `AGENTS.md` und `README.md`.

---

## 0 · Architektur-Überblick

```
Landingpage (/) ──KMU-Check (Client-Wizard)──▶ POST /api/lead ──▶ Webhook (n8n/CRM) + Lead-Mail
                                                                    ▲
Vertrieb (Admin /admin) ──Angebot anlegen──▶ Journey-Link /v/<token>│
                                                                    │
Kunde ──Journey (/v/<token>)──▶ Server Actions (lib/journey/actions.ts)
         │                            │
         │                            ├─▶ Supabase Postgres (stammdaten, beteiligungen, kmu_bewertungen,
         │                            │    deminimis_*, vollmachten, dokumente, uebergaben, audit_events)
         │                            ├─▶ Vercel Blob (private: Vollmacht, Systemkonzept, Signatur, Uploads)
         │                            └─▶ Resend (Eingangsbestätigung, Vollmacht-Mail an Admins)
         │
         └─Konto (/konto) ◀── Auto-Claim beim Öffnen des Journey-Links
```

- **Autorisierungsmodell:** 3 unabhängige Kanäle — (1) Journey: Token (SHA-256-Hash in DB, 90 Tage), (2) Admin: Better-Auth-Session + `requireAdmin()`, (3) Kunde: Better-Auth-Session + Zuordnung via `angebot_zugriffe`. RLS ist Deny-by-default und zusätzliche Tiefenverteidigung; der eigentliche Zugriff läuft serverseitig über Service-Role.
- **Datenkonsistenz-Kern:** Die finale Validierung erfolgt vollständig serverseitig in `schliesseJourneyAb()`; Drafts werden unvalidiert als JSONB gespeichert. Admin-Korrekturen (Revisionen) überstehen erneute Kunden-Einreichungen (`adminKorrekturen`-Merge).

---

## 1 · Fachlicher Kern (framework-frei, voll getestet)

### `src/lib/kmu.ts` — KMU-Engine nach EU 2003/361/EG (448 Zeilen)

| Funktion | Zeile | Zweck & Verhalten |
|---|---|---|
| `fundingRateFor(category)` | 109 | Förderquote BAFA Modul 3: kleinst/klein → 45, mittel → 35, sonst 25. |
| `num(v)` (privat) | 122 | Normalisiert `number\|undefined\|null` auf nicht-negative finite Zahl, sonst 0. |
| `classify(totals)` | 127 | Einstufung: JAE strikt `<` Schwelle **UND** (Umsatz ODER Bilanzsumme) `<=` Grenze; Reihenfolge kleinst → klein → mittel → gross. Baut deutsche Begründungs-Texte. |
| `kontrollSchluss(start, kanten, ausgeschlossen)` (privat) | 178 | BFS über Kanten mit `pct > 50` in **beide** Richtungen (Kontrolle wirkt reziprok), beliebig tief, zyklenfest über `besucht`-Map. Liefert Knoten → Kettentiefe. |
| `analysiereVerbund(companyName, holdings)` | 230 | Zentrale Verbund-Analyse. Knoten deduplizieren (erste Angabe gewinnt), Kanten mit Max-Quote je Paar, `< 25 %` weg. Dann: (1) verbundene via Kontroll-Schluss → 100 %; (2) direkte Partner (25–50 % direkt am Antragsteller) → anteilig; (2b) Partner verbundener Unternehmen zählen mit direkter Quote in die Daten des Verbundenen (Art. 6 Abs. 2 — früher fälschlich ignoriert, Audit-Finding HIGH); (3) mit einem Partner verbundene Unternehmen erben die Partner-Quote (Max-Prinzip gegen Doppelzählung). Ergebnis: `VerbundZeile[]` mit `effektivPct`, `tiefe`, `art` (verbunden/partner/ignoriert) und deutschem `grund` je Zeile. |
| `evaluateKmu(input)` | 364 | Konsumiert `analysiereVerbund`: verbundene 100 %ig addieren, Partner × Quote; konsolidiert = own + partner + linked; `classify` auf den Konsolidierungswerten; `nearThreshold` (≥ 90 % des nächsten JAE-Schwellwerts) für UX-Warnungen. Liefert das vollständige `KmuResult` (auch als DB-Snapshot in `kmu_bewertungen.berechnung`). |
| `formatEUR(v)` / `formatNumber(v, digits)` | 438/446 | `Intl.NumberFormat('de-DE')`-Formatierung (EUR ohne Nachkommastellen). |

**Testabdeckung:** `kmu.test.ts` (9/9 Edge-Cases gegen EU-Quellen).

### `src/lib/validierung.ts` — Prüfverfahren (190 Zeilen)

| Funktion | Zeile | Zweck |
|---|---|---|
| `normalisiereIban` / `formattiereIban` | 37/42 | Leerzeichen raus + Uppercase; Vierergruppen-Anzeige. |
| `ibanMod97` (privat) | 49 | MOD-97 ohne BigInt (zeichenweise, A=10…Z=35). |
| `pruefeIban(eingabe)` | 67 | ISO 13616 komplett: Zeichenvorrat, Ländercode in Registry (~100 Länder, `IBAN_LAENGEN`), ländergenaue Länge, Prüfziffer. Deutsche Meldungen mit konkreter Stellenzahl. |
| `steuerIdPruefziffer(zehn)` | 100 | ISO 7064 MOD 11,10 (BZSt/ELSTER-Verfahren). |
| `normalisiereSteuerId` | 117 | Speicherformat = reine 11-stellige Ziffernfolge (DB-CHECK). |
| `pruefeSteuerId(eingabe)` | 121 | 11 Ziffern, erste ≠ 0, Wiederholungsregel (genau eine Ziffer 2–3× in den ersten 10), Prüfziffer. |
| `pruefeUstId` | 150 | Format `DE` + 9 Ziffern (keine öffentliche Prüfziffer → bewusst nur Format). |
| `pruefeWzCode` | 164 | WZ 2008: Abschnitts-Buchstabe A–U oder gepunktete Ziffernhierarchie („28", „28.29", „28.29.12"). |
| `pruefeSteuernummer` | 179 | Tolerant: 10–13 Ziffern mit üblichen Trennzeichen (bundeslandspezifische Schemata). |

### `src/lib/journey/verbund-jahre.ts` — Jahresbezogene Verbund-Kennzahlen (126 Zeilen)

| Funktion | Zeile | Zweck |
|---|---|---|
| `zuZahl` (privat) | 47 | Rohwert (number/string) → number\|null, kommatolerant (deutsches Format „1.234,50"), NaN/negativ → null. |
| `jahresArray` (privat) | 59 | Drafts lesen `jahre`, DB-Zeilen `kennzahlen` (Migration 24). |
| `jahrKennzahl(b, gj, feld)` | 69 | Kennzahl einer Beteiligung für EIN Geschäftsjahr. **Fallback-Regel (Audit):** Skalarwerte nur, wenn gar kein Jahres-Array existiert — niemals Jahr-Fehlende aus Vorjahr „erfinden" (sonst fälschlich ins BAFA-Portal). |
| `holdingsFuerJahr(beteiligungen, gj)` | 83 | Baut die `Holding[]`-Eingabe der kmu.ts-Engine für genau ein Geschäftsjahr (jahregemischt). |
| `jahreAufbauen(b, geschaeftsjahre)` | 108 | Vollständige `jahre`-Struktur: vorhandene Einträge unangetastet, fehlende leer; nur Beteiligungen ohne jedes Array erben Legacy-Skalarwerte in beide Jahre (Alt-Draft-Migration). |

### `src/lib/vollstaendigkeit.ts` — Einreichungsreife (173 Zeilen)

`pruefeVollstaendigkeit(e)` (Zeile 65): reiner Vertrag, prüft 7 Bausteine (Stammdaten, Steuer & Bank personenart-abhängig, Ansprechpartner, KMU = **2** Geschäftsjahre + Kategorie, De-minimis-Erklärung, Vollmacht-Nachweis (PDF oder Signatur+Name), Systemkonzept-Dokument). Liefert `{ bausteine, offen, vollstaendig }` mit konkreten Hinweistexten. Speist Fallakte-UI, Fallakte-PDF und künftige Ampel-Badges.

### `src/lib/slider-skala.ts` (26 Zeilen)

Vertrag für den 25–100-Quote-Slider: `schienenPosition()` (Zeile 14) rechnet Werte positionsgenau — der EU-Kipppunkt 50 % liegt bei 33,3 % der Schiene (nicht bei 62,5 %), `SKALA` liefert vorberechnete Marker. Ohne dieses Modul würden Ticks/Labels das EU-Zonenbild verfälschen.

### `src/lib/labels.ts` / `src/lib/admin/feld-labels.ts` — Beschriftungen (Single Source of Truth)

`labels.ts`: deutsche BAFA-Wording-Labels aller Enums (Technologien, Personenart, Status, De-minimis, Beantragungsweg …); TypeScript erzwingt via `Record<Enum, string>` Vollständigkeit. `feld-labels.ts`: `FELD_LABEL`-Map (40 Felder) + `feldLabel()` (Zeile 51) mit Fallback auf technischen Namen — genutzt von Admin-Bearbeitung und Fallakte-Audit-Report.

### `src/lib/fehler.ts` — Zentrales Fehler-Handling (50 Zeilen)

- `fehlerMeldung(e, fallback)` (14): nutzerlesbare Meldung (Error.message/String/Fallback), Kürzung bei 300 Zeichen.
- `fehlerKennung()` (25): stabile Kurz-ID für Support-Rückfragen.
- `loggeFehler(bereich, fehler, kontext)` (34): strukturiertes JSON-Log (Sentry-ready, ein Einstiegspunkt); Kontext darf nur nicht-personenbezogene Fachdaten enthalten; logging selbst darf nie werfen (zirkuläre Referenzen abgefangen).

### `src/lib/wz2008.ts`

Amtliche Destatis-WZ-2008-Datenbasis (Codes + Bezeichnungen) für das Autocomplete-Feld `wz-code-feld.tsx`. Reine Daten, keine Logik.

---

## 2 · Journey-Engine (Konfiguration statt Code)

### `src/lib/journey/types.ts`

`FeldTyp` (12 Typen), `FeldDef` (name/typ/label/hilfe/tooltip/pflicht/optionen/standard/gruppe/**`sichtbarWenn`**), `SchrittDef` (id/titel/kurz/beschreibung/erklaerung/komponente/felder/registerSuche), `SchrittKomponente` (generisch|uebersicht|beantragungsweg|selbst|kmu|deminimis|vollmacht).

### `src/lib/journey/schritte.ts` — DIE Klickstrecke (298 Zeilen)

`SCHRITTE` (Zeile 18): 9 Schritte in Reihenfolge — `uebersicht` → `beantragungsweg` → `selbst` → `unternehmen` (16 Felder, `registerSuche: true`, bedingte Felder Geburtsdatum/Steuer-ID vs. Steuernummer/USt-Id via `sichtbarWenn`) → `ansprechpartner` (5 Felder) → `kmu` → `deminimis` → `antrag` (Gruppenzugehörigkeit, wirtschaftlich tätig, Standort, Kontoinhaber, IBAN) → `vollmacht`. Jeder Schritt mit Laien-Erklärung („Warum fragen wir das?") und Feld-Tooltips.

- `schrittNach(id)` (285): Lookup.
- `aktiveSchritteFuer(weg)` (294): **Dynamische Strecke** — `weg === 'selbst'` → nur Übersicht/Wahl/Unterlagen (kein Portal-Formular), sonst volle Strecke ohne Selbst-Seite. Alle Indices/Bounds im Wizard laufen über diese Funktion.

### `src/lib/journey/schemas.ts` — Zod-Schemas (290 Zeilen)

- `formatFehler(typ, wert)` (23): leitet Formatprüfung an `validierung.ts` weiter.
- `feldSchema(feld)` (42): typabhängiges Basisschema; `auswahl` mit `z.enum` aus den definierten Optionen (**Server-Integrität**: manipulierte Payload-Werte wie `land != "Deutschland"` scheitern); Zahlen via `z.coerce.number().min(0)`.
- `schemaFuerGenerischenSchritt(schritt)` (87): baut Objektschema aus Felddefinitionen; optional bei nicht-pflicht oder `sichtbarWenn`; `superRefine` macht die **sichtbarkeitsbewusste** Formatprüfung + bedingte Pflicht (ausgeblendete Felder blockieren nie); `.strip()` entfernt Fremdfelder (z. B. `register_id`).
- Fachliche Schemas: `beteiligungJahrSchema` (135), `beteiligungSchema` (143; `jahre` max. 2, `anteil_pct >= 25`, Legacy-Skalarfelder als Fallback), `kmuJahrSchema` (166), `kmuSchema` (181; `jahre.length === 2`, `hat_beteiligungen` für Server-erzwungenen leeren Verbund), `beihilfeSchema` (193), `deminimisSchema` (203; `bestaetigt === true` Pflicht, § 264-StGB-Hinweis), `vollmachtSchema` (214; `signatur_png` max. 400 KB Data-URL, `vollmacht_upload_pfad` muss `.blob.vercel-storage.com` enthalten; `superRefine`: bei Eskalator-Weg ohne Upload → Name ≥ 5 Zeichen + Signatur Pflicht).
- `schemaFuerSchritt(schritt)` (273): Dispatcher generisch ↔ fachlich.

### `src/lib/journey/fortschritt-info.ts`

`fortschrittInfo(aktuellerIdx, anzahl)` (21): rein; Prozent zählt **erledigte** Schritte (Goal-Gradient), Restzeit-Schätzung 75 s/Schritt, `fertig`-Flag.

### `src/lib/journey/actions.ts` — Server Actions (676 Zeilen, `'use server'`)

| Action | Zeile | Verhalten |
|---|---|---|
| `speichereSchritt(token, schrittId, daten)` | 39 | Token validieren → Status-Check (kein Speichern nach Einreichung) → Draft als JSONB in `journey_fortschritt` upsert; Status `angelegt/eingeladen` → `in_bearbeitung`; Audit `schritt_gespeichert`. **Drafts werden bewusst unvalidiert gespeichert** — finale Validierung erst beim Abschluss. |
| `ladeVollmachtUploadHoch(token, formData)` | 70 | `validiereUploadDatei` (Magic-Bytes PDF/PNG/JPG, 15 MB) → **Anti-Missbrauch-Deckel**: max. 10 Blobs unter Prefix `vollmacht-upload/<angebot_nr>` (Blob-List) → Upload ins private Blob → Audit. Rückgabe: Blob-URL (wird als `vollmacht_upload_pfad` im Draft gespeichert). |
| `schliesseSelbstBeantragungAb(token)` | 121 | Abschluss des Selbst-Wegs: nur Status → `abgeschlossen` + Audit `selbst_beantragung_gewaehlt`. Kein Daten-Transfer (Datenminimierung). |
| `schliesseJourneyAb(token, alleDaten)` | 141 | **Herzstück** (12 Abschnitte): ① Beantragungsweg vom Eingangsschritt in den Vollmacht-Payload mischen → alle 7 fachlichen Schritte serverseitig validieren (`schrittFehler` je Schritt bei Fehlern). ② KMU-Berechnung **je Geschäftsjahr** mit `holdingsFuerJahr` (Quote aus dem jüngsten Jahr). ③ Upload-Pfad **Trust-Boundary**: Pfad aus Client wird nicht blind geglaubt — muss dem Prefix `/vollmacht-upload/<eigene Angebotsnr>` entsprechen und real existieren (`ladeDokumentBuffer`) — sonst wäre die Signatur-Pflicht mit einer Phantom-Blob-Referenz umgehbar. ④ Signatur-PNG dekodieren + als Blob archivieren. ⑤ Stammdaten-Upsert mit **Admin-Korrektur-Schutz**: chronologisch alle `vorgang_revisionen` (Bereich `stammdaten`) einlesen, letzte Admin-Entscheidung gewinnt (`adminKorrekturen` overlay) + Audit `admin_korrekturen_bewahrt`; personenart-fremde Restwerte vor dem Insert gelöscht (DB-CHECK). ⑥ Beteiligungen: delete + insert (Skalarspalten = neuestes Jahr, `kennzahlen` = alle BAFA-Jahre). ⑦ `kmu_bewertungen` je Jahr als Snapshot inkl. vollständiger `berechnung`. ⑧ De-minimis: delete + insert + Erklärung mit Summen-Snapshot. ⑨ `vollmachten`-Upsert (signatur_modus canvas/upload, IP/UA aus `x-forwarded-for`/`user-agent`). ⑩ Status → `eingereicht` + Audit. ⑪ **Best effort danach:** Webhook-POST (Payload ohne `validiert` — DSGVO-Datenminimierung; Protokoll in `uebergaben`), Eingangsbestätigungsmail mit Angebots-PDF-Anhang, Systemkonzept-Einbindung (Priorität: Admin-Vorlage > universelle Vorlage aus `docs/vorlagen/systemkonzept_modul3.pdf` > dynamisch generiert), offizielle BAFA-Vollmacht (`fuelleVollmachtAus` mit Canvas-Signatur bzw. Upload als Dokument) + Vollmacht-Mail an Admins. Kein Post-Status-Fehler kann die Einreichung scheitern lassen — alles audit-loggt (`systemkonzept_generiert { ok: false }` etc.). |

---

## 3 · DB-Layer & Repositories (alle `server-only`, Service-Role)

### `src/lib/db/server.ts`
`supabaseServer()` (Zeile 15): lazy Singleton `createClient(url, SUPABASE_SERVICE_ROLE_KEY)`, `persistSession: false`. Wirft mit klarer Meldung, wenn ENV fehlt. `'server-only'` bricht den Build ab, falls je in eine Client-Komponente importiert.

### `src/lib/db/ssl.ts`
`pgSsl()` (14): TLS-Pinning — liest `certs/supabase-prod-ca.crt`, `{ ca, rejectUnauthorized: true }`. Fehlt die CA: bewusster Fallback auf `rejectUnauthorized: false` mit **lauter Warnung** (nosemgrep-Kommentar; bewusste Abweichung gegen den Semgrep-Finding bypass-tls-verification). CA-Erneuerung: `scripts/extrahiere-supabase-ca.mjs`.

### `src/lib/db/types.ts` (267 Zeilen)
Handgepflegte Spiegel-Typen aller Tabellen/Enums (bis Migration 24: `BeteiligungJahrRow`, `systemkonzept_bestaetigt`, `VorgangRevisionRow`, `VorgangNotizRow`, `KundenZugriffRow` …). Wird manuell synchron gehalten (Typgenerierung geplant).

### `src/lib/db/repositories/angebote.ts`
`listeAngebote()` (18; Top-1000, Client-Filterung), `erstelleAngebot(userId, eingabe)` (47; Insert + `extrahiert_am` nur bei Extraktion), `holeAngebot(id)` (76), `loescheAngebot(id)` (87; **DSGVO-Art. 17**: DB-Kaskade entfernt alle abhängigen Daten).

### `src/lib/db/repositories/journey.ts`
- `audit(angebotId, actor, aktion, details)` (16): append-only Audit-Log; Fehler nur geloggt (nie werfen — Audit darf Fachprozess nicht blockieren).
- `erzeugeKlartextToken()` (25): 192 Bit `randomBytes`, base64url.
- `hasheToken(klartext)` (29): SHA-256 als **PostgREST-Bytea-Format** `'\x' + hex` (Buffer würde als JSON-Objekt serialisiert und matched nie — Verifikations-Befund).
- `erstelleJourneyToken(angebotId, laufzeitTage = 90)` (36): legt Token an, gibt Klartext **nur hier** zurück.
- `validiereToken(klartext)` (53): Hash-Lookup mit `revoked_at IS NULL` + `expires_at > now`, Angebot mit `status != widerrufen`; `last_used_at` best-effort ohne await.
- `protokolliereZugriff(angebotId, tokenId, ip, ua)` (88): Migration 20, UA auf 300 Zeichen gekürzt, best effort.
- `holeFortschritt` (102) / `speichereFortschritt` (111; Merge bestehender Schritte + upsert), `setzeAngebotStatus` (129).

### `src/lib/db/repositories/benutzer.ts`
`listeBenutzer()` (25), `setzeBenutzerRolle` (35), `existiertBenutzer(email)` (40, `ilike`), `listeEinladungen()` (57), `erstelleEinladung(email, rolle, eingeladenVon, laufzeitTage = 14)` (73; gleicher Token-Hash-Muster), `validiereEinladungsToken` (93; einmalig + widerrufen + abgelaufen), `markiereEinladungVerwendet` (106), `widerrufeEinladung` (110). `ADMIN_ROLLEN = ['admin','eskalator','vertrieb']` (15).

### `src/lib/db/repositories/dashboard.ts`
`ladeDashboardKennzahlen()` (35): KPIs in JS über max. 1000 Vorgänge — proStatus-Zählung, `ohneZugriffUeber7Tage` (kunden_zugriffe-Cutoff), aktuelle Förderquote je offenem Vorgang (jüngstes Geschäftsjahr zuerst via Map-First-Wins), Pipeline-Invest + vorauss. Zuschuss, `ueberfaelligeWiedervorlagen` (Delegation an notizen.ts).

### `src/lib/db/repositories/konto.ts` (Kunden-Dashboard)
- `holeVorgangDossier(userId, angebotId)` (17): **Autorisierung via `angebot_zugriffe`** (sonst null), dann 6 Tabellen parallel; ohne eingereichte Stammdaten kein Dossier.
- `verknuepfeZugriff(userId, angebotId)` (74): idempotenter Upsert (Auto-Claim).
- `listeVorgaengeFuerUser(userId)` (90): Übersicht mit `gespeicherteSchritte` (max. 6, ohne Übersicht) und `eingereichteDaten`.
- `holeVorgangFuerUser(userId, angebotId)` (143): Detail (Karte) — Fortschritt in %, Vollauszug nur bei `eingereicht/abgeschlossen`.

### `src/lib/db/repositories/kunden.ts` (Admin-Fallakte)
- `listeKunden()` (48): Aggregation nach `kunde_email` (citext), angereichert mit Registrierungsstatus (`user.role='kunde'`), `letzteAngebotId` als kanonischer Fallakte-Schlüssel (**keine Klartext-E-Mail in URLs** — DSGVO).
- `holeKunde(email)` (133): Kunde + alle Vorgänge + Kontoname.
- `holeVorgang(angebotId)` (162): einzelner Vorgang (Fallakte-PDF).
- `holeVorgaenge(angebote)` (172, privat): **Der Vollauszug** — 10 parallele Abfragen (stammdaten, beteiligungen, kmu, deminimis × 2, vollmachten, dokumente, fortschritt, uebergaben, audit), Gruppierung via `gruppiere()` mit Limits (`MAX_UEBERGABEN=5`, `MAX_AUDIT=10`, `MAX_ZUGRIFFE=15`), plus Revisionen + Notizen, Bearbeiter-ID→„Name (E-Mail)"-Auflösung, exakte Zugriffsanzahl je Vorgang (N+1-Count bewusst klein gehalten: 1 Count-Query je Vorgang, parallel).

### `src/lib/db/repositories/notizen.ts`
`listeNotizen(ids, limit=50)` (13), `fuegeNotizHinzu` (26), `loescheNotiz(notizId, angebotId)` (42; zusätzlich am Vorgang verankert = Mandantenkonsistenz), `zaehleUeberfaelligeWiedervorlagen(ids, heuteIso)` (52; Count-Kachel).

### `src/lib/db/repositories/revisionen.ts` (Migration 19)
`aktualisiereAngebotFelder` (13), `aktualisiereStammdatenFelder` (22), `holeStammdaten` (31), `legeStammdatenAn` (42), `speichereRevision(angebotId, bearbeitetVon, bereich, aenderungen)` (50; append-only `{ feld: { alt, neu } }`), `listeRevisionen(ids)` (63; Top-200).

---

## 4 · Auth (Better Auth) & Einladungen

### `src/lib/auth/index.ts` (64 Zeilen)
`auth = betterAuth({...})`: pg-Pool über `DATABASE_URL` mit `pgSsl()` (TLS-Pinning, `max: 5`), `emailAndPassword` mit **min. 12 Zeichen**, Reset-Mail via Resend, `databaseHooks.user.create.after` → Willkommens-Mail nur für `role === 'kunde'`, `user.additionalFields.role` mit `input: false` (**Rolle kommt nie aus dem Client** — öffentliche Registrierung erzeugt garantiert nur `kunde`), Session 8 h / Update alle 1 h.

### `src/lib/auth/guards.ts`
- `requireAdmin()` (16): Session → sonst Redirect `/admin/login`; Rolle im `ADMIN_ZUGANG`-Set (`admin|eskalator|vertrieb`), `deaktiviert` immer abgelehnt.
- `holeSession()` (25): Session ohne Redirect.
- `requireKunde()` (37): Session → sonst `/konto/anmelden`; `deaktiviert` abgelehnt (Vertriebsrollen dürfen das Kundenkonto für Support einsehen — bewusst).

### `src/lib/auth/client.ts`
`authClient = createAuthClient()` (6): Better-Auth-Browser-Client für Login/Logout.

### `src/lib/einladung/actions.ts` — `nehmeEinladungAn(eingabe)` (28)
Öffentliche Action, Autorisierung = gültiger Einladungs-Token. Zod-Validierung (Name ≥ 2, Passwort ≥ 12) → `validiereEinladungsToken` → Duplikat-Check → `auth.api.signUpEmail` → `setzeBenutzerRolle(userId, einladung.rolle)` (Server-seitig!) → `markiereEinladungVerwendet` → Audit `einladung_angenommen`.

---

## 5 · Admin-Bereich (Server Actions, alle `requireAdmin()` + Audit)

### `src/lib/admin/actions.ts`
- `erstelleAngebotAction(eingabe)` (44): Zod-Schema → `erstelleAngebot` → `erstelleJourneyToken` → 2 Audits → **Draft-Vorbefüllung** aus der Gemini-Extraktion (Adresse/USt-Id in den Schritt `unternehmen`, best effort). Versendet bewusst **keine** E-Mail (Entkopplung; Status bleibt `angelegt`).
- `analysiereAngebotPdf(formData)` (102): `validierePdf` (Magic-Bytes) → `analysiereAngebot` (Gemini) → Audit; Fehler = Hinweis „manuell ausfüllen", PDF wird trotzdem archiviert.
- `speichereAngebotPdf(angebotId, formData, extraktion)` (127): Blob-Upload `angebote/<nr>.pdf` → Update `angebot_pdf_path/extraktion` → zusätzlich `dokumente(typ 'angebot_pdf')` (letzter Upload gewinnt — Grundlage für Fallakte/Konto/Mail-Anhang).

### `src/lib/admin/bearbeiten-actions.ts` (Migration 19)
- **Whitelists** `ANGEBOT_FELDER` (37) / `STAMMDATEN_FELDER` (54) = Mass-Assignment-Schutz.
- `zahlOderNull` (135)/`datumOderNull` (142): Komma-tolerante Hilfen.
- `bearbeiteAngebot(angebotId, eingabe)` (150): Validierung (Firma ≥ 2, E-Mail, Datum, Technologie ≥ 1, Sensoren-Logik prozessbezug ≤ gesamt) → `bildeDiff` über Whitelist → nur geänderte Felder updaten → Revision (append-only). **Teilerfolg explizit:** schlägt die Revisions-Historie fehl, obwohl die Daten gespeichert sind, wird das dem Admin gemeldet (nicht als „nichts passiert" verschluckt). Audit + `revalidatePath`.
- `bearbeiteStammdaten(angebotId, eingabe)` (238): Erstanlage mit Pflichtfeld-Check (`fehlendeStammdatenPflichtfelder`, spiegelt DB-CHECKs), Land fest „Deutschland", Enum-Whitelists, dieselben Prüfverfahren wie die Journey (IBAN/Steuer-ID/USt/WZ/Steuernummer), Normalisierung (IBAN-Uppercase, Steuer-ID-Ziffernfolge), Diff → Insert/Update + Revision + Audit.

### `src/lib/admin/benutzer-actions.ts`
- `ladeBenutzerEin(email, rolle)` (21): E-Mail-Regex, nur `ADMIN_ROLLEN` (Kunden registrieren sich selbst), Duplikat-Check → Einladung + Mail → Audit (inkl. `gesendet/grund`); Hinweis mit Klartext-Link, wenn Mail fehlgeschlagen (manuell weitergeben).
- `widerrufeEinladungAction(id)` (64): sofort ungültig + Audit.
- `aendereRolleAction(userId, rolle)` (77): **eigene Rolle gesperrt** (Schutz vor Selbst-Aussperrung), nur `SETZBARE_ROLLEN`.

### `src/lib/admin/kunden-actions.ts`
- `ladeFallakte(angebotId)` (31): JSON-serialisierbarer Vollauszug (`holeKunde`) + Systemkonzept-Vorlagenliste.
- `erneutEinladen(angebotId)` (58): frischer Token + Status `eingeladen` + `sendeEinladung`; bei Mail-Fehler Link im Hinweis.
- `widerrufeVorgang(angebotId)` (93): Status `widerrufen` (terminal; Links ungueltig) + Audit.
- `aendereVorgangStatus(angebotId, neuerStatus)` (118): **Statusmaschine** (`status.ts`): `istUebergangErlaubt` enforced; Wechsel als Revision (alt→neu) + Audit.
- `erstelleJourneyLink(angebotId)` (153): neuer Link zum Kopieren ohne Mail (WhatsApp/Telefon); alte Links bleiben gültig, jeder Link eigenständig widerrufbar.
- `notizHinzufuegen(angebotId, text, wiedervorlageAm)` (179): 1–2000 Zeichen, ISO-Datum-Check.
- `notizLoeschen(notizId, angebotId)` (211): auditiert.
- `ladeDokumentHochAdmin(angebotId, formData)` (228): generischer Fallakte-Upload (Magic-Bytes) → `dokumente(typ 'upload')`.
- `loescheVorgangDsgvo(angebotId, bestaetigung)` (260): **Bestätigung durch exakte Angebotsnummer**; Lösch-Nachweis als audit_event **ohne Vorgangsbezug** (audit kaskadiert sonst mit!) VOR der Löschung, dann `loescheAngebot` (DB-Kaskade).

### `src/lib/admin/einstellungen-actions.ts`
- `speichereWebhookUrl(url)` (13): `istGueltigeWebhookUrl` (https; http nur localhost); leerer Wert setzt DB-Wert auf '' (= ENV-Fallback reaktiv).
- `testeWebhook()` (45): Ping mit 10-s-Timeout an die **wirksame** URL, Audit mit Status/Quelle.
- `testeEmailVersand()` (96): Test-Mail an festen Empfänger `robin@eskalator.ag` (unabhängig vom klickenden Admin).
- `speichereLeadEmpfaenger(wert)` (115): Komma/Semikolon-Liste validieren; leer = Standard/ENV-Fallback.

### `src/lib/admin/systemkonzept-actions.ts`
- `listeSystemkonzeptVorlagen()` (30): Blob-Ordner `vorlagen/systemkonzept/` (max. 50, nur .pdf, Fehler → []).
- `setzeDokument` (46, privat): dokumente-Zeile ersetzen + Audit.
- `ladeSystemkonzeptHoch(angebotId, formData)` (61): `validierePdf` → Blob → dokumente(typ `systemkonzept`).
- `waehleSystemkonzeptVorlage(angebotId, vorlageUrl)` (84): **URL strikt geprüft** (Host `.blob.vercel-storage.com` + Pfad `/vorlagen/systemkonzept/*.pdf`) — nur eigene Blob-Vorlagen erlaubt (kein SSRF/offene Umleitung).

### `src/lib/admin/datei-upload.ts` / `pdf-upload.ts`
- `erkenneContentType` (datei-upload:17): Magic-Bytes `%PDF` / `‰PNG` / `ÿØÿ` — MIME des Clients ist vertrauensunwürdig.
- `bereinigeDateiname(name)` (25): Pfad-Bestandteile/Steuerzeichen raus, 80 Zeichen.
- `validiereUploadDatei(formData)` (30): 15 MB-Limit, erlaubt PDF/PNG/JPG.
- `validierePdf(formData)` (pdf-upload:11): 15 MB + `%PDF`-Magic-Bytes.

### `src/lib/admin/revision-diff.ts` (rein)
`normalisiere` (19; '' ≙ null, numerische Strings als Zahl, Arrays als JSON), `bildeDiff(alt, neu, felder)` (39; **nur** Whitelist-Felder → Mass-Assignment-Schutz), `hatAenderungen` (55), `formattiereWert` (60; deutsche Anzeige für die Historie).

### `src/lib/admin/stammdaten-pflicht.ts`
`fehlendeStammdatenPflichtfelder(eingabe)` (14): spiegelt die NOT-NULL-Spalten + bedingte Pflicht laut DB-CHECK (natürlich → Geburtsdatum+Steuer-ID; juristisch → Steuernummer) — verständliche Feldliste statt roher Constraint-Fehler.

### `src/lib/admin/status.ts`
`STATUS_TRANSITIONEN` (10): erlaubte manuelle Statuswechsel (z. B. `eingereicht → in_bearbeitung` für Nachreichungen, `abgeschlossen → eingereicht` für fachliche Korrektur; `widerrufen` terminal), `erlaubteZiele` (23), `istUebergangErlaubt` (27).

### `src/lib/admin/dossier-text.ts`
`baueDossierText(e)` (65): vollständiger Datenauszug als kopierfähiger Klartext in **exakter BAFA-Modul-3-Reihenfolge** (9 Abschnitte) für den Transfer ins FZD-Portal; nutzt `analysiereVerbund` für die EU-Zurechnung je Beteiligung (inkl. Kette/Vorjahr), `jahrKennzahl` für Vorjahreswerte. Rein, unit-getestet.

---

## 6 · PDF & Dokumente

### `src/lib/pdf/writer.ts` — Gemeinsame PDF-Bausteine (216 Zeilen)
- `winAnsi(text)` (56): **CP1252-Sanitizer** — ersetzt technische Zeichen (`≤`→`<=`, `→`→`->` …), erlaubt CP1252-Typografie (€, „, –), alles sonstige > 0xFF → `?`. Entstand aus einem datengetriebenen Produktionsfehler („≤" in KMU-Begründungen); **garantiert**, dass kein generiertes PDF mehr am Zeichensatz scheitert.
- `eur(betrag)` (68): deutsches Format **ohne** €-Zeichen (pdf-lib-WinAnsi-Limit).
- `neuesPdfDokument(titel, betreff)` (78): Metadaten + Helvetica fett/normal.
- `class Writer` (91): Layout-Engine — automatischer Seitenumbruch (`neueSeiteWennNoetig`, Ueberschrift 56 pt-Bedarf gegen Verwaisten), `absatz` mit Wortumbruch nach Breitenmessung, `zeile` (Label 200 px-Spalte), `fusszeile` („Seite i von n" auf allen Seiten), `kopf` (Navy-Band 124 px).

### `src/lib/pdf.ts` (client, jsPDF)
- `generateKmuPdf(input, result, lead?)` (18): gebrandeter KMU-Nachweis — Kopfband, Ergebnis-Box (Einstufung + Quote), Eigen-vs.-Verbund-Tabelle, Beteiligungen mit **effektiver Verrechnungsquote** aus `analysiereVerbund` (nicht Kantenheuristik), Begründungen, Lead-Angaben, Disclaimer mit Zwei-Jahres-Regel. jsPDF dynamisch importiert (Bundle-Splitting).
- `downloadBlob(blob, filename)` (222): Object-URL + Anchor + Revoke.

### `src/lib/dossier/generate.ts`
`generiereDossier(d)` (62): Kunden-Dossier (Selbstauskunft) — Angebot, Unternehmensdaten, AP/Auszahlung, KMU-Bewertung + Beteiligungen, De-minimis, Beantragungsweg; Abschnittsnummerierung dynamisch wenn KMU fehlt. Author: MABE.

### `src/lib/dossier/fallakte.ts`
`generiereFallaktePdf(v: KundeVorgang)` (38): **internes Arbeitsdokument** — 7 Abschnitte (Angebot/technische Maßnahme, Stammdaten, KMU inkl. vollständiger Verbundrechnung Eigen/Partner/Verbunden/Konsolidiert + Begründungen, De-minimis mit verbleibendem Spielraum, Vollmacht, **Kunden-Zugriffsprotokoll** (IP/UA!), **Änderungshistorie durch Admins** mit `feldLabel`/`formattiereWert`), vertraulich-Hinweis. `kurz()` kürzt Werte gegen Randüberlauf.

### `src/lib/systemkonzept/generate.ts`
`generiereSystemkonzept(angebot, stammdaten, kmu)` (61): MABE-Standard-Systemkonzept BAFA Modul 3 — Antragsteller, Vorhabenübersicht (Investition netto), Software-Absatz (BAFA-gelistet, PDCA nach DIN EN ISO 50001), **Datenerfassungsplan nach DIN EN ISO 50015** (Messstellen, Prozessbezug, EnPIs), Systemarchitektur (Modbus/M-Bus/S0/IO-Link → Logger → EMS), **Wirkplan-Abschnitt nur wenn `steuerung` in Technologien** (DIN IEC 60050-351), Betrieb & 3-Jahres-Speicherung.

### `src/lib/vollmacht/bevollmaechtigter.ts`
`BEVOLLMAECHTIGTER` (11): einzige Pflegestelle der Vollmachtnehmer-Daten — **WissensReich Academy UG (haftungsbeschränkt), Köln** (Kontaktperson Florian Domin); Eskalator AG ist beteiligt, Vollmacht läuft über die UG.

### `src/lib/vollmacht/fuelle-vollmacht.ts`
- `formattiereUnterschriftsdatum(d)` (24): TT.MM.JJJJ mit führenden Nullen.
- `zeichneNamenssignatur(doc, name)` (56, privat): getippter Name kursiv/dunkelblau als Fallback, automatische Schriftgrößen-Anpassung.
- `fuelleVollmachtAus(geber)` (70): lädt das offizielle AcroForm `docs/vorlagen/eew_formular_eew_vm_3.pdf` (v1.0.0917), befüllt Abschnitt 1 (Kunde: Name, Vorgangsnummer, Anschrift) und Abschnitt 2 (Bevollmächtigter) über die 15 Textfelder; „Ort, den Datum" nur im Signaturmodus; `updateFieldAppearances` mit eingebetteter Helvetica (Umlaute!) → `flatten()` (Archiv-Fassung nicht editierbar) → gezeichnete Signatur **nach** dem Flatten als PNG aspect-fit in die vermessene Signaturzeile (`SIGNATUR` Seite 2, x 214/y 437) + getippter Name als Bildunterschrift; defektes Bild → Fallback Namenssignatur. `vordruck: true` lässt Datum/Signatur frei (händischer Weg).

### `src/lib/storage/blob.ts`
- `blobToken()` (21): `BLOB_READ_WRITE_TOKEN` **oder** store-präfixtes `MABE_READ_WRITE_TOKEN`.
- `blobZugriff()` (26): `private` (Vercel-Standard) außer `BLOB_ACCESS=public`.
- `ladeDokumentHoch(pfad, bytes, contentType)` (31): ohne Token `null` + Warnung (**best effort** — Fachprozess läuft weiter); `addRandomSuffix: true`.
- `ladeDokumentBuffer(urlOderPfad)` (60): serverseitiges Lesen aus dem privaten Store — Grundlage aller authentifizierten Proxy-Routen.

---

## 7 · E-Mail (Resend, durchgängig best effort)

### `src/lib/email/resend.ts`
`resendClient()` (20): lazy Singleton, ohne Key `null`. `absender()` (28): `EMAIL_FROM` oder `MaBe Förderportal <no-reply@foerderportal.mabe.de>` (Subdomain muss in Resend DNS-verifiziert sein, sonst 403). `portalUrl(pfad)` (36): `NEXT_PUBLIC_APP_URL` → `BETTER_AUTH_URL` → localhost.

### `src/lib/email/guard.ts`
`istTestAdresse(email)` (27): Sicherheitsnetz — Test-/Platzhalter-Domains (test.de, example.*, Mailinator …), reservierte TLDs (.invalid/.test/…), kaputte Domains → gesperrt. Geprüft in der **einzigen** Versand-Stelle, egal welcher Fachprozess sie auslöst.

### `src/lib/email/templates.ts`
`layout` (19; tabellenbasiert, inline Styles, MABE-CI), `button` (41), `h1` (45), `p` (49), `infoBox` (53), `esc` (14; HTML-Escaping).

### `src/lib/email/notify.ts` — 9 Notification-Funktionen
Alle best effort, Rückgabe `{ ok, grund? }` (Grund sichtbar statt verschluckt — für Audit/Admin-Anzeige):
| Funktion | Zeile | Anlass |
|---|---|---|
| `sendeMail` (privat) | 28 | Einzige Versand-Stelle: Testadressen-Filter → Key-Check → `emails.send` → verständliche Fehlergründe („domain is not verified" …). |
| `sendeTestMail` | 73 | Admin-End-to-End-Test. |
| `sendeEinladung` | 88 | Journey-Link (90 Tage), Nutzervorbereitung (JAE, Geschäftsjahre 2025+2024 inkl. Verbund). |
| `sendeEingangsbestaetigung` | 133 | Nach Einreichung, mit Antrags-Zusammenfassung + optionalem Angebots-PDF-Anhang. |
| `sendePasswortReset` | 152 | Better-Auth-Hook (Link 1 h). |
| `sendeWillkommen` | 172 | Nur Kundenkonten (Auth-Hook). |
| `sendeStatusUpdate` | 189 | Statuswechsel-Info (bereits gebaut, verwendbar). |
| `sendeBenutzerEinladung` | 210 | Team-Einladung (14 Tage, einmalig). |
| `sendeLeadBenachrichtigung` | 243 | Interne Lead-Mail; Empfänger via `ermittleLeadEmpfaenger` (DB → ENV → Standard); kopierfähige Tabellen. |
| `sendeVollmachtAnAdmins` | 274 | Unterschriebene Vollmacht als PDF-Anhang an die Lead-Empfänger-Liste. |

### `src/lib/email/lead-benachrichtigung.ts`
`baueLeadBenachrichtigungHtml(p)` (126): KMU-Ergebnis, Antragsteller, Verflechtungstabelle (mit Stufe/Bezug/Pfad + EU-Einstufung inkl. effektiver Quote), Verrechnung (Eigen + Partner + Verbunden = Konsolidiert), Lead-Kontakt mit DSGVO-Status, Meta (IP, Geo, UA, Tracking-IDs). Reine Funktion → testbar.

### `src/lib/email/antrag-zusammenfassung.ts`
`baueAntragZusammenfassungHtml(z: AntragZusammenfassung)`: Kunden-Mail nach Einreichung — Unternehmen, AP, KMU (jüngstes Jahr + Vorjahr, Schätzungs-Hinweis), Technologien/Investitionen/Sensoren, Beantragungsweg, De-minimis-Summe. Reine Funktion → testbar.

---

## 8 · Integrationen

### `src/lib/openregister/client.ts` — API-Client (server-only)
- `rufeApi`/`rufeApiPost` (82/103): Bearer-Auth; **best effort** → `null` bei fehlendem Key/Netzwerk/4xx/5xx; GET mit 1-h-Fetch-Cache (Registerdaten selten), POST ohne Cache.
- `sucheUnternehmen(query)` (152): kombiniert Autocomplete **und** Filtersuche, jeweils mit Original **und** rechtsformbereinigter Variante (`normalisiereSuchbegriff`) — behebt live verifiziertes Fuzzy-Ranking-Problem (Registername = Langform „… GmbH" verdrängte den richtigen Treffer); Merge + Dedup nach `company_id`. Kosten: 2–4 Credits.
- `holeDetails` / `holeOwners` / `holeHoldings` (162/166/173): je 10 Credits; Geldwerte der API in **Cent**.

### `src/lib/openregister/mapping.ts` — Reine Ketten-Analyse (425 Zeilen)
- `rechtsformLabel` (112), `personenartAusRechtsform` (122; konservativ: `ek` → natürlich, kapital-/handelsrechtliche Gesellschaften → juristisch, sonst null).
- `normalisiereSuchbegriff` (164): Rechtsform-/Füllwort-Tokens wortgrenzengenau entfernen; Fallback auf Original bei < 3 Restzeichen.
- `mergeSuchTreffer` (182): Listen der Suchstrategien in Aufrufreihenfolge deduplizieren (max. 20).
- `mapTreffer` (203), `kennzahlenAusIndikatoren` (221): Indikatoren → max. 2 Geschäftsjahre (neueste zuerst), Cent → Euro.
- `kantenVon` (258, privat): Owners (legal_person, aktiv) → aufwärts; Holdings (aktiv, `end` gefiltert) → abwärts; natürliche Personen gezählt, nicht verrechnet; Selbstkanten raus.
- `analysiereVerbundKette(graph, startId)` (296): **zyklenfester BFS** über die Beteiligungskette. EU-Regeln: `> 50 %` = verbunden (transitiv, beide Richtungen); `25–50 %` = Partner **nur** direkt am Antragsteller (Stufe 1); danach nur noch Mehrheiten; `partner → verbunden` Upgrade erlaubt (besserer Pfad). Knoten ohne Daten → `fehlendeIds` (der Treiber lädt nach und ruft erneut auf). Limits `KETTEN_LIMITS` = {maxUnternehmen 20, maxStufe 8, maxIgnoriert 10}; Stufenlimit → `abgeschnitten: true`. Ergebnis: `VerbundErgebnis` (unternehmen mit Adresse/WZ/Rechtsform, jahre, beteiligungen mit stufe/bezug/pfad/kennzahlen, ignoriert mit Begründung, natuerlichePersonen, kennzahlenUnvollstaendig).

### `src/lib/openregister/verbund-loader.ts`
- `istGueltigeRegisterId` (20): Format `^[A-Z]{2}-[A-Z0-9_-]+$`.
- `ladeRohdaten(db, companyId)` (25): **30-Tage-Cache** in `openregister_cache` (Migration 15) — Folgeabfragen/Überschneidungen zwischen Vorgängen kosten keine Credits; nicht abrufbar → leere Rohdaten (bricht die Kette sauber ab).
- `ladeVerbundGraph(companyId)` (71): BFS-Treiber — analysieren → fehlende Firmen parallel nachladen (Budget-Kappe an `maxUnternehmen`) → erneut analysieren; terminiert, weil geladene Firmen (auch leer) im Graph landen.

### `src/lib/openregister/actions.ts` (Journey, token-geschützt)
- `openregisterSuche(token, query)` (33): Token-Check → Suche.
- `openregisterVerbund(token, companyId)` (44): Token-Check + ID-Validierung → Graph → Analyse → Audit `openregister_abfrage` (company_id, Beteiligungen, max. Stufe, firmen_geladen, abgeschnitten).

### `src/lib/openregister/public-actions.ts` (Landingpage, öffentlich)
- `clientIp()` (24): `x-forwarded-for` erster Eintrag.
- `openregisterSucheOeffentlich(query)` (33): ≥ 3 Zeichen + **Rate-Limit 20/h pro IP** (kostenpflichtige API!).
- `openregisterVerbundOeffentlich(companyId)` (53): ID-Check + **Rate-Limit 6/h pro IP** + Audit `openregister_abfrage_landingpage` (actor `system`, ohne Vorgangsbezug).

### `src/lib/gemini/angebot-analyse.ts` + `parser.ts`
- `analysiereAngebot(pdf)` (analyse:49): Key-Check → 15-MB-Limit → POST an `gemini-3.6-flash` (inline_data base64, `responseMimeType: json`, temperature 0.1, 60-s-Timeout). Der PROMPT erzwingt: nur **Adressat**-Daten extrahieren, nichts erfinden (null statt Rate), reines JSON. Fehler → konkreter Grund (HTTP-Status + Auszug).
- `parseAngebotAnalyse(roh)` (parser:97): defensiver Parser — Codefences entfernen, JSON.parse, `text`/`betrag` (deutsches Format „1.234,56") /`ganzzahl`/`datum` („12.03.2026" → ISO)/`ustId`-Normalisierer; komplett leere Antwort = kein Ergebnis. Nie Exceptions bei KI-Ausgaben.
- **Human-in-the-loop:** Extraktion ist Rohbefund; der Vertrieb bestätigt die Werte (`extraktion_bestaetigt`) — nichts geht ungesehen an den Kunden.

### `src/lib/webhook.ts`
`loeseWebhookAuf(dbWert, envWert)` (15): **DB-Vorrang** vor `WEBHOOK_URL`, Quelle für Audits. `istGueltigeWebhookUrl` (27): https; http nur localhost/127.0.0.1.

### `src/lib/rate-limit.ts`
`rateLimit(schluessel, max, windowMs)` (31): In-Memory Fixed-Window, `aufraeumen` (19) ab 500 Einträgen. Prozess-lokal = weicher Schutz je Serverless-Instanz (bewusst dokumentiert; Upstash-Wechsel ohne Aufrufer-Änderung möglich). Schützt OpenRegister-Credits vor Missbrauch der Landingpage.

### `src/lib/csv.ts`
`esc` (9): Semikolon-CSV (Excel-DE), Zahlen mit Komma; **Formel-Injektion-Neutralisierung** (CWE-1236): führende `=+-@tab`→ Apostroph-Präfix (OWASP; Anführungszeichen allein genügen nicht), `""`-Escaping. `csvZeile` (21), `baueCsv` (26; UTF-8-BOM, CRLF).

### `src/lib/tracking.ts` (client)
- `getCookie`/`getAllCookies` (53/59), `gaClientId` (71; `_ga`-Parsing `GA1.1.<id>.<ts>`).
- `persistFirstTouch` (82)/`firstTouch` (92): Klick-IDs + UTM beim **ersten** Besuch in localStorage (`mabe_kmu_attr_*`), überleben spätere Seitenaufrufe.
- `firstSeen` (98), `deriveFbc` (109; `_fbc` aus fbclid ableiten, falls Meta-Pixel fehlt).
- `collectTracking()` (116): vollständiger Attribution-Report (7 Klick-IDs, 5 UTM, Meta-Cookies, GA-Client-ID, Geräte-/Browser-Signale, alle Cookies + Query-Params, Roh-Payload).
- `enrichWithFingerprint(data)` (156): FingerprintJS-Visitor-ID + Confidence, dynamisch importiert, best effort.

### `src/lib/consent.ts` (client)
`leseEinwilligung` (35), `speichereEinwilligung` (53; Cookie `mabe_consent` 6 Monate, versioniert — `CONSENT_VERSION`-Bump erzwingt Neuabfrage; `mabe:consent-changed`-Event), `hatEinwilligung(kategorie)` (64; strikt Opt-in), `oeffneConsentEinstellungen` (69), `COOKIE_KATALOG` (95): vollständige Offenlegung aller Speicher (TDDDG § 25) — Consent-Cookie, Session-Token, Fingerprint (Statistik), localStorage-Attribution, `_fbp/_fbc/_ga` (nur gelesen, falls Drittanbieter sie setzt).

---

## 9 · App-Routen & API

### API Route Handlers
| Route | Export | Verhalten |
|---|---|---|
| `POST /api/lead` (route.ts:16) | Node-Runtime | Lead-Annahme: JSON-Parse (400), Webhook-Auflösung (bei DB-Störung trotzdem `ok:true, forwarded:false` — kein Datenverlust), serverseitige Anreicherung (received_at, IP via x-forwarded-for/x-real-ip, Vercel-Geo-Header, UA) → Lead-Mail (best effort) → Webhook-Forward; Webhook-Fail → 502. URL verlässt nie den Server. |
| `GET /api/health` (route.ts:33) | force-dynamic | ENV-Set nur als true/false (inkl. Blob-Store-Name-Fallback) + DB-Ping (5-s-Timeout, Fehlermeldung gekürzt); 200 wenn alles ok, sonst 503 mit Details. Diagnostiziert die IPv6/Pooler-Falle remote. |
| `GET/POST /api/auth/[...all]` | | Better-Auth-Handler; als **benannte** Funktionen exportiert (Next-16/Turbopack erkennt destrukturierte Route-Exports nicht zuverlässig — dokumentierter Workaround). |

### PDF-/Datei-Routen (alle `force-dynamic`, `no-store`)
| Route | Auth | Verhalten |
|---|---|---|
| `GET /v/[token]/angebot.pdf` | Token | Angebots-PDF aus privatem Blob (Quelle: `dokumente(typ angebot_pdf)` → Fallback `angebot_pdf_path`); `?inline=1` für Viewer. |
| `GET /v/[token]/zusammenfassung.pdf` | Token (+ Zugriffsprotokoll, da IBAN/Kontakt enthalten) | Dossier-PDF; **DB-Fehler (500, Retry-Hinweis) vs. „noch nichts eingereicht" (404) sauber getrennt.** |
| `GET /v/[token]/vollmacht-vordruck.pdf` | Token | BAFA-Vordruck aus Journey-Entwurf vorbefüllt, ohne Datum/Signatur (`vordruck: true`). |
| `GET /vorlagen/systemkonzept.pdf` | öffentlich | Universelles Standarddokument aus dem Dateisystem (keine personenbezogenen Daten), 1-h-Public-Cache. |
| `GET /admin/dokument/[id]` | `requireAdmin` | Authentifizierter Proxy in den privaten Blob (Blob-URLs selbst nicht abrufbar). |
| `GET /admin/vorgang/[id]/fallakte` | `requireAdmin` | Fallakte-PDF (inkl. Audit-Report). |
| `GET /admin/vorgang/[id]/signatur` | `requireAdmin` | Gezeichnete Signatur als Bild (1-h private Cache — Signatur ändert sich nie). |
| `GET /admin/export.csv` | `requireAdmin` | Pipeline-CSV (Semikolon/BOM, Formel-Injektion-geschützt); Limit 10 000 bewusst dokumentiert; KMU-Kategorie/Quote/Zuschuss je Vorgang (jüngste Bewertung via Map-First-Wins). |
| `GET /konto/vorgang/[id]/dossier` | `requireKunde` + `angebot_zugriffe` | Eigenes Dossier-PDF. |
| `GET /konto/vorgang/[id]/dokument/[dokId]` | `requireKunde` | 403 ohne Zuordnung; Dokument zusätzlich an den Vorgang verankert (`eq('angebot_id', id)` — kein IDOR). |
| `GET /konto/vorgang/[id]/signatur` | `requireKunde` | Eigene Signatur (403-Prüfung wie oben). |

### Server Components (Auswahl, alle Admin-/Konto-Seiten `force-dynamic` + `robots: noindex`)
- **`/v/[token]/page.tsx` (16):** Token-Validierung → lovingly gestaltete „Link ungültig"-Ansicht; Zugriffsprotokoll (best effort); **Auto-Claim** (eingeloggter Kunde → `verknuepfeZugriff`); Status `eingereicht/abgeschlossen` → Abschluss-Ansicht; sonst Wizard mit `initialDaten` + `startSchritt` aus dem Fortschritt, Kontext-Sidebar (Investition, „Zuschuss bis zu" = 45 % max, Datenschutz-Hinweis) nur auf 2XL.
- **`/admin/(portal)/layout.tsx` (20):** `requireAdmin()` im Layout erzwingt die Session für **alle** Unterseiten; Pill-Navigation, fester Header-Kontakt.
- **`/admin/page.tsx` (40):** KPI-Kacheln (Warnfarbe bei Nachfass-/Wiedervorlagen-Kennzahlen) + VorgaengeListe + CSV-Export-Link.
- **`/admin/kunden/[id]/page.tsx` (19):** Fallakte per Angebots-UUID (**UUID-Format-Check → sauberes 404 statt Postgres-Syntaxfehler**), registriert-Badge, alle Vorgänge der E-Mail mit `VorgangDatenblatt`.
- **`/einladung/[token]/page.tsx` (11):** Token-Validierung → EinladungsForm (Name+Passwort) oder „Link ungültig".
- **`/konto/page.tsx` (13):** `requireKunde` → Vorgangsliste mit `StatusBadge` + Fortschritts-Progressbar (aria-valuenow, 6 Schritte).
- Login/Registrieren/Passwort-Seiten: Auth-Formen (Better-Auth), statisch prerenderbar.
- Root `layout.tsx`/`page.tsx`: Oatmeal-Landingpage mit `KmuCheck` als Hero, Consent-Banner, MABE-Theme; `error.tsx`/`global-error.tsx`/`not-found.tsx` je Ebene mit `FehlerAnzeige`.

---

## 10 · Komponenten

### Journey (`src/components/journey/*`, alle `'use client'`)
| Komponente | Verhalten |
|---|---|
| `wizard.tsx` — `Wizard` (40) | Steuert die Strecke komplett aus `SCHRITTE`: dynamische aktive Schritte (`aktiveSchritteFuer`), Smart Defaults nur für Lücken (rAF-verzögert, kein setState im Effekt), **Sticky-Zuschuss-Chip** (`zuschussChip`, useMemo: bis Daten vorhanden „bis zu 45 %", danach Live-Evaluate mit `holdingsFuerJahr`), Feld-Validierung (`validiereAktuellenSchritt` mit Querabhängigkeit beantragungsweg→vollmacht), Live-Prüfung beim Blur (`validiereFeldLive` — nur gefüllte Felder), `speichern()` per `useTransition` (Server Action), Sprung-Navigation mit Auto-Save, `onAbsenden` (Selbst-Weg → `schliesseSelbstBeantragungAb`, sonst `schliesseJourneyAb` mit schrittweisen Fehlern → Sprung zum ersten fehlerhaften Schritt), Scroll-to-First-Error, mobile Sticky-Actionbar die über dem Consent-Banner wandert, Motivationszeilen (Halbzeit/Zielgerade). `fehlerAusZod` (27): Zod-Issues → Feld-Map. `Erfolg` (437): Konfetti, CountUp-Zuschuss, PDF-Download-Link, „Wie geht es weiter?" je Modus, Konto-Empfehlung. |
| `schritt-kmu.tsx` — `SchrittKmu` (44) | 3-Schritt-Innenstruktur: ① eigene Kennzahlen **fest 2025+2024** (`BAFA_GESCHAEFTSJAHRE` — bewusst nicht kalenderbasiert, richtet sich nach BAFA), ② Leitfrage „Beteiligungen?" (Ja/Nein-Toggle, `hat_beteiligungen`; „Nein" leert Zeilen), Beteiligungs-Karten (Name, Richtung, **Bezug-Dropdown für Folgestufen**, Slider mit `SKALA`-Vertrag, jahresbezogene Kennzahlen je BAFA-Jahr — mobil Stack, ab sm Tabelle), Live-Badge je Karte aus `analysiereVerbund`, **Sticky-Kopf je Karte** (Nummer + Einstufung bleiben beim Scrollen sichtbar), **2-Tap-Löschbestätigung** (3-s-Timeout, 44-px-Hitbox — Mobile-Audit), Warnhinweis wenn das Quote-relevante Jahr einer Beteiligung leer bleibt (Audit: Quote fällt sonst zu hoch aus), ③ `KmuAbleitung` + `KmuAmpel`. `uebernehmeVerbund` (146): Register-Prefill matcht Jahre **nach Geschaeftsjahr** (nicht Index — sonst doppelte React-Keys/doppelte DB-Zeilen). |
| `schritt-vollmacht.tsx` — `SchrittVollmacht` (25) | **Feature-Flag `ONLINE_SIGNATUR_AKTIV = false`** — BAFA verlangt handschriftliche Unterschrift, daher einspurig: Vordruck laden → unterschreiben → hochladen (iframe-Preview desktop, Tab mobil; `?inline=1`). Upload via `ladeVollmachtUploadHoch`, Ersetzen/Entfernen. Systemkonzept-Ansicht + Pflicht-Checkbox (gilt für beide Wege). 4 Bestätigungen (Systemkonzept, Vorhabenbeginn, Wahrheitsgemäß, DSGVO). Canvas-Modus bleibt im Code reaktivierbar. |
| `schritt-deminimis.tsx` — `SchrittDeminimis` (19) | Beihilfen-Tabelle (Geber, Az., Datum, Betrag, Form, Kategorie, Status), Live-Summe gegen `HOECHSTBETRAG = 300_000` (Überschreitungs-Warnung), Fusion/Übernahme/Aufspaltung-Checkboxes, § 264-StGB-Bestätigung. |
| `step-generisch.tsx` — `StepGenerisch` (88) | Rendert rein aus Felddefinitionen. `AUTOCOMPLETE`-Map (23; Browser-Autofill), `bereinige` (45; IBAN-Vierergruppen, Ziffernfilter live), `eingabeModus` (64; Mobil-Tastatur), Erfolgshaken je Feld (ein Schema-Lauf pro Render → Set invalidier Felder), visuelle Gruppen-Chunking, dezenten Shake bei Fehlern. |
| `unternehmen-suche.tsx` (19) | Register-Suche im Schritt „Ihr Unternehmen": `waehlen()` ruft `openregisterVerbund` → schreibt nur **gefundene** Werte (keine Eingaben überschreiben), Personenart aus Rechtsform, `register_id` im Payload (KMU-Schritt lädt dieselbe Firma aus dem Cache — keine Zusatz-Credits). |
| `verbund-suche.tsx` (47) | KMU-Schritt-Panel: Suche + Ergebnis-Preview (EU-Klassen-Badges je Zeile via `euKlasse`), Übernahme-Bestätigung. |
| `register-suche.tsx` (journey:17 / kmu:17) | Autocomplete-Box mit Debounce → `openregisterSuche(Oeffentlich)`; Treffer mit Register-Label. |
| `signatur-pad.tsx` (29) | Canvas-Freihand: Pointer Events (Touch/Maus/Stift, `touch-action: none`, Pointer-Capture), devicePixelRatio-Skalierung (Retina-scharf), geglättete Striche (quadratische Kurven durch Mittelpunkte, coalesced Events), Export als transparentes PNG (max. 350 KB — **zu groß = sichtbare Meldung**, kein stilles Null), Entwurfs-Vorschau nur bis zum ersten eigenen Strich (Audit-Finding „bricht nach 1. Strich ab" gelöst). |
| `ampel.tsx` — `KmuAmpel` (47), `stufeFuer` (36) | Ampel-Visualisierung (kleinst/klein = grün …) + Förderquote + Fördersumme. |
| `kmu-ableitung.tsx` — `KmuAbleitung` (50), `SummenZeile` (20) | Transparente Herleitung der Verbundgröße (Eigen + Partner anteilig + Verbunden 100 % = konsolidiert) mit EU-Zonen-Einordnung. |
| `kmu-zusammenfassung.tsx` (22) | KMU-Ergebnis-Recap im Vollmacht-Schritt. |
| `fortschritt.tsx` (16) | Schritte-Kette (mobil horizontal scrollbar + truncate — Commit 81f18df), klickbar (onSprung), Zuschuss-Chip. |
| `schritt-uebersicht.tsx` (17) | Vorgangs-/Angebots-Übersicht mit Live-Förderquote, Angebots-PDF-Download (`?inline`), Nutzen-Moment. |
| `schritt-beantragungsweg.tsx` (11) | Eingangs-Wahl Concierge (empfohlene Karte) vs. Selbst. |
| `schritt-selbst.tsx` (67) + `PdfRahmen` (21) | Unterlagen-Seite des Selbst-Wegs: Systemkonzept + Angebot zum Download + ELSTER-Zertifikat-Checkliste. |
| `ui.tsx` | `inputCls`/`labelCls`, `Feld` (13; Label/Hilfe/Fehler), `Checkbox` (52). |
| `tooltip.tsx` (21) | ⓘ-Popover mit Viewport-Klemmung (`HALF`/`RAND`). |
| `count-up.tsx` (9) | Animierter Zahlen-Hochlauf (Erfolgs-Moment). |
| `konfetti.tsx` (13) | CSS-basiertes Konfetti, `motion-safe`. |
| `eskalator-block.tsx` (11) | Concierge-Brand-Block. |
| `wz-code-feld.tsx` (14) | WZ-2008-Autocomplete (Destatis-Daten aus `wz2008.ts`). |

### Landingpage-Check (`src/components/kmu/*`)
| Komponente | Verhalten |
|---|---|
| `kmu-check.tsx` — `KmuCheck` (79) | Hero-Wizard (7 Schritte: name → employees → financials → holdingsQuestion → [holdings] → summary → lead). `parseDe` (24; deutsche Zahlformate), `isValidEmail` (39), `newHolding` (57). **Consent-getriebenes Tracking:** `trackingRef` nur nach Opt-in „marketing", Fingerprint zusätzlich nur nach „statistik", live reagierend auf Consent-Änderungen (Zeile 110). `input`/`result`/`zeilen` als useMemo (Live-Evaluation bei jeder Eingabe). `uebernehmeRegister` (167): Register-Prefill (eigene Kennzahlen + Verbund, manuelle Zeilen bleiben). `stepValid` (197) je Schritt, Enter-Handling (`handleFormKeyDown`, 245 — skip in Checkboxen/Suchfeldern), `submit` (262): Payload `kmu_check_lead` inkl. `analysiereVerbund`-Ergebnis je Zeile (`relationship`, `effektivPct`, bezug/stufe/pfad) + `trackingRef` → `POST /api/lead` mit `keepalive` — bei Netzwerkfehler trotzdem Erfolgsanzeige (Lead lokal nicht verlieren). `handlePdf` (331): clientseitiger jsPDF-Nachweis. Teil-Komponenten: `Step` (776), `TrustRow` (799), `ChoiceCard` (819), `InfoBox` (863), `HoldingCard` (878; Slider mit SKALA-Skala, Bezug-Dropdown, Live-Einstufungs-Badge, Register-Herkunftshinweis), `SummaryList` (1085; renderRow statt nested components — React-Compiler-Regel), `SuccessPanel` (1141). |
| `live-evaluation.tsx` — `LiveEvaluation` (80), `MiniBar` (44), `FundingScale` (59) | Zweite Spalte: Live-Kennzahlen gegen die Schwellen, Fortschritts-Balken je Kriterium, Förderquoten-Skala (25/35/45), Kategorie-Badge. |
| `verbund-baum.tsx` (14) | Grafik der Beteiligungskette inkl. Folgestufen + Verrechnungsquoten (nutzt `analysiereVerbund`). |
| `phone-input.tsx` — `PhoneInput` (75), `isoToFlag` (45), `formatNational` (52), `DEFAULT_PHONE` (197) | Länderwahl mit Flagge, nationale Formatierung, E.164-Export, `valid`-Flag. |
| `field.tsx` — `Field` (7; „Warum fragen wir das?"-Kontext), `NumberField` (62) | Standard-Feldbausteine. |
| `hero-background.tsx` (10), `mabe-logo.tsx` (10), `linkedin-icon.tsx` (3) | Deko/Brand. |

### Admin (`src/components/admin/*`)
`AngebotForm` (angebot-form.tsx:37; Gemini-Analyse-Flow: PDF-Upload → Analyse → Vorschau der `ERKANNT_LABEL`-Felder → bestätigen → anlegen → Erfolgsansicht mit Link-Kopie/Einladungs-Versand), `VorgaengeListe` (vorgaenge-liste.tsx:39; clientseitige Suche/Statusfilter/Pagination mit `SEITEN_GROESSEN`, Zeilen-Expand), `VorgangDatenblatt` (vorgang-datenblatt.tsx; vollständiges Datenblatt + `DatenKopierenButton` + Dokumente + Aktionen + Notizen), `VorgangBearbeiten` (vorgang-bearbeiten.tsx:94; Angebots-/Stammdaten-Formulare + `Historie` (60) der Revisionen), `VorgangAktionen` (vorgang-aktionen.tsx:23; Statuswechsel, Widerruf, DSGVO-Löschung mit Angebotsnummern-Bestätigung, Fallakte-Download), `VorgangNotizen` (Notizen + Wiedervorlage), `BenutzerVerwaltung` (benutzer-verwaltung.tsx:21; Einladen/Widerrufen/Rollenwechsel), `KundenListe` (kunden-liste.tsx:34; gruppiert nach E-Mail, Registrierungsstatus), `DokumentUpload` (dokument-upload.tsx:12), `WebhookForm`/`LeadEmpfaengerForm`/`EmailTestButton`/`SystemkonzeptAktionen` (systemkonzept-aktionen.tsx:20; Upload/Vorlagenwahl), `LoginForm` (login-form.tsx:12; `authClient.signIn.email`), `LogoutButton` (logout-button.tsx:8).

### Konto/Consent/Fehler/Einladung
`auth-forms.tsx` (Registrieren/Anmelden/Passwort via `authClient`), `status-badge.tsx` (Status→Farbe), `consent-banner.tsx` (Opt-in-Dialog mit `COOKIE_KATALOG`, Events), `cookie-einstellungen-link.tsx` (Footer-Widerruf), `fehler-anzeige.tsx` (einheitliche Fehler-UI mit `fehlerKennung`), `einladung/form.tsx` (`nehmeEinladungAn`-Form).

### Oatmeal-Template (`elements/`, `sections/`, `icons/`)
Re-skinnte Tailwind-Plus-Primitives/Sektionen der Landingpage (Navbar, Hero, FAQ, Footer, CTA …) — Projekt nutzt davon die in `page.tsx` referenzierten; der Rest ist Template-Bestand (nicht Teil des Builds: `_oatmeal_template/` ist komplett ausgeschlossen). Icons nur in `icons/` pflegen.

---

## 11 · Datenflüsse im Detail

1. **Lead-Flow:** Konsent → Wizard → `POST /api/lead` (Client-Payload + Server-Anreicherung) → Lead-Mail (DB-Empfänger) + Webhook (DB-URL, ENV-Fallback) → Antwort `{ ok, forwarded, reason }`.
2. **Journey-Flow:** Angebots-Anlage (Admin, optional Gemini-Prefill) → Token (90 d, nur Hash) → Einladungs-Mail → `/v/<token>` (Zugriff protokolliert, Auto-Claim) → Schrittweises Auto-Speichern (unvalidierte Drafts) → Abschluss: serverseitige Vollvalidierung → Fachtabellen (mit Admin-Korrektur-Schutz) → Status → **best effort:** Webhook, Bestätigungsmail (+Angebot als Anhang), Systemkonzept, BAFA-Vollmacht + Admin-Mail.
3. **Dokumente:** Alles private Blob-Objekte; Lesezugriff ausschließlich über authentifizierte Proxy-Routen (Admin-Guard / Token / `angebot_zugriffe`), `no-store`.
4. **Audit:** append-only `audit_events` für jede sicherheitsrelevante Aktion (actor `admin:<id>` | `kunde:<token-id>` | `system`); Lösch-Nachweis ohne Vorgangsbezug.

---

## 12 · Beobachtungen & Empfehlungen (Priorität)

**Positiv hervorzuheben:** durchgängiges `server-only`/Trust-Boundary-Denken, UUID-in-URL statt E-Mail, Formel-Injektion-Schutz im CSV, WinAnsi-Sanitizer gegen PDF-Produktionsfehler, Admin-Korrektur-Schutz bei erneutem Kunden-Abschluss, explizite Teilerfolge (Revision fehlgeschlagen ≠ „nichts passiert"), konsistentes Audit-Design, Rate-Limits auf kostenpflichtigen APIs, konsequente Best-Effort-Nachrichten mit sichtbaren Gründen.

1. **[Hinweis] `kontrollSchluss`-Quadratik** (`kmu.ts:178`): BFS läuft für jeden Partner erneut über alle Kanten — bei ≤ 20 Unternehmen irrelevant, bei Skalierung O(K²·E). Erst bei deutlichem Wachstum optimieren.
2. **[Hinweis] Zugriffs-Counts N+1** (`kunden.ts:267`): je Vorgang ein Count-Query, bewusst parallel und klein; ab mehrfach 1000 Vorgängen → `group by` wechseln.
3. **[Hinweis] Rate-Limit in-memory** (`rate-limit.ts`): bei Vercel je Instance — weicher Schutz; für harte Credits-Limits Upstash-Backend einplanen (Schnittstelle bleibt gleich).
4. **[Klein] `ladeVerbundGraph`-Schleife** (`verbund-loader.ts:77`): `maxStufe + 1` Runden-Rekursion ist korrekt aber indirekt; bei Änderungen an KETTEN_LIMITS Testfall für Ketten > 8 Stufen ergänzen.
5. **[Klein] `schliesseJourneyAb` Umfang** (`journey/actions.ts:141`): ~530 Zeilen mit 12 Abschnitten — bewusst sequenziell dokumentiert, aber Kandidat für Aufteilung in Schrittfunktionen bei der nächsten Erweiterung.
6. **[Klein] `vordruck`-Vollmacht lädt Draft-Felder ungeprüft** (`vollmacht-vordruck.pdf/route.ts:30`): Werte aus dem unvalidierten Entwurf fließen in das PDF (kunden-eigene Daten, token-geschützt — vertretbar; finale Vollmacht entsteht erst aus validierten Daten).
7. **[Info] `ONLINE_SIGNATUR_AKTIV = false`** (`schritt-vollmacht.tsx:24`): Canvas-Pfad vollständig erhalten; Reaktivierung = Flag + BAFA-Regelung prüfen.
8. **[Info] Typgenerierung:** `db/types.ts` manuell gepflegt — Supabase-CLI-Generierung wie geplant (Plan M0) einführen, um Drift zu verhindern.

---

## 13 · Addendum: Bewilligungsprozess (Migration 25, 17.11.2026)

**Stationen nach der Einreichung** – Aktivierung: existiert eine `bescheide`-Zeile, sind Durchführungszeitraum & Verwendungsnachweis aktiv (Domänen-Regel, NICHT Status-gebunden – der Kunde soll Fristen schon beim Prüfen der OCR-Werte sehen).

### Neue Dateien
| Datei | Funktion |
|---|---|
| `supabase/schemas/25_bescheid_verwendungsnachweis.sql` | Enum-Erweiterungen (angebot_status + `bewilligt`/`vnw_eingereicht`; dokument_typ + `bescheid`/`vnw_beleg`), neue Enums `vnw_status`/`vnw_beleg_kategorie`, Tabellen `bescheide` (1:1, OCR + Bestätigungsnachweis), `verwendungsnachweise` (1:1, Frist-Snapshot/Sachbericht/Einreichung), `vnw_belege` (n:1, uuid_v7), Trigger, Indizes, RLS + Revoke. |
| `src/lib/bescheid/domain.ts` | OOP-Domäne `NachweisKontext` (unveränderlich, rein): `stationenAktiv`, `bescheidBestaetigt`, `wirksameFrist` (VNW-Snapshot > Bescheid), `frist` (Ampel: ungefasst/ok/knapp ab 28 T./überfällig/eingereicht), `durchfuehrungszeitraum`, `belegSummeEur`, `darfEinreichen`, `fehlendeBausteine`. Kein Frist-Default – nichts geraten. |
| `src/lib/bescheid/actions.ts` | 8 Server Actions (alle über `fordereVorgangZugriff`: Admin-Rollen ∨ `angebot_zugriffe`): `ladeBescheidHoch` (Magic-Bytes→Blob→OCR best effort→dokumente/VNW-lazy, KEIN Statuswechsel), `bestaetigeBescheidDaten` (Human-in-the-loop → Status `bewilligt`), `speichereZeitraum`, `ladeBelegHoch`, `entferneBeleg`, `speichereVnwSachbericht`, `reicheVerwendungsnachweisEin` (Gates aus der Domäne, Status `vnw_eingereicht`). |
| `src/lib/bescheid/status-helfer.ts` | `wechsleStatusMitProtokoll`: Statusmaschine + Revision + Audit als wiederverwendbare Bibliotheksfunktion; blockierte Wechsel werden auditiert (`statuswechsel_blockiert`). |
| `src/lib/db/repositories/bescheid.ts` | DAL (server-only): Bundle-Lese (Bescheid + neuestes Dokument), VNW/Belege-Lese, `vermerkeBescheidUpload` (idempotent), `speichereBescheidDaten` (Bestätigung wer/wann), `stelleVnwSicher` (lazy + Frist-Snapshot-Nachzug), `speichereZeitraumUndFrist` (Bescheid UND VNW-Snapshot), Beleg-CRUD, `markiereVnwEingereicht`. |
| `src/lib/gemini/client.ts` | Generischer Gemini-REST-Call (PDF inline, JSON erzwungen) — jetzt geteilt von Angebot- und Bescheid-Analyse (DRY-Refactor, angebot-analyse.test.ts bleibt grün und sichert den Vertrag). |
| `src/lib/gemini/bescheid-analyse.ts` + `bescheid-parser.ts` | OCR-Prompt (Frist-Suchwörter „Verwendungsnachweis/vorzulegen/Vorlagefrist", Monatsfrist→Datum ab Zeitraumende) + defensiver Parser (Quote-Whitelist 25/35/45, Listen-Dedup/max 20, Codefence-Handling, leere Antwort = kein Ergebnis). |
| `src/components/bescheid/drag-drop.tsx` | Wiederverwendbare Drag&Drop-Zone (client): Drag+Klick+Tastatur, clientseitige Größenvorprüfung, ARIA-Rollen, `kompakt`-Variante. |
| `src/components/bescheid/bescheid-manager.tsx` / `nachweis-manager.tsx` | Die beiden Stationen als Client-Komponenten (modusunabhängig — Kunde & Admin nutzen dieselben Actions; `downloadBasis`-Prop steuert die Proxy-Route). Nachweis: Frist-Ampel, Beleg-Liste mit Kategorie/Betrag/Entfernen, Sachbericht, Einreichungs-Gates. |
| `src/app/konto/vorgang/[id]/bescheid/page.tsx` / `nachweis/page.tsx` | CLEAN-Pages (Zugriff via `angebot_zugriffe`); Nachweis-Seite rendert ohne Bescheid eine Hinweiskarte mit Link (kein totes Formular). |
| `src/components/admin/bescheid-verwaltung.tsx` | Admin-Fallakte-Sektion: Kacheln (Bescheid/Frist/VNW) + `<details>`-Stationen mit denselben Managern (Downloads über `/admin/dokument`). |

### Geänderte Stellen (Auswirkungs-Analyse, keine Daten gelöscht)
`types.ts` (AngebotStatus + Rows), `labels.ts` (Status/Dokument/VNW-Labels), `admin/status.ts` (Maschine: `eingereicht→bewilligt`, `abgeschlossen→bewilligt`, `bewilligt→vnw_eingereicht`↔), `db-verify.mjs` (17 Tabellen, uuid_v7 10, neue Positiv-/Negativ-Smokes, Rechte-Check `bescheide`), `kunden.ts` (Vollauszug + bescheid/vnw/vnwBelege), `konto.ts` (`eingereicht`-Checks erweitert), `dashboard.ts` (proStatus + offen-Filter: `vnw_eingereicht` gilt als fertig), `vorgang-datenblatt.tsx` (STATUS_CLS + neue Sektion), `vorgaenge-liste.tsx`/`kunden-liste.tsx`/`status-badge.tsx` (Records), `konto/vorgang/[id]/page.tsx` (Nav-Karten mit Aktivierungs-/Frist-Status), `gemini/angebot-analyse.ts` (nutzt jetzt generischen client.ts).

### Tests (je Feature)
`bescheid/domain.test.ts` (17 Tests: Frist-Mathe, Ampel-Grenzen, Aktivierung, Gates, Zeitzonen), `gemini/bescheid-parser.test.ts` (8), `gemini/bescheid-analyse.test.ts` (5, fetch-stub wie angebot-Suite), `admin/status.test.ts` (NEU, 7 – Maschine inkl. Migration 25), bestehende `security.test.ts`-Erwartung aktualisiert (dokumentierter Maschinen-Umbau).

**Ausstehend (benötigt DATABASE_URL/.env.local):** `node scripts/db-apply.mjs` → `node scripts/db-verify.mjs` gegen die Live-DB.
