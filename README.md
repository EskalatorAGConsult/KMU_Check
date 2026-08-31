# MABE KMU-Fördercheck

Interaktive, mehrstufige Landingpage für die **MABE Maschinen- und Behälterbau GmbH**, mit der
Unternehmen live prüfen, ob sie als **KMU nach EU-Empfehlung 2003/361/EG** gelten und welche
**Förderquote im BAFA Modul 3** (45 % / 35 % / 25 %) für sie möglich ist – inklusive korrekter
Verbund-Verrechnung, PDF-Nachweis und Webhook-Lead-Übergabe.

Aufgebaut auf dem **Tailwind Plus „Oatmeal“**-Template (Next.js 16, React 19, Tailwind CSS v4),
re-skinnt auf die MABE-CI (Navy + Türkis, reiner White-Mode, WCAG-konforme Kontraste).

## Schnellstart

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Funktionsumfang

- **Mehrstufiger KMU-Check** (neuropsychologische UX: Micro-Commitments, „Warum fragen wir das?“-
  Erklärungen je Feld, klarer Fortschritt) als Hero-Element.
- **Live-Auswertung** in der zweiten Spalte: KMU-Status, konsolidierte (fiktive) Verbundwerte und
  Förderquoten-Skala aktualisieren sich in Echtzeit.
- **Verbund-Logik**: Partnerunternehmen (25–50 %) anteilig, verbundene Unternehmen (> 50 %) zu 100 %,
  Beteiligungen in beide Richtungen.
- **High-End-Lead-Formular**: Pflichtfeld-Validierung, E-Mail-Validierung, Telefon-Eingabe mit
  Länderflagge/Vorwahl, DSGVO-Einwilligung.
- **PDF-Nachweis** (clientseitig via jsPDF), gebrandet.
- **Tracking/Attribution → Webhook**: gclid/gbraid/wbraid, fbclid + `_fbp`/`_fbc`, msclkid, ttclid,
  li_fat_id, UTM, GA-Client-ID, alle Cookies, alle Query-Parameter, Geräte-/Browser-Signale und
  **FingerprintJS**-Visitor-ID – als JSON an den Webhook.

## Konfiguration: `WEBHOOK_URL`

Die Lead-Daten werden **serverseitig** über `src/app/api/lead/route.ts` an den Webhook
weitergeleitet. Die Ziel-URL wird ausschließlich aus der Umgebungsvariable gelesen und nie an den
Client ausgeliefert:

```
WEBHOOK_URL = https://… (z. B. Make / Zapier / n8n / CRM-Endpoint)
```

In **Vercel**: Project → Settings → Environment Variables → `WEBHOOK_URL` anlegen (Production +
Preview). Ohne gesetzte Variable nimmt die Seite den Lead an, protokolliert aber, dass keine
Weiterleitung erfolgte (kein Datenverlust für den Nutzer).

## Konfiguration: Förderportal (Supabase / Better Auth)

Für das Portal (`/admin`, `/v/[token]`) müssen in Vercel zusätzlich gesetzt sein
(Production + Preview, danach **Redeploy**):

```
NEXT_PUBLIC_SUPABASE_URL      = https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY     = sb_secret_…           (nur serverseitig)
DATABASE_URL                  = postgresql://postgres.<projekt-ref>:<passwort>@aws-1-<region>.pooler.supabase.com:5432/postgres
BETTER_AUTH_SECRET            = <zufaelliges Secret>
BETTER_AUTH_URL               = https://foerdercheck.mabe.de   (echte Domain, kein localhost!)
NEXT_PUBLIC_APP_URL           = https://foerdercheck.mabe.de   (Basis fuer Links in E-Mails)
GEMINI_API_KEY                = …
OPENREGISTER_API_KEY          = sk_live_…
RESEND_API_KEY                = re_…                         (E-Mail-Versand, best effort)
EMAIL_FROM                    = MABE Förderportal <mabe@automatisieren.io>
BLOB_READ_WRITE_TOKEN         = vercel_blob_rw_…               (Vercel Blob, Dokumenten-Storage)
```

**E-Mail (Resend):** Ohne `RESEND_API_KEY` werden E-Mails still übersprungen (nur geloggt) –
Einladung, Eingangsbestätigung, Passwort-Reset und Willkommens-Mail blockieren nie den Fachprozess.
Die Absender-Domain (`EMAIL_FROM`) muss in Resend verifiziert sein. Notification-Funktionen liegen in
`src/lib/email/notify.ts` (Einladung, Eingangsbestätigung, Passwort-Reset, Willkommen, Status-Update).

**Systemkonzept (Vercel Blob):** Nach der Einreichung generiert `src/lib/systemkonzept/generate.ts`
(pdf-lib) automatisch das MABE-Standard-Systemkonzept für BAFA Modul 3 aus Angebot + Stammdaten +
KMU-Ergebnis (Datenerfassungsplan nach DIN EN ISO 50015, Wirkplan-Abschnitt bei Steuerungstechnik,
PDCA/3-Jahre-Speicherung nach DIN EN ISO 50001). Das PDF wird in Vercel Blob abgelegt
(`src/lib/storage/blob.ts`) und in `dokumente` (Typ `systemkonzept`) referenziert; der Kunde sieht es
auf der Vorgangsseite unter „Das reichen wir für Sie ein" mit Download-Link. Ohne
`BLOB_READ_WRITE_TOKEN` wird der Upload still übersprungen (Warnung im Log, Audit-Eintrag
`systemkonzept_generiert { ok: false }`) – Token anlegen unter Vercel → Storage → Blob.

**Kundenkonto (`/konto`):** Kunden können sich öffentlich registrieren (Better-Auth-Rolle `kunde`).
Öffnet ein eingeloggter Kunde seinen Journey-Link, wird der Vorgang automatisch seinem Konto
zugeordnet (Tabelle `angebot_zugriffe`). Das Dashboard zeigt Status, Bearbeitungsstand und – nach
Einreichung – alle eingereichten Angaben plus vollständige Datenübersicht als PDF-Download
(`/konto/vorgang/[id]/dossier`, generiert on demand, nur eigene Vorgänge). Vertriebsrollen
(`admin`/`vertrieb`) werden weiterhin nur serverseitig vergeben.

**Admin (`/admin`):** Neben Vorgängen und Angebot-Anlage gibt es die **Kundenverwaltung**
(`/admin/kunden`, gruppiert nach E-Mail, mit Registrierungsstatus, KMU-Ergebnis, Dokumenten und den
Aktionen „Einladung erneut senden" und „Vorgang widerrufen"), die **Benutzerverwaltung**
(`/admin/benutzer`, Einladungslinks für Teamkonten – Rollen `admin`/`eskalator`/`vertrieb`, 14 Tage
gültig, einmalig einlösbar, Annahme unter `/einladung/[token]` mit Name + Passwort; Rollenänderung und
Deaktivierung bestehender Konten, eigene Rolle ist gesperrt) sowie die **Einstellungen**
(`/admin/einstellungen`): Dort kann die Webhook-URL individuell gesetzt werden (Tabelle
`einstellungen`, DB-Wert hat Vorrang vor dem ENV-Fallback `WEBHOOK_URL`, Test-Ping inklusive).
Auflösung in `src/lib/webhook.ts`, genutzt von `api/lead` und der Journey-Übergabe.
Rollenkonzept: `admin` (MABE) und `eskalator` (Eskalator AG) haben gleiche Admin-Rechte,
`vertrieb` ebenfalls Admin-Zugang, `kunde` nur `/konto`, `deaktiviert` gar keinen Zugang.

**Vollmacht (BAFA eew_vm_3):** Im Vollmacht-Schritt wird der offizielle Wortlaut des BAFA-Formulars
eew_vm_3 (§ 14 VwVfG, inkl. Datenschutzerklärung) angezeigt. Bei Beantragung durch die Eskalator AG
wird das offizielle AcroForm-PDF (`docs/vorlagen/eew_formular_eew_vm_3.pdf`) beim Abschluss automatisch
mit den Kundendaten ausgefüllt, flachgerechnet und als Dokument `vollmacht` abgelegt
(`src/lib/vollmacht/fuelle-vollmacht.ts`). Die Bevollmächtigten-Adresse liegt zentral in
`src/lib/vollmacht/bevollmaechtigter.ts` (TODO: Adresse der Eskalator AG final bestätigen).

**Handelsregister-Abfrage (OpenRegister):** Im KMU-Schritt kann der Kunde sein Unternehmen im
offiziellen Handelsregister suchen (Autocomplete). Nach der Auswahl lädt das Portal Gesellschafter
(Owners), Beteiligungen (Holdings) und die veröffentlichten Finanzkennzahlen (Beschäftigte, Umsatz,
Bilanzsumme aus dem Bundesanzeiger) und befüllt auf Knopfdruck Geschäftsjahre und Verbund vor –
inkl. EU-Klassifizierung jeder Beteiligung (< 25 % irrelevant, 25–50 % Partner, > 50 % verbunden)
und Markierung der Zeilen mit `quelle = 'openregister'`. Die Verbundabfrage durchsucht die
**Beteiligungskette rekursiv über beliebig viele Stufen** (BFS, zyklenfest): Verbundene
Unternehmen (> 50 %) wirken transitiv, Partner (25–50 %) nur direkt – aber mit einem Partner
verbundene Unternehmen zählen wieder zu 100 %. Jede Folgestufe wird in der UI mit Stufen-Badge
und Kettenerläuterung („X hält 80 % an Y GmbH") gezeigt. Sicherheitslimits: max. 20 Unternehmen /
8 Stufen (`KETTEN_LIMITS` in `mapping.ts`), bei Abbruch erscheint ein Hinweis. Alles bleibt
editierbar; der Kunde prüft und bestätigt. Aufbau: `src/lib/openregister/client.ts` (server-only
REST-Client, best effort → `null` bei Fehlern), `mapping.ts` (reine Funktionen: Cent→Euro,
`analysiereVerbundKette` als zyklenfester BFS, getestet in `mapping.test.ts`), `actions.ts`
(token-validierte Server Actions, Audit `openregister_abfrage`). Weil jeder Abruf API-Credits
kostet (Suche 1, Rohdaten je Firma ~30), werden die Rohdaten jeder Firma 30 Tage in
`openregister_cache` (Migration 15) gecacht – Folgeabfragen und Ketten-Überschneidungen zwischen
Vorgängen kosten dann nichts. Ohne `OPENREGISTER_API_KEY` läuft die Journey mit manueller
Eingabe unverändert weiter. Der Live-Integrationstest
(`src/lib/openregister/actions.integration.test.ts`) läuft nur mit `RUN_LIVE_TESTS=1`
(kostet echte Credits).

**KMU-Geschäftsjahre:** Der KMU-Schritt fragt dynamisch die letzten **zwei** abgeschlossenen
Geschäftsjahre ab (nicht fest 2024/2025 wie das n8n-Formular); bewertet und gespeichert wird je Jahr,
die Förderquote ergibt sich aus dem jüngsten Jahr.

**IDs (UUIDv7, RFC 9562):** Alle eigenen ID-Spalten erzeugen seit Migration 14 **UUIDv7**
(`uuid_v7()` in `supabase/schemas/14_uuid_v7.sql` – Postgres 17 hat noch kein natives `uuidv7()`,
ab PG18 austauschbar): zeit-sortiert, B-Tree-freundlich, gleiches 16-Byte-`uuid`-Format wie bisher.
Bestehende Zeilen behalten ihre v4-IDs (gemischt ist gültig). `audit_events.id` bleibt bewusst
`bigint identity` (append-only, bereits streng monoton). Better-Auth-IDs (`user.id`, nanoid) und die
Journey-/Einladungs-Token (base64url-Geheimnisse, keine IDs) bleiben unverändert; in URLs auftauchende
UUIDs (z. B. `/konto/vorgang/[id]`) sind Format-kompatibel.

**Tests:** `npm test` (Vitest) prüft die KMU-Engine gegen die EU-Schwellenwerte, die
Webhook-Auflösung und beide PDF-Generatoren. `scripts/db-verify.mjs` verifiziert das Schema
(Tabellen, RLS, FK-Indizes, Constraints, Rechte) – nach Schema-Änderungen beides laufen lassen.

**Wichtig (IPv4/IPv6-Falle):** Der Supabase-Direkt-Host `db.<projekt>.supabase.co` hat nur
einen **IPv6**-Eintrag. Vercel-Functions können IPv6-only-Hosts nicht erreichen → Login/API
liefern HTTP 500. Auf Vercel daher **immer den Pooler-Host** (`aws-1-<region>.pooler.supabase.com`,
Session-Mode Port 5432, User `postgres.<projekt-ref>`) verwenden. Lokal (Mac mit IPv6) funktioniert
auch der Direkt-Host.

### Webhook-Payload (Auszug)

```jsonc
{
  "type": "kmu_check_lead",
  "company":   { "name", "employees", "turnover", "balanceSheet" },
  "holdings":  [ { "name", "direction", "sharePct", "relationship", "employees", "turnover", "balanceSheet" } ],
  "result":    { "category", "categoryLabel", "isKmu", "fundingRatePct", "consolidated", "own", "partnerContribution", "linkedContribution" },
  "lead":      { "salutation", "firstName", "lastName", "position", "email", "phone", "phoneCountry", "consent" },
  "tracking":  { "gclid", "fbclid", "fbp", "fbc", "utm_*", "ga_client_id", "fingerprint_visitor_id", "all_cookies", "all_query_params", … },
  "server":    { "received_at", "ip", "country", "region", "city", "user_agent" }
}
```

## KMU-Berechnung – Methodik & Quellen

Die Logik in `src/lib/kmu.ts` folgt der **EU-Empfehlung 2003/361/EG** und wurde gegen die offiziellen
Quellen geprüft (9/9 Edge-Case-Tests bestanden):

| Kategorie | Beschäftigte (JAE) | Umsatz/Jahr | Bilanzsumme |
|-----------|--------------------|-------------|-------------|
| Kleinst   | < 10               | ≤ 2 Mio. €  | ≤ 2 Mio. €  |
| Klein     | < 50               | ≤ 10 Mio. € | ≤ 10 Mio. € |
| Mittel    | < 250              | ≤ 50 Mio. € | ≤ 43 Mio. € |
| Großunternehmen (kein KMU) | ab den o. g. Grenzen | | |

- Die **Mitarbeiterzahl (JAE/AWU) ist bindend** (strikt „kleiner als“); beim Finanzkriterium genügt das
  Einhalten von **Umsatz ODER Bilanzsumme** („and/or“).
- **Partnerunternehmen (25–50 %)**: anteilige Zurechnung. **Verbundene Unternehmen (> 50 % / Kontrolle)**:
  100 %. Beteiligungen **< 25 %** bleiben unberücksichtigt.
- **Förderquote BAFA Modul 3**: kleine/kleinst 45 %, mittlere 35 %, ohne KMU-Status 25 % der
  förderfähigen Investitionskosten.
- Hinweis auf die **Zwei-Jahres-Regel** (Statuswechsel erst bei Über-/Unterschreiten in zwei
  aufeinanderfolgenden Geschäftsjahren) ist in der UX integriert.

Quellen:
- Europäische Kommission – SME definition: <https://single-market-economy.ec.europa.eu/smes/sme-fundamentals/sme-definition_en>
- EUR-Lex 32003H0361 (Empfehlung 2003/361/EG): <https://eur-lex.europa.eu/eli/reco/2003/361/oj/eng>
- EUR-Lex Zusammenfassung „Micro-, small- and medium-sized enterprises: definition and scope“:
  <https://eur-lex.europa.eu/EN/legal-content/summary/micro-small-and-medium-sized-enterprises-definition-and-scope.html>
- IfM Bonn – KMU-Definition der EU-Kommission: <https://www.ifm-bonn.org/en/definitions/uebersetzen-nach-english-kmu-definition-der-eu-kommission>

> Der Check ist eine unverbindliche Orientierung und ersetzt keine steuer-/förderrechtliche Beratung
> oder die Prüfung durch die Bewilligungsbehörde.

## Projektstruktur

```
src/
  app/
    layout.tsx            Navbar, Footer, Fonts, MABE-CI
    page.tsx              Landingpage (Hero + KMU-Check + Sektionen)
    globals.css           MABE-Theme (Navy/Türkis), erzwungener White-Mode
    api/lead/route.ts     Serverseitige Webhook-Weiterleitung (WEBHOOK_URL)
  components/
    kmu/                  KMU-Check, Live-Auswertung, Phone-Input, Logo, Hero-BG
    elements/ · sections/ · icons/   Oatmeal-Komponenten (re-skinnt)
  lib/
    kmu.ts                EU-KMU-Berechnung + Förderquote
    tracking.ts           Attribution, Cookies, FingerprintJS
    pdf.ts                Gebrandeter PDF-Nachweis (jsPDF)
```

Das ursprüngliche Template liegt unverändert unter `_oatmeal_template/` (nicht Teil des Builds).
