import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BUCKET, supabase } from '../lib/supabase'
import { needsReview, type Poster } from '../lib/utils'

export function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [posters, setPosters] = useState<Poster[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const load = async () => {
    const { data, error } = await supabase.from('posters').select('id,title,caption,image_url,image_path,status,report_count,created_at').order('created_at', { ascending: false })
    if (error) return setError(error.message)
    setError('')
    setPosters(((data ?? []) as Poster[]).filter(needsReview))
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch when signed in
    if (session) void load()
  }, [session])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setError(error?.message ?? '')
  }
  const setStatus = async (p: Poster, status: string) => {
    const { error } = await supabase.from('posters').update({ status }).eq('id', p.id!)
    if (error) return setError(error.message)
    await load()
  }
  const remove = async (p: Poster) => {
    if (!confirm('Delete this poster permanently?')) return
    const { error } = await supabase.from('posters').delete().eq('id', p.id!)
    if (error) return setError(error.message)
    if (p.image_path) {
      const { error: se } = await supabase.storage.from(BUCKET).remove([p.image_path])
      if (se) setError('Row deleted, but image removal failed: ' + se.message)
    }
    await load()
  }

  return (
    <div className="wrap">
      <section className="panel">
        <h2>Admin</h2>
        {!ready ? null : !session ? (
          <form onSubmit={signIn}>
            <label className="field" htmlFor="adminEmail">Email</label>
            <input id="adminEmail" type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="field" htmlFor="adminPass">Password</label>
            <input id="adminPass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
            <div className="btnrow"><button className="btn" type="submit">Sign in</button></div>
          </form>
        ) : (
          <>
            <div className="btnrow">
              <button className="btn" type="button" onClick={() => void supabase.auth.signOut()}>Sign out</button>
              <button className="btn" type="button" onClick={() => void load()}>Refresh</button>
            </div>
            <p className="sub">{posters.length} to review (pending, hidden or reported)</p>
            <div className="gallery">
              {posters.map((p) => (
                <article className="card" key={String(p.id)}>
                  <img src={p.image_url} alt={p.title || 'Poster'} />
                  <div className="cardbody">
                    <strong>{p.title || 'Untitled'}</strong>
                    <p>{p.status} · {p.report_count ?? 0} reports</p>
                    <div className="btnrow">
                      <button className="btn" type="button" onClick={() => void setStatus(p, 'approved')}>Approve</button>
                      <button className="btn" type="button" onClick={() => void setStatus(p, 'hidden')}>Hide</button>
                      <button className="btn" type="button" onClick={() => void remove(p)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <p className="status error" role="alert">{error}</p>
      </section>
    </div>
  )
}
