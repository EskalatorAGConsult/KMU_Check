import { ButtonLink, PlainButtonLink } from '@/components/elements/button'
import { Container } from '@/components/elements/container'
import { ChevronIcon } from '@/components/icons/chevron-icon'
import { HeroBackground } from '@/components/kmu/hero-background'
import { KmuCheck } from '@/components/kmu/kmu-check'
import { FAQsTwoColumnAccordion, Faq } from '@/components/sections/faqs-two-column-accordion'

/*
 * Landingpage, Hallmark-Redesign (full, 2026-11-17): Die Seite ist ein
 * Werkstatttisch. Der KMU-Check ist das Werkzeug, der erste Bildschirm
 * zeigt ihn; alles darunter ist Fachmaterial in ruhiger Typografie:
 * linksbündige Köpfe, ein einziges dunkles Band, Haarlinien statt Kartons,
 * keine Eyebrow-Stempel, kein Gradient, keine Icon-Plättchen.
 * Verdrahtung (Anker, FAQ-IDs, Links, Komponenten) unverändert.
 */

export default function Page() {
  return (
    <>
      {/* ============================== HERO (Ledge) ============================== */}
      <section id="hero" className="relative py-12 sm:py-16">
        <HeroBackground />
        <Container className="relative flex flex-col gap-10 sm:gap-12">
          <div className="flex max-w-3xl flex-col items-start gap-6 text-left">
            <h1 className="min-w-0 font-display text-4xl/tight font-semibold tracking-tight text-balance break-words text-mabe-950 sm:text-5xl/tight lg:text-6xl/tight">
              Ihr KMU-Status in drei Minuten.
            </h1>
            <p className="max-w-xl text-pretty text-lg/8 text-olive-700">
              Nach EU-Definition geprüft, mit Verbundrechnung, als PDF-Nachweis für jeden Antrag nutzbar.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="#kmu-check" size="lg" className="min-w-0 min-h-12 px-6 text-base break-words focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90">
                Jetzt prüfen
              </ButtonLink>
              <PlainButtonLink href="#ablauf" size="lg" className="min-w-0 min-h-12 px-2 text-base break-words focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90">
                So funktioniert es
              </PlainButtonLink>
            </div>
            <p className="text-sm/6 text-olive-500">
              Berechnet nach EU-Empfehlung 2003/361/EG. Kostenlos, ohne Anmeldung.
            </p>
          </div>

          {/* Der mehrstufige KMU-Check ist das Werkzeug und die Signatur der Seite. */}
          <KmuCheck />
        </Container>
      </section>

      {/* ============================ VORTEILE ============================ */}
      <section id="vorteile" className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10 sm:gap-12">
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 className="min-w-0 font-display text-3xl/tight font-semibold tracking-tight text-balance break-words text-mabe-950 sm:text-4xl/tight">
              Förderfähigkeit verstehen, bevor Sie investieren.
            </h2>
            <p className="text-pretty text-base/7 text-olive-700">
              Als Hersteller von Druckluftbehältern und Anbieter von MABE SMART CONTROL kennen wir die
              Energieeffizienz-Förderung aus der Praxis. Diesen Check haben wir gebaut, damit Sie Ihre Förderquote
              kennen, bevor Sie über eine neue Anlage entscheiden.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-x-12 border-t border-olive-200 md:grid-cols-2">
            {[
              {
                title: 'Fachlich korrekt nach EU-Definition',
                desc: 'Mitarbeiterzahl (JAE), Umsatz und Bilanzsumme nach Empfehlung 2003/361/EG, mit den exakten Schwellenwerten für Kleinst-, Klein- und Mittelunternehmen.',
              },
              {
                title: 'Verbund live verrechnet',
                desc: 'Partnerunternehmen (25–50&nbsp;%) anteilig, verbundene Unternehmen (über 50&nbsp;%) zu 100&nbsp;%. Wir bilden Ihre fiktive Unternehmensgröße in Echtzeit ab.',
              },
              {
                title: 'Förderquote sofort sichtbar',
                desc: 'Kleine Unternehmen 45&nbsp;%, mittlere 35&nbsp;%, ohne KMU-Status 25&nbsp;%, bezogen auf die förderfähigen Investitionskosten. Live auf einer klaren Skala.',
              },
              {
                title: 'PDF-Nachweis für jeden Antrag',
                desc: 'Ihr Ergebnis als sauberer, nachvollziehbarer Nachweis, nutzbar für BAFA Modul 3 und viele weitere Programme von KfW und Ländern.',
              },
              {
                title: 'Datenschutz & Diskretion',
                desc: 'Ihre Angaben werden verschlüsselt übertragen und ausschließlich für Ihre Auswertung und Beratung genutzt. Keine Weitergabe an Dritte.',
              },
              {
                title: 'In 3 Minuten erledigt',
                desc: 'Mehrstufig, mit Erklärung zu jeder Kennzahl. Kein Fachjargon, keine Anmeldung, einfach Schritt für Schritt zum Ergebnis.',
              },
            ].map((f) => (
              <div key={f.title} className="flex flex-col gap-2 border-b border-olive-200 py-6">
                <dt className="text-base font-semibold text-mabe-950">{f.title}</dt>
                <dd className="text-sm/7 text-olive-700">{f.desc}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* =========================== FÖRDERQUOTEN (einziges dunkles Band) =========================== */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="bg-mabe-950 px-6 py-12 sm:px-12 sm:py-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="min-w-0 font-display text-3xl/tight font-semibold tracking-tight text-balance break-words text-white sm:text-4xl/tight">
                Bis zu 45&nbsp;% Zuschuss, je nach Unternehmensgröße.
              </h2>
              <p className="text-pretty text-base/7 text-olive-300">
                Die Höhe der Förderung bezogen auf die förderfähigen Investitionskosten hängt direkt von Ihrem
                KMU-Status ab. Genau deshalb lohnt sich die korrekte Einstufung.
              </p>
            </div>
            <dl className="mt-10 grid grid-cols-1 gap-8 border-t border-white/15 pt-10 sm:grid-cols-3 sm:gap-6">
              {[
                { rate: '45 %', label: 'Kleine Unternehmen', sub: 'inkl. Kleinstunternehmen', aktiv: true },
                { rate: '35 %', label: 'Mittlere Unternehmen', sub: 'bis < 250 JAE', aktiv: false },
                { rate: '25 %', label: 'Ohne KMU-Status', sub: 'Großunternehmen', aktiv: false },
              ].map((q) => (
                <div key={q.rate} className="flex flex-col gap-2">
                  <dd
                    className={`font-display text-6xl font-semibold tracking-tight tabular-nums ${
                      q.aktiv ? 'text-teal-400' : 'text-white'
                    }`}
                  >
                    {q.rate}
                  </dd>
                  <dt className="text-base font-semibold text-white">{q.label}</dt>
                  <p className="text-sm/6 text-olive-400">{q.sub}</p>
                </div>
              ))}
            </dl>
            <div className="mt-10">
              <ButtonLink href="#kmu-check" color="light" size="lg" className="min-w-0 min-h-12 px-6 text-base break-words focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90">
                Meine Förderquote prüfen
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================== ABLAUF ============================== */}
      <section id="ablauf" className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10 sm:gap-12">
          <div className="flex max-w-2xl flex-col gap-4">
            <h2
              className="min-w-0 font-display text-3xl/tight font-semibold tracking-tight text-balance text-mabe-950 sm:text-4xl/tight"
              style={{ overflowWrap: 'break-word', minWidth: 0 }}
            >
              So funktioniert es
            </h2>
            <p className="text-pretty text-base/7 text-olive-700">
              Vier Schritte, zwischendurch automatisch gespeichert, am Ende ein belastbares Ergebnis.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '01', t: 'Unternehmen erfassen', d: 'Name, Jahresarbeitseinheiten und Finanzkennzahlen, verständlich erklärt.' },
              { n: '02', t: 'Verbund abbilden', d: 'Beteiligungen ab 25 % erfassen. Wir rechnen Partner anteilig und verbundene zu 100 % zu.' },
              { n: '03', t: 'Live-Ergebnis sehen', d: 'KMU-Status und mögliche Förderquote erscheinen sofort und nachvollziehbar.' },
              { n: '04', t: 'Nachweis sichern', d: 'PDF herunterladen und kostenlose Förder-Ersteinschätzung von MABE erhalten.' },
            ].map((s) => (
              <li key={s.n} className="flex flex-col gap-3 border-t border-olive-300 pt-5">
                <span aria-hidden className="font-display text-5xl font-semibold tracking-tight text-olive-200 tabular-nums">
                  {s.n}
                </span>
                <h3 className="text-base font-semibold text-mabe-950">{s.t}</h3>
                <p className="text-sm/7 text-olive-700">{s.d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ===================== WAS VIELE VERGESSEN ===================== */}
      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10 sm:gap-12">
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 className="min-w-0 font-display text-3xl/tight font-semibold tracking-tight text-balance break-words text-mabe-950 sm:text-4xl/tight">
              Was bei der KMU-Prüfung oft übersehen wird.
            </h2>
            <p className="text-pretty text-base/7 text-olive-700">
              Genau an diesen Punkten scheitern Anträge oder Unternehmen verschenken Förderquote. Unser Check
              berücksichtigt sie automatisch.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-x-12 border-t border-olive-200 md:grid-cols-2">
            {[
              ['Beteiligungen in beide Richtungen', 'Nicht nur Ihre Töchter zählen, auch Anteile, die jemand an Ihnen hält (Mütter, Investoren), fließen ein.'],
              ['Die Zwei-Jahres-Regel', 'Ein Statuswechsel greift erst, wenn ein Schwellenwert in zwei aufeinanderfolgenden Geschäftsjahren über- oder unterschritten wird.'],
              ['Verbund über natürliche Personen', 'Hält eine Person (oder Familie) Anteile an mehreren Firmen im selben Markt, können diese als verbunden gelten.'],
              ['Öffentliche Beteiligungen ab 25 %', 'Halten öffentliche Stellen 25 % oder mehr, entfällt der KMU-Status in der Regel, mit eng definierten Ausnahmen.'],
              ['Umsatz ODER Bilanzsumme', 'Beim Finanzkriterium genügt das Einhalten eines der beiden Werte. Das wird häufig zu streng ausgelegt.'],
              ['Neugründungen & Schätzungen', 'Ohne abgeschlossenes Geschäftsjahr zählt eine plausible Schätzung nach Treu und Glauben.'],
            ].map(([t, d]) => (
              <li key={t} className="flex flex-col gap-2 border-b border-olive-200 py-6">
                <h3 className="text-base font-semibold text-mabe-950">{t}</h3>
                <p className="text-sm/7 text-olive-700">{d}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ===================== WARUM KORREKT (Tabelle) ===================== */}
      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 className="min-w-0 font-display text-3xl/tight font-semibold tracking-tight text-balance break-words text-mabe-950 sm:text-4xl/tight">
              Warum die Einstufung stimmen muss.
            </h2>
            <p className="text-pretty text-base/7 text-olive-700">
              Die KMU-Einstufung ist kein Detail, sondern die Grundlage Ihrer gesamten Förderung. Schon kleine
              Fehler entscheiden über Förderhöhe, Bewilligung und im schlimmsten Fall über eine Rückforderung.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-olive-300">
                  <th className="py-3 pr-6 text-xs font-semibold text-olive-500">Aspekt</th>
                  <th className="py-3 pr-6 text-xs font-semibold text-teal-700">Bei korrekter Einstufung</th>
                  <th className="py-3 text-xs font-semibold text-olive-500">Risiko bei falscher Angabe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-200">
                {[
                  [
                    'Förderquote',
                    '45 / 35 / 25 % exakt bestimmt. Der maximal mögliche Zuschuss wird ausgeschöpft.',
                    'Zu niedrig beantragt (Geld verschenkt) oder zu hoch, mit späterer Kürzung.',
                  ],
                  [
                    'Verbundbetrachtung',
                    'Partner- und verbundene Unternehmen sind vollständig berücksichtigt.',
                    'Übersehener Verbund führt zum nachträglichen Verlust des KMU-Status.',
                  ],
                  [
                    'Bewilligung',
                    'Saubere, nachvollziehbare Nachweise beschleunigen die Zusage.',
                    'Unstimmigkeiten lösen Rückfragen, Verzögerung oder Ablehnung aus.',
                  ],
                  [
                    'Rechtssicherheit',
                    'Korrekte Angaben schützen vor Rückforderung.',
                    'Falschangaben können Rückzahlung und Subventionsbetrug (§ 264 StGB) bedeuten.',
                  ],
                  [
                    'Mehrfachnutzung',
                    'Ein belastbarer Nachweis ist für BAFA, KfW und Länderprogramme nutzbar.',
                    'Ein Fehler in der Einstufung wiederholt sich über alle Anträge hinweg.',
                  ],
                ].map(([aspect, ok, risk]) => (
                  <tr key={aspect} className="align-top">
                    <td className="py-4 pr-6 font-semibold text-mabe-950">{aspect}</td>
                    <td className="py-4 pr-6 text-olive-700">
                      <span className="flex gap-2">
                        <svg
                          aria-hidden
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="mt-0.5 size-4 shrink-0 text-teal-600"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {ok}
                      </span>
                    </td>
                    <td className="py-4 text-olive-500">{risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* ============================ TESTIMONIAL ============================ */}
      <section className="py-16 sm:py-20">
        <Container>
          <figure className="flex max-w-3xl flex-col gap-6 text-left">
            <blockquote className="font-display text-2xl/tight font-medium text-balance text-mabe-950 sm:text-3xl/tight">
              „Mit dem MABE KMU-Check wussten wir innerhalb von Minuten, dass wir als kleines Unternehmen 45&nbsp;%
              Zuschuss bekommen. Der PDF-Nachweis hat unseren BAFA-Antrag spürbar beschleunigt.“
            </blockquote>
            <figcaption className="text-sm/6 text-olive-600">
              Technische Leitung, mittelständischer Maschinenbaubetrieb in Süddeutschland.
            </figcaption>
          </figure>
        </Container>
      </section>

      {/* =============================== FAQ =============================== */}
      <FAQsTwoColumnAccordion
        id="faq"
        headline="Häufige Fragen zum KMU-Status"
        subheadline={
          <p>Kurz und fachlich korrekt beantwortet. Für Ihren konkreten Fall beraten wir Sie gern persönlich.</p>
        }
      >
        <Faq
          id="faq-1"
          question="Was zählt als KMU nach EU-Definition?"
          answer="Kleinstunternehmen: unter 10 JAE und max. 2 Mio. € Umsatz oder Bilanzsumme. Kleine Unternehmen: unter 50 JAE und max. 10 Mio. €. Mittlere Unternehmen: unter 250 JAE und max. 50 Mio. € Umsatz oder 43 Mio. € Bilanzsumme. Die Mitarbeiterzahl ist bindend, beim Finanzkriterium genügt einer der beiden Werte."
        />
        <Faq
          id="faq-2"
          question="Was ist eine Jahresarbeitseinheit (JAE)?"
          answer="Eine JAE entspricht einer Vollzeitkraft über ein ganzes Jahr. Teilzeit-, Saison- und Aushilfskräfte werden anteilig gezählt. Auszubildende sowie Personen in Mutterschafts- oder Elternzeit zählen nicht mit."
        />
        <Faq
          id="faq-3"
          question="Wie werden Beteiligungen verrechnet?"
          answer="Partnerunternehmen mit 25 bis 50 % Beteiligung werden anteilig in Höhe der Beteiligungsquote zugerechnet. Verbundene Unternehmen mit mehr als 50 % (oder Kontrolle) werden zu 100 % einbezogen, in beide Richtungen. Beteiligungen unter 25 % bleiben unberücksichtigt."
        />
        <Faq
          id="faq-4"
          question="Wie hoch ist die Förderung in BAFA Modul 3?"
          answer="Die Höhe der Förderung bezogen auf die Kosten der förderfähigen Investition beträgt bei kleinen Unternehmen 45 %, bei mittleren Unternehmen 35 % und bei Unternehmen ohne KMU-Status 25 %."
        />
        <Faq
          id="faq-5"
          question="Ist das Ergebnis rechtsverbindlich?"
          answer="Der Check ist eine fundierte Orientierung auf Basis Ihrer Angaben und ersetzt keine verbindliche Prüfung durch die Bewilligungsbehörde. Den PDF-Nachweis können Sie jedoch als belastbare Vorbereitung für Ihren Antrag und Ihre Beratung nutzen."
        />
        <Faq
          id="faq-6"
          question="Was passiert mit meinen Daten?"
          answer="Ihre Angaben werden verschlüsselt übertragen und ausschließlich zur Erstellung Ihrer Auswertung sowie zur Kontaktaufnahme verwendet. Es erfolgt keine Weitergabe an Dritte. Ihre Einwilligung können Sie jederzeit widerrufen."
        />
      </FAQsTwoColumnAccordion>

      {/* =============================== CTA =============================== */}
      <section id="call-to-action" className="border-t border-olive-200 py-16 sm:py-20">
        <Container className="flex flex-col gap-6">
          <h2 className="max-w-2xl min-w-0 font-display text-3xl/tight font-semibold tracking-tight text-balance break-words text-mabe-950 sm:text-4xl/tight">
            Prüfen Sie Ihre Förderfähigkeit.
          </h2>
          <p className="max-w-2xl text-pretty text-base/7 text-olive-700">
            Sichern Sie sich Klarheit über Ihren KMU-Status, Ihre mögliche Förderquote und einen PDF-Nachweis, den
            Sie sofort weiterverwenden können.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <ButtonLink href="#kmu-check" size="lg" className="min-w-0 min-h-12 px-6 text-base break-words focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90">
              KMU-Check starten
            </ButtonLink>
            <PlainButtonLink href="#faq" size="lg" className="min-w-0 min-h-12 px-2 text-base break-words focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90">
              Mehr erfahren <ChevronIcon />
            </PlainButtonLink>
          </div>
        </Container>
      </section>

      {/* ============================ DISCLAIMER ============================ */}
      <section className="pb-4">
        <Container>
          <div className="flex gap-4 border-t border-olive-200 pt-8">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              className="mt-0.5 size-6 shrink-0 text-olive-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z"
              />
            </svg>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-mabe-900">Wichtiger Hinweis</h2>
              <p className="text-sm/6 text-olive-600">
                Der KMU-Check liefert eine{' '}
                <strong className="font-semibold text-olive-800">unverbindliche Orientierung</strong> auf Grundlage
                der von Ihnen eingegebenen Angaben nach EU-Empfehlung 2003/361/EG. Die Berechnung ersetzt keine
                Rechts-, Steuer- oder Förderberatung und ist nur so genau wie Ihre Eingaben. Ein förderrechtlicher
                Statuswechsel greift zudem erst nach der Zwei-Jahres-Regel. Lassen Sie das Ergebnis im Zweifel durch
                Ihren <strong className="font-semibold text-olive-800">Steuerberater</strong> bestätigen. Verbindlich
                ist allein die Prüfung durch die Bewilligungsbehörde.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ===================== RECHTLICHES (Anker) ===================== */}
      <section id="datenschutz" className="scroll-mt-28 py-12">
        <Container className="flex flex-col gap-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-mabe-900">Datenschutz auf einen Blick</h2>
              <p className="text-sm/7 text-olive-600">
                Wir verarbeiten Ihre Angaben aus dem KMU-Check auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a
                DSGVO) zur Erstellung Ihrer Auswertung und zur Kontaktaufnahme. Eine Weitergabe an Dritte erfolgt
                nicht. Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Details
                erhalten Sie in der{' '}
                <a
                  href="https://www.mabe.de/datenschutz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 hover:text-teal-600 active:brightness-90"
                >
                  vollständigen Datenschutzerklärung
                </a>{' '}
                der MABE Maschinen- und Behälterbau GmbH.
              </p>
            </div>
            <div id="impressum" className="flex scroll-mt-28 flex-col gap-3">
              <h2 className="text-lg font-semibold text-mabe-900">Impressum</h2>
              <p className="text-sm/7 text-olive-600">
                MABE Maschinen- und Behälterbau GmbH
                <br />
                Anbieter im Sinne des § 5 DDG. Vollständige Anbieterkennzeichnung, Vertretungsberechtigte und
                Registereintrag finden Sie im{' '}
                <a
                  href="https://www.mabe.de/impressum"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 hover:text-teal-600 active:brightness-90"
                >
                  offiziellen Impressum auf mabe.de
                </a>
                .
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
