import type { Metadata } from 'next'
import CartoonifyForm from '@/components/cartoonify-form'

export const metadata: Metadata = {
  title: 'Fotoğrafını Karikatüre Çevir — Cartoonify',
}

export default function Home() {
  return (
    <main>
      <h1>Fotoğrafını Karikatüre Çevir</h1>
      <p>
        Bir fotoğraf seçin, saniyeler içinde renkli bir karikatür versiyonunu görün ve indirin.
      </p>
      <CartoonifyForm />
    </main>
  )
}
