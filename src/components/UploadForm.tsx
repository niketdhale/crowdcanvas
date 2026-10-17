import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { BUCKET, supabase } from '../lib/supabase'
import { normalizeDestination, validateFile } from '../lib/utils'

export function UploadForm({ onPublished }: { onPublished: () => void | Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<{ text: string; error: boolean }>({ text: '', error: false })
  const [busy, setBusy] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const say = (text: string, error = false) => setStatus({ text, error })

  const onFile = (f: File | null) => {
    if (!f) { setFile(null); return }
    const err = validateFile(f)
    if (err) { say(err, true); setFile(null); return }
    setFile(f)
    say('Image selected. Add a title and publish.')
  }

  const publish = async () => {
    if (!file) return say('Choose an image first.', true)
    const targetUrl = normalizeDestination(link)
    if (targetUrl === false) { say('Enter a valid URL starting with https:// or http://, or leave it blank.', true); linkRef.current?.focus(); return }
    const t = title.trim()
    if (!t) { say('Please add a title for your poster.', true); titleRef.current?.focus(); return }
    setBusy(true)
    say('Uploading your poster…')
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const { error: insErr } = await supabase.from('posters').insert({ title: t, caption: caption.trim(), image_path: path, image_url: data.publicUrl, target_url: targetUrl })
      if (insErr) throw insErr
      say('Thanks! Your poster is awaiting review.')
      setTitle(''); setCaption(''); setLink(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await onPublished()
    } catch (err) {
      say('Upload failed: ' + ((err as Error)?.message || 'unknown error') + '. Check your Supabase SQL/policies and bucket setup.', true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" id="upload">
      <h2>Upload your poster</h2>
      <p className="sub">Images only · JPG, PNG or WebP · up to 5 MB</p>
      <label className="drop" htmlFor="posterFile">
        <strong><Icon name="arrowUpRight" /><span>Choose a poster image</span></strong>
        <span>Tap to browse files</span>
        <input id="posterFile" ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      <img className="preview" alt="Selected poster preview" src={preview ?? undefined} style={{ display: preview ? 'block' : 'none' }} />
      <label className="field" htmlFor="posterTitle">Poster title *</label>
      <input id="posterTitle" ref={titleRef} type="text" maxLength={70} placeholder="Give your poster a name" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="field" htmlFor="posterCaption">Short message (optional)</label>
      <textarea id="posterCaption" rows={3} maxLength={180} placeholder="What does your poster mean?" value={caption} onChange={(e) => setCaption(e.target.value)} />
      <label className="field" htmlFor="posterUrl">Destination URL (optional)</label>
      <input id="posterUrl" ref={linkRef} type="text" maxLength={500} inputMode="url" placeholder="https://yourwebsite.com" value={link} onChange={(e) => setLink(e.target.value)} />
      <p className="safety">Add a website, portfolio, product, or social link. Visitors who click your poster will open it in a new tab.</p>
      <div className="btnrow">
        <button className="btn" type="button" disabled={!file || busy} onClick={publish}>
          {busy ? 'Publishing…' : <><Icon name="arrowUpRight" /><span>Publish poster</span></>}
        </button>
      </div>
      <p className={'status' + (status.error ? ' error' : '')} role="status" aria-live="polite">{status.text}</p>
      <p className="safety">By publishing, you confirm you own the image or have permission to share it. Do not upload personal information, hateful content, or copyrighted work you don't have rights to. Posters appear in the gallery after a moderator approves them.</p>
    </section>
  )
}
