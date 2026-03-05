import { redirect } from 'next/navigation';

export default function RootPage() {
  // Esta función DEBE ser el export default para que Next.js no dé error
  redirect('/dashboard');
  return null; // El return null es para que React esté feliz mientras redirecciona
}