import { useCallback, useEffect, useState } from 'react'
import { CityScene } from './components/CityScene'
import { Gallery } from './components/Gallery'
import { Icon } from './components/Icon'
import { Lightbox } from './components/Lightbox'
import { ThemeToggle } from './components/ThemeToggle'
import { AdminPanel } from './components/AdminPanel'
import { UploadForm } from './components/UploadForm'
import { supabase } from './lib/supabase'
import type { Poster } from './lib/utils'

export default function App() {
  const [posters, setPosters] = useState<Poster[]>([])
  const [message, setMessage] = useState<string | null>('Connecting to CrowdCanvas…')
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState<Poster | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('posters').select('id,title,caption,image_url,target_url,created_at').eq('status','approved').order('created_at', { ascending: false }).limit(100)
    if (error) {
      setMessage('Could not load the gallery. Check the SQL setup and Supabase keys. Details: ' + error.message)
      return
    }
    setPosters((data ?? []) as Poster[])
    setLoaded(true)
    setMessage(null)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load() }, [load])
  const refresh = () => { setMessage('Loading posters…'); return load() }

  const [admin, setAdmin] = useState(location.hash === '#admin')
  useEffect(() => {
    const f = () => setAdmin(location.hash === '#admin')
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  if (admin) return <AdminPanel />

  const n = posters.length
  return (
    <>
      <div className="wrap">
        <nav>
          <div className="brand"><Icon name="grid" /><span>crowd<b>canvas</b></span></div>
          <div className="navright"><div className="navnote">One internet · One evolving gallery</div><ThemeToggle /></div>
        </nav>
        <header className="hero">
          <div>
            <div className="eyebrow">A shared creative experiment</div>
            <h1>Put your poster<br />on the <span>internet wall.</span></h1>
            <p>Upload a poster, give it a name, and become part of a growing global collection made by people everywhere. Every contribution adds a new piece to the wall.</p>
          </div>
          <div className="counter">
            <strong>{loaded ? n : '—'}</strong>
            <small>posters in the global gallery</small>
            <div className="bar"><div style={{ width: Math.min(100, (n / 1000) * 100) + '%' }} /></div>
            <small>{loaded ? `${Math.max(0, 1000 - n)} of first 1,000 free poster slots remaining (count shown is latest 100 loaded)` : 'First 1,000 approved uploads are free'}</small>
          </div>
        </header>
        <CityScene featured={posters[0] ?? null} />
        <main className="content">
          <UploadForm onPublished={refresh} />
          <Gallery posters={posters} message={message} onOpen={setOpen} onRefresh={refresh} />
        </main>
        <footer>CrowdCanvas · Built for workslab.in · Hosted on GitHub Pages, with Supabase for shared uploads and gallery data.</footer>
      </div>
      <Lightbox poster={open} onClose={() => setOpen(null)} />
    </>
  )
}
