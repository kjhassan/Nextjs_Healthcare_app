import '../styles.css'

export const metadata = {
  title: 'Smart Healthcare',
}

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  )
}
