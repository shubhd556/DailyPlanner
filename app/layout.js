import './globals.css'
import Nav from '../components/Nav'
import Script from 'next/script'
export const metadata = {
  title: 'Two Routes App',
  description: 'A minimal Next.js app with two routes',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>

        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var saved = localStorage.getItem('theme.v1');
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              var theme = saved || (prefersDark ? 'dark' : 'light');
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {}
          })();
        `}</Script>

        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
