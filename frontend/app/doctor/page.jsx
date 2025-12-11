import DoctorDashboard from '../components/DoctorDashboardClient'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DoctorPage() {
  try {
    const headersList = await headers()
    const cookieHeader = headersList.get('cookie') || ''
    const baseUrl = process.env.INTERNAL_AUTH_URL || process.env.NEXT_PUBLIC_AUTH_URL || ''
    const res = await fetch(`${baseUrl}/me`, { 
      headers: { 
        cookie: cookieHeader
      }, 
      cache: 'no-store' 
    })
    if (!res.ok) redirect('/')
    const me = await res.json()
    return <DoctorDashboard initialMe={me} />
  } catch (error) {
    console.error('Doctor page error:', error)
    redirect('/')
  }
}
