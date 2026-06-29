import type { Metadata, Viewport } from 'next'

import { ButtonLink, PlainButtonLink } from '@/components/elements/button'
import { Main } from '@/components/elements/main'
import { MabeLogo } from '@/components/kmu/mabe-logo'
import {
  FooterLink,
  FooterWithLinksAndSocialIcons,
  SocialLink,
} from '@/components/sections/footer-with-links-and-social-icons'
import {
  NavbarLink,
  NavbarLogo,
  NavbarWithLogoActionsAndLeftAlignedLinks,
} from '@/components/sections/navbar-with-logo-actions-and-left-aligned-links'
import { LinkedInIcon } from '@/components/kmu/linkedin-icon'
import './globals.css'

export const metadata: Metadata = {
  title: 'KMU-Fördercheck | MABE Maschinen- und Behälterbau GmbH',
  description:
    'In 3 Minuten prüfen, ob Ihr Unternehmen als KMU gilt und welche Förderquote (45 % / 35 % / 25 %) Ihnen im BAFA-Programm zusteht – inklusive korrekter Verbund-Verrechnung und PDF-Nachweis.',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Pinch-Zoom bleibt erlaubt (Barrierefreiheit); Auto-Zoom beim Fokussieren
  // verhindern wir über 16px-Schriftgrößen (siehe globals.css).
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wght@0,200..900;1,200..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavbarWithLogoActionsAndLeftAlignedLinks
          id="navbar"
          logo={
            <NavbarLogo href="#hero" aria-label="MABE – Maschinen- und Behälterbau GmbH">
              <MabeLogo className="h-7 w-auto" />
            </NavbarLogo>
          }
          links={
            <>
              <NavbarLink href="#kmu-check">KMU-Check</NavbarLink>
              <NavbarLink href="#vorteile">Vorteile</NavbarLink>
              <NavbarLink href="#ablauf">So funktioniert&apos;s</NavbarLink>
              <NavbarLink href="#faq">FAQ</NavbarLink>
            </>
          }
          actions={
            <>
              <PlainButtonLink href="tel:+4900000000" className="max-sm:hidden">
                Beratung
              </PlainButtonLink>
              <ButtonLink href="#kmu-check">Jetzt prüfen</ButtonLink>
            </>
          }
        />

        <Main>{children}</Main>

        <FooterWithLinksAndSocialIcons
          id="footer"
          links={
            <>
              <FooterLink href="#kmu-check">KMU-Check</FooterLink>
              <FooterLink href="#vorteile">Vorteile</FooterLink>
              <FooterLink href="#ablauf">Ablauf</FooterLink>
              <FooterLink href="#faq">FAQ</FooterLink>
              <FooterLink href="#datenschutz">Datenschutz</FooterLink>
              <FooterLink href="#impressum">Impressum</FooterLink>
            </>
          }
          socialLinks={
            <SocialLink href="https://www.linkedin.com" name="LinkedIn">
              <LinkedInIcon />
            </SocialLink>
          }
          fineprint={
            <div className="flex flex-col gap-1">
              <p>© {new Date().getFullYear()} MABE Maschinen- und Behälterbau GmbH. Alle Rechte vorbehalten.</p>
              <p className="text-xs/6">
                Der KMU-Check ist ein unverbindliches Orientierungstool nach EU-Empfehlung 2003/361/EG. Er ersetzt keine
                steuer- oder förderrechtliche Beratung.
              </p>
            </div>
          }
        />
      </body>
    </html>
  )
}
