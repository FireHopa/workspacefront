import React, { useEffect, useRef } from 'react'
import { api } from '../services/api'

function socialSessionUrl() {
  const base = String(api.defaults.baseURL || '').replace(/\/+$/, '')
  return `${base}/social/session`
}

export default function SocialPublisherRedirect({ token, onLogout }) {
  const submitted = useRef(false)

  useEffect(() => {
    if (!token || submitted.current) return
    submitted.current = true

    // POST de navegação em tela cheia: evita colocar o JWT na URL e permite
    // que os provedores OAuth (Google/Meta/LinkedIn/TikTok) abram normalmente.
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = socialSessionUrl()
    form.style.display = 'none'

    const tokenInput = document.createElement('input')
    tokenInput.type = 'hidden'
    tokenInput.name = 'workspace_token'
    tokenInput.value = token
    form.appendChild(tokenInput)

    const moduleBaseInput = document.createElement('input')
    moduleBaseInput.type = 'hidden'
    moduleBaseInput.name = 'module_base_url'
    moduleBaseInput.value = new URL(socialSessionUrl().replace(/\/session$/, ''), window.location.href).toString().replace(/\/$/, '')
    form.appendChild(moduleBaseInput)

    const returnInput = document.createElement('input')
    returnInput.type = 'hidden'
    returnInput.name = 'return_to'
    returnInput.value = `${window.location.origin}${window.location.pathname}`
    form.appendChild(returnInput)

    document.body.appendChild(form)
    form.submit()
    return () => form.remove()
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center space-y-4">
        <p className="font-semibold text-slate-700">Abrindo o Social Publisher…</p>
        <p className="text-sm text-slate-500">A sessão está sendo transferida com segurança.</p>
        <button className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold" onClick={onLogout}>Sair</button>
      </div>
    </div>
  )
}
