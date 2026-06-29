import type { ReactNode } from 'react'

import { ButtonLink, PlainButtonLink } from '@/components/elements/button'
import { Container } from '@/components/elements/container'
import { Eyebrow } from '@/components/elements/eyebrow'
import { Subheading } from '@/components/elements/subheading'
import { Text } from '@/components/elements/text'
import { ChevronIcon } from '@/components/icons/chevron-icon'
import { HeroBackground } from '@/components/kmu/hero-background'
import { KmuCheck } from '@/components/kmu/kmu-check'
import { CallToActionSimple } from '@/components/sections/call-to-action-simple'
import { FAQsTwoColumnAccordion, Faq } from '@/components/sections/faqs-two-column-accordion'

/* Größere, klarere Linien-Icons (size-6) für die Vorteils-Karten. */
const icons = {
  scale: (
    <path d="M12 3v18M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7Zm14 0-3 7a3.5 3.5 0 0 0 6 0l-3-7ZM5 7h14M7 21h10" />
  ),
  bolt: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />,
  doc: (
    <path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14 3v5h5M9 13h6M9 17h6" />
  ),
  network: (
    <path d="M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 5v6m0 0-5 6m5-6 5 6" />
  ),
  shield: <path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Zm-2.5 9 2 2 4-4" />,
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
}

function FeatureIcon({ path }: { path: ReactNode }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-600/15">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-6">
        {path}
      </svg>
    </span>
  )
}

export default function Page() {
  return (
    <>
      {/* ============================== HERO ============================== */}
      <section id="hero" className="relative py-12 sm:py-16">
        <HeroBackground />
        <Container className="relative flex flex-col gap-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3.5 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal-600/20">
              <span className="size-2 rounded-full bg-teal-500" />
              BAFA Modul 3 · Fördermittelcheck für die Industrie
            </span>
            <h1 className="font-display text-5xl/12 font-semibold tracking-tight text-balance text-mabe-900 sm:text-[4.5rem]/18">
              Erfahren Sie jetzt, ob Sie{' '}
              <span className="bg-gradient-to-r from-mabe-900 to-teal-600 bg-clip-text text-transparent">
                Förderungen nutzen
              </span>{' '}
              können.
            </h1>
            <Text size="lg" className="max-w-2xl text-pretty text-olive-700">
              Prüfen Sie in unter 3 Minuten, ob Ihr Unternehmen als KMU gilt – fachlich korrekt nach EU-Definition,
              inklusive Verbund-Verrechnung. Sie sehen live Ihre mögliche Förderquote von bis zu{' '}
              <strong className="text-mabe-900">45 %</strong> und erhalten einen PDF-Nachweis für jeden Förderantrag.
            </Text>
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-olive-700">
              {['Fachlich korrekt nach EU 2003/361/EG', 'Live-Auswertung & PDF-Nachweis', 'Kostenlos & ohne Anmeldung'].map(
                (t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-teal-600">
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Der mehrstufige KMU-Check ersetzt das klassische Hero-Bild. */}
          <KmuCheck />
        </Container>
      </section>

      {/* ============================ VORTEILE ============================ */}
      <section id="vorteile" className="py-16">
        <Container className="flex flex-col gap-12 sm:gap-16">
          <div className="flex max-w-2xl flex-col gap-4">
            <Eyebrow className="text-teal-700">Warum der MABE KMU-Check</Eyebrow>
            <Subheading>Förderfähigkeit verstehen, bevor Sie investieren.</Subheading>
            <Text className="text-pretty text-olive-700">
              Als Hersteller von Druckluftbehältern und Anbieter von MABE SMART CONTROL kennen wir die Energieeffizienz-
              Förderung aus der Praxis. Diesen Check haben wir gebaut, damit Sie Ihre Förderquote kennen, bevor Sie über
              eine neue Anlage entscheiden.
            </Text>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: icons.scale,
                title: 'Fachlich korrekt nach EU-Definition',
                desc: 'Mitarbeiterzahl (JAE), Umsatz und Bilanzsumme nach Empfehlung 2003/361/EG – mit den exakten Schwellenwerten für Kleinst-, Klein- und Mittelunternehmen.',
              },
              {
                icon: icons.network,
                title: 'Verbund live verrechnet',
                desc: 'Partnerunternehmen (25–50 %) anteilig, verbundene Unternehmen (über 50 %) zu 100 %. Wir bilden Ihre fiktive Unternehmensgröße in Echtzeit ab.',
              },
              {
                icon: icons.bolt,
                title: 'Förderquote sofort sichtbar',
                desc: 'Kleine Unternehmen 45 %, mittlere 35 %, ohne KMU-Status 25 % – bezogen auf die förderfähigen Investitionskosten. Live auf einer klaren Skala.',
              },
              {
                icon: icons.doc,
                title: 'PDF-Nachweis für jeden Antrag',
                desc: 'Ihr Ergebnis als sauberer, nachvollziehbarer Nachweis – nutzbar für BAFA Modul 3 und viele weitere Programme von KfW und Ländern.',
              },
              {
                icon: icons.shield,
                title: 'Datenschutz & Diskretion',
                desc: 'Ihre Angaben werden verschlüsselt übertragen und ausschließlich für Ihre Auswertung und Beratung genutzt – keine Weitergabe an Dritte.',
              },
              {
                icon: icons.clock,
                title: 'In 3 Minuten erledigt',
                desc: 'Mehrstufig, mit Erklärung zu jeder Kennzahl. Kein Fachjargon, keine Anmeldung – einfach Schritt für Schritt zum Ergebnis.',
              },
            ].map((f) => (
              <div key={f.title} className="flex flex-col gap-3">
                <FeatureIcon path={f.icon} />
                <h3 className="text-lg font-semibold text-mabe-900">{f.title}</h3>
                <p className="text-sm/7 text-olive-700">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* =========================== FÖRDERQUOTEN =========================== */}
      <section className="py-16">
        <Container>
          <div className="overflow-hidden rounded-3xl bg-mabe-900 p-8 sm:p-12">
            <div className="flex max-w-2xl flex-col gap-3">
              <Eyebrow className="text-teal-300">BAFA Modul 3 · Förderquoten</Eyebrow>
              <h2 className="font-display text-4xl/tight font-semibold text-white sm:text-5xl">Bis zu 45 % Zuschuss – je nach Unternehmensgröße.</h2>
              <p className="text-pretty text-olive-300">
                Die Höhe der Förderung bezogen auf die förderfähigen Investitionskosten hängt direkt von Ihrem
                KMU-Status ab. Genau deshalb lohnt sich die korrekte Einstufung.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { rate: '45 %', label: 'Kleine Unternehmen', sub: 'inkl. Kleinstunternehmen', highlight: true },
                { rate: '35 %', label: 'Mittlere Unternehmen', sub: 'bis < 250 JAE', highlight: false },
                { rate: '25 %', label: 'Ohne KMU-Status', sub: 'Großunternehmen', highlight: false },
              ].map((q) => (
                <div
                  key={q.rate}
                  className={
                    q.highlight
                      ? 'rounded-2xl bg-teal-500 p-6 text-mabe-950 shadow-lg'
                      : 'rounded-2xl bg-white/5 p-6 text-white ring-1 ring-white/10'
                  }
                >
                  <div className="font-display text-5xl tabular-nums">{q.rate}</div>
                  <div className="mt-3 text-base font-semibold">{q.label}</div>
                  <div className={q.highlight ? 'text-sm text-mabe-900/70' : 'text-sm text-olive-400'}>{q.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <ButtonLink href="#kmu-check" color="light" size="lg">
                Meine Förderquote prüfen
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================== ABLAUF ============================== */}
      <section id="ablauf" className="py-16">
        <Container className="flex flex-col gap-12 sm:gap-16">
          <div className="flex max-w-2xl flex-col gap-4">
            <Eyebrow className="text-teal-700">So funktioniert&apos;s</Eyebrow>
            <Subheading>In vier Schritten zur belastbaren Einschätzung.</Subheading>
          </div>
          <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '01', t: 'Unternehmen erfassen', d: 'Name, Jahresarbeitseinheiten und Finanzkennzahlen – verständlich erklärt.' },
              { n: '02', t: 'Verbund abbilden', d: 'Beteiligungen ab 25 % erfassen. Wir rechnen Partner anteilig und verbundene zu 100 % zu.' },
              { n: '03', t: 'Live-Ergebnis sehen', d: 'KMU-Status und mögliche Förderquote erscheinen sofort und nachvollziehbar.' },
              { n: '04', t: 'Nachweis sichern', d: 'PDF herunterladen und kostenlose Förder-Ersteinschätzung von MABE erhalten.' },
            ].map((s) => (
              <li key={s.n} className="flex flex-col gap-3 border-t-2 border-olive-200 pt-5">
                <span className="font-display text-3xl text-teal-600">{s.n}</span>
                <h3 className="text-lg font-semibold text-mabe-900">{s.t}</h3>
                <p className="text-sm/7 text-olive-700">{s.d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ===================== WAS VIELE VERGESSEN ===================== */}
      <section className="py-16">
        <Container>
          <div className="rounded-3xl border border-olive-200 bg-olive-50/60 p-8 sm:p-12">
            <div className="flex max-w-2xl flex-col gap-4">
              <Eyebrow className="text-teal-700">Aus der Förderpraxis</Eyebrow>
              <Subheading>Was bei der KMU-Prüfung oft übersehen wird.</Subheading>
              <Text className="text-pretty text-olive-700">
                Genau an diesen Punkten scheitern Anträge oder Unternehmen verschenken Förderquote. Unser Check
                berücksichtigt sie automatisch.
              </Text>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
              {[
                ['Beteiligungen in beide Richtungen', 'Nicht nur Ihre Töchter zählen – auch Anteile, die jemand an Ihnen hält (Mütter, Investoren), fließen ein.'],
                ['Die Zwei-Jahres-Regel', 'Ein Statuswechsel greift erst, wenn ein Schwellenwert in zwei aufeinanderfolgenden Geschäftsjahren über- oder unterschritten wird.'],
                ['Verbund über natürliche Personen', 'Hält eine Person (oder Familie) Anteile an mehreren Firmen im selben Markt, können diese als verbunden gelten.'],
                ['Öffentliche Beteiligungen ab 25 %', 'Halten öffentliche Stellen 25 % oder mehr, entfällt der KMU-Status in der Regel – mit eng definierten Ausnahmen.'],
                ['Umsatz ODER Bilanzsumme', 'Beim Finanzkriterium genügt das Einhalten eines der beiden Werte – das wird häufig zu streng ausgelegt.'],
                ['Neugründungen & Schätzungen', 'Ohne abgeschlossenes Geschäftsjahr zählt eine plausible Schätzung nach Treu und Glauben.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-5 shrink-0 text-teal-600">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-mabe-900">{t}</h3>
                    <p className="mt-1 text-sm/7 text-olive-700">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ===================== WARUM KORREKT (Tabelle) ===================== */}
      <section className="py-16">
        <Container className="flex flex-col gap-10">
          <div className="flex max-w-2xl flex-col gap-4">
            <Eyebrow className="text-teal-700">Warum es auf Genauigkeit ankommt</Eyebrow>
            <Subheading>Warum das KMU-Kriterium in der Förderkulisse korrekt abgebildet sein muss.</Subheading>
            <Text className="text-pretty text-olive-700">
              Die KMU-Einstufung ist kein Detail, sondern die Grundlage Ihrer gesamten Förderung. Schon kleine Fehler
              entscheiden über Förderhöhe, Bewilligung – und im schlimmsten Fall über eine Rückforderung.
            </Text>
          </div>

          <div className="overflow-hidden rounded-3xl ring-1 ring-olive-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-olive-50 text-olive-500">
                    <th className="px-5 py-4 font-semibold">Aspekt</th>
                    <th className="px-5 py-4 font-semibold text-teal-700">Bei korrekter Einstufung</th>
                    <th className="px-5 py-4 font-semibold">Risiko bei falscher Angabe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive-100 bg-white">
                  {[
                    [
                      'Förderquote',
                      '45 / 35 / 25 % exakt bestimmt – maximal möglicher Zuschuss wird ausgeschöpft.',
                      'Zu niedrig beantragt (Geld verschenkt) oder zu hoch – spätere Kürzung.',
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
                      <td className="px-5 py-4 font-semibold text-mabe-900">{aspect}</td>
                      <td className="px-5 py-4 text-olive-700">
                        <span className="flex gap-2">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-teal-600">
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {ok}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-olive-500">{risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </section>

      {/* ============================ TESTIMONIAL ============================ */}
      <section className="py-16">
        <Container>
          <figure className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
            <blockquote className="font-display text-3xl/tight font-medium text-balance text-mabe-900 sm:text-4xl/tight">
              „Mit dem MABE KMU-Check wussten wir innerhalb von Minuten, dass wir als kleines Unternehmen 45 % Zuschuss
              bekommen. Der PDF-Nachweis hat unseren BAFA-Antrag spürbar beschleunigt.“
            </blockquote>
            <figcaption className="flex flex-col items-center gap-1">
              <span className="font-semibold text-mabe-900">Technische Leitung</span>
              <span className="text-sm text-olive-600">Mittelständischer Maschinenbaubetrieb, Süddeutschland</span>
            </figcaption>
          </figure>
        </Container>
      </section>

      {/* =============================== FAQ =============================== */}
      <FAQsTwoColumnAccordion
        id="faq"
        headline="Häufige Fragen zum KMU-Status"
        subheadline={
          <p>
            Kurz und fachlich korrekt beantwortet. Für Ihren konkreten Fall beraten wir Sie gern persönlich.
          </p>
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
          answer="Partnerunternehmen mit 25 bis 50 % Beteiligung werden anteilig in Höhe der Beteiligungsquote zugerechnet. Verbundene Unternehmen mit mehr als 50 % (oder Kontrolle) werden zu 100 % einbezogen – in beide Richtungen. Beteiligungen unter 25 % bleiben unberücksichtigt."
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
          answer="Ihre Angaben werden verschlüsselt übertragen und ausschließlich zur Erstellung Ihrer Auswertung sowie zur Kontaktaufnahme verwendet. Es erfolgt keine Weitergabe an Dritte; Ihre Einwilligung können Sie jederzeit widerrufen."
        />
      </FAQsTwoColumnAccordion>

      {/* =============================== CTA =============================== */}
      <CallToActionSimple
        id="call-to-action"
        eyebrow="Jetzt starten"
        headline="Prüfen Sie Ihre Förderfähigkeit – in 3 Minuten."
        subheadline={
          <p>
            Sichern Sie sich Klarheit über Ihren KMU-Status, Ihre mögliche Förderquote und einen PDF-Nachweis, den Sie
            sofort weiterverwenden können.
          </p>
        }
        cta={
          <div className="flex items-center gap-4">
            <ButtonLink href="#kmu-check" size="lg">
              KMU-Check starten
            </ButtonLink>
            <PlainButtonLink href="#faq" size="lg">
              Mehr erfahren <ChevronIcon />
            </PlainButtonLink>
          </div>
        }
      />

      {/* ============================ DISCLAIMER ============================ */}
      <section className="pb-4">
        <Container>
          <div className="flex gap-4 rounded-2xl bg-olive-50 p-6 ring-1 ring-olive-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="mt-0.5 size-6 shrink-0 text-olive-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-mabe-900">Wichtiger Hinweis</h2>
              <p className="text-sm/6 text-olive-600">
                Der KMU-Check liefert eine <strong className="font-semibold text-olive-800">unverbindliche
                Orientierung</strong> auf Grundlage der von Ihnen eingegebenen Angaben nach EU-Empfehlung 2003/361/EG. Die
                Berechnung ersetzt keine Rechts-, Steuer- oder Förderberatung und ist nur so genau wie Ihre Eingaben. Ein
                förderrechtlicher Statuswechsel greift zudem erst nach der Zwei-Jahres-Regel. Lassen Sie das Ergebnis im
                Zweifel durch Ihren <strong className="font-semibold text-olive-800">Steuerberater</strong> bestätigen –
                verbindlich ist allein die Prüfung durch die Bewilligungsbehörde.
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
                DSGVO) zur Erstellung Ihrer Auswertung und zur Kontaktaufnahme. Eine Weitergabe an Dritte erfolgt nicht.
                Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Details erhalten Sie in
                der vollständigen Datenschutzerklärung der MABE Maschinen- und Behälterbau GmbH.
              </p>
            </div>
            <div id="impressum" className="flex scroll-mt-28 flex-col gap-3">
              <h2 className="text-lg font-semibold text-mabe-900">Impressum</h2>
              <p className="text-sm/7 text-olive-600">
                MABE Maschinen- und Behälterbau GmbH
                <br />
                Anbieter im Sinne des § 5 DDG. Vollständige Anbieterkennzeichnung, Vertretungsberechtigte und
                Registereintrag finden Sie im offiziellen Impressum auf mabe.de.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
