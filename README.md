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
