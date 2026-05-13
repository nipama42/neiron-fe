import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { useAuth } from '../store/authStore'
import {
  authViaTelegram,
  completePasswordRecovery,
  loginEmail,
  pollBotLogin,
  registerEmail,
  requestBotLoginUrl,
  requestEmailCode,
  requestPasswordRecoveryCode,
  verifyEmailCode,
  verifyPasswordRecoveryCode,
} from '../api/auth'
import { openTelegramHttpsLink } from '../lib/telegramMiniAppRedirect'
import { EMAIL_PASSWORD_REQUIREMENTS_HINT, isStrongEmailPassword } from '../lib/emailPasswordRules'

const BOT_LOGIN_PENDING_KEY = 'neiro_bot_login_pending_v1'

const LOCAL_AUTH = {
  token: 'local-dev',
  refreshToken: 'local-dev',
  user: {
    id: 'local-dev-user',
    telegramId: null,
    tgUsername: '',
    tgFirstName: 'Гость',
    email: null,
    creditsBalance: 240,
    shareByDefault: false,
    referralCode: 'LOCAL',
    createdAt: new Date().toISOString(),
    hasCompletedFirstGeneration: false,
    hasCompletedFirstPurchase: false,
    purchasesCount: 0,
    displayName: null,
    avatarUrl: null,
    subscriptionTier: 'free',
    profileLikesCount: 0,
    profilePublic: false,
    publicTag: null,
    bio: null,
    instagramUrl: null,
    telegramUrl: null,
    tiktokUrl: null,
    twitterUrl: null,
    youtubeUrl: null,
    vkUrl: null,
    tagChangedAt: null,
    subscription: { tier: 'free', label: 'Бесплатный план' },
    generationStats: { total: 0, publicCount: 0 },
    publicGenerations: [],
    generationsLog: [],
    isAdmin: false,
    activeGenerationUntil: null,
    activeKieGenerationCount: 0,
  },
}

function readPartnerCode(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('r')?.trim().toUpperCase()
    if (fromUrl) {
      sessionStorage.setItem('_ps', fromUrl)
      return fromUrl
    }
    return sessionStorage.getItem('_ps')?.trim().toUpperCase() || undefined
  } catch {
    return undefined
  }
}

function readTelegramStartCode(): string | undefined {
  try {
    const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param
    if (typeof sp === 'string' && /^[a-z0-9]{8}$/i.test(sp.trim())) {
      return sp.trim().toUpperCase()
    }
    return undefined
  } catch {
    return undefined
  }
}

function readPlainTextFromClipboard(e: React.ClipboardEvent<HTMLInputElement>): string {
  return e.clipboardData?.getData('text/plain') ?? e.clipboardData?.getData('text') ?? ''
}

function applyPastedTextToInput(
  target: HTMLInputElement,
  text: string,
  setValue: (next: string) => void
) {
  if (!text) return
  const start =
    typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length
  const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start
  const before = target.value
  const next = `${before.slice(0, start)}${text}${before.slice(end)}`
  setValue(next)
  const pos = start + text.length
  requestAnimationFrame(() => {
    try {
      target.setSelectionRange(pos, pos)
    } catch {
      /* ignore */
    }
  })
}

export default function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { initData } = useTelegram()
  const { setAuth } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const initialErr = (location.state as { tgError?: string } | null)?.tgError ?? null
  const [err, setErr] = useState<string | null>(initialErr)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState<0 | 1 | 2>(0)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryTokenRw, setRecoveryTokenRw] = useState('')
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryPw2, setRecoveryPw2] = useState('')

  const [botLoginState, setBotLoginState] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [botLoginMsg, setBotLoginMsg] = useState<string | null>(null)
  const botPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const botLoginExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const botLoginLockUntilRef = useRef(0)
  const startBotLoginPollingRef = useRef<(token: string) => void>(() => {})

  const emailRef = useRef<HTMLInputElement>(null)
  const loginPasswordRef = useRef<HTMLInputElement>(null)

  const onEmailPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = readPlainTextFromClipboard(e)
    if (!text) return
    e.preventDefault()
    applyPastedTextToInput(e.currentTarget, text, setEmail)
  }, [])

  const onEmailBeforeInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent
    if (!(native instanceof InputEvent)) return
    if (native.inputType !== 'insertFromPaste') return
    const dataTransfer = (native as InputEvent & { dataTransfer?: DataTransfer | null }).dataTransfer
    const text = dataTransfer?.getData('text/plain') ?? native.data ?? ''
    if (!text) return
    e.preventDefault()
    applyPastedTextToInput(e.currentTarget, text, setEmail)
  }, [])

  const onPasswordPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = readPlainTextFromClipboard(e)
    if (!text) return
    e.preventDefault()
    applyPastedTextToInput(e.currentTarget, text, setPassword)
  }, [])

  const onPasswordBeforeInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent
    if (!(native instanceof InputEvent)) return
    if (native.inputType !== 'insertFromPaste') return
    const dataTransfer = (native as InputEvent & { dataTransfer?: DataTransfer | null }).dataTransfer
    const text = dataTransfer?.getData('text/plain') ?? native.data ?? ''
    if (!text) return
    e.preventDefault()
    applyPastedTextToInput(e.currentTarget, text, setPassword)
  }, [])

  const syncLoginFieldsFromDom = useCallback(() => {
    if (emailRef.current) setEmail(emailRef.current.value)
    if (loginPasswordRef.current) setPassword(loginPasswordRef.current.value)
  }, [])

  const partnerCode = readPartnerCode()
  const telegramStartCode = readTelegramStartCode()

  function stopBotPoll() {
    if (botPollRef.current !== null) {
      clearInterval(botPollRef.current)
      botPollRef.current = null
    }
    if (botLoginExpiryRef.current !== null) {
      clearTimeout(botLoginExpiryRef.current)
      botLoginExpiryRef.current = null
    }
  }

  useEffect(() => stopBotPoll, [])

  function startBotLoginPolling(loginToken: string) {
    stopBotPoll()
    setBotLoginState('waiting')
    setBotLoginMsg(
      'Нажмите Start в боте. Оставьте эту вкладку открытой — после подтверждения вы автоматически войдёте (или обновите страницу).'
    )
    botPollRef.current = setInterval(async () => {
      try {
        const result = await pollBotLogin(loginToken)
        if (result.status === 'ok' && result.token && result.user) {
          stopBotPoll()
          try {
            sessionStorage.removeItem(BOT_LOGIN_PENDING_KEY)
          } catch {
            /* ignore */
          }
          setBotLoginState('idle')
          setBotLoginMsg(null)
          setAuth({ token: result.token, refreshToken: result.refreshToken ?? '', user: result.user })
          navigate('/explore', { replace: true })
        } else if (result.status === 'expired') {
          stopBotPoll()
          try {
            sessionStorage.removeItem(BOT_LOGIN_PENDING_KEY)
          } catch {
            /* ignore */
          }
          setBotLoginState('error')
          setBotLoginMsg('Сессия истекла. Попробуйте снова.')
        }
      } catch {
        /* keep polling */
      }
    }, 2000)

    botLoginExpiryRef.current = setTimeout(() => {
      botLoginExpiryRef.current = null
      stopBotPoll()
      try {
        sessionStorage.removeItem(BOT_LOGIN_PENDING_KEY)
      } catch {
        /* ignore */
      }
      setBotLoginState((prev) => {
        if (prev === 'waiting') {
          setBotLoginMsg('Время ожидания истекло. Попробуйте снова.')
          return 'error'
        }
        return prev
      })
    }, 5 * 60 * 1000)
  }

  startBotLoginPollingRef.current = startBotLoginPolling

  useEffect(() => {
    const resumeFromStorage = () => {
      let raw: string | null = null
      try {
        raw = sessionStorage.getItem(BOT_LOGIN_PENDING_KEY)
      } catch {
        return
      }
      if (!raw) return
      try {
        const data = JSON.parse(raw) as { token: string; t: number }
        if (!data?.token || typeof data.t !== 'number') return
        if (Date.now() - data.t > 5 * 60 * 1000) return
        startBotLoginPollingRef.current(data.token)
      } catch {
        /* ignore */
      }
    }
    const onPageShow = () => resumeFromStorage()
    const onVisible = () => {
      if (document.visibilityState === 'visible') resumeFromStorage()
    }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(BOT_LOGIN_PENDING_KEY)
    } catch {
      return
    }
    if (!raw) return

    let data: { token: string; t: number }
    try {
      data = JSON.parse(raw) as { token: string; t: number }
    } catch {
      try {
        sessionStorage.removeItem(BOT_LOGIN_PENDING_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    if (!data?.token || typeof data.t !== 'number') {
      try {
        sessionStorage.removeItem(BOT_LOGIN_PENDING_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    if (Date.now() - data.t > 5 * 60 * 1000) {
      try {
        sessionStorage.removeItem(BOT_LOGIN_PENDING_KEY)
      } catch {
        /* ignore */
      }
      return
    }

    startBotLoginPolling(data.token)
    return () => stopBotPoll()
    // Только при монтировании: восстановить опрос после возврата с t.me (тот же tab / bfcache).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно без зависимостей
  }, [])

  async function handleTelegramAuth() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      if (!initData?.trim()) throw new Error('В Telegram initData пустой')
      const out = await authViaTelegram(initData, { partnerCode, telegramStartCode })
      setAuth(out)
      navigate('/explore', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка авторизации Telegram')
    } finally {
      setBusy(false)
    }
  }

  async function handleBotLogin() {
    const now = Date.now()
    if (now < botLoginLockUntilRef.current) return
    botLoginLockUntilRef.current = now + 2800
    setErr(null)
    setMsg(null)
    setBotLoginState('idle')
    stopBotPoll()
    setBusy(true)

    try {
      const { loginUrl, token: loginToken } = await requestBotLoginUrl({ partnerSlug: partnerCode })
      try {
        sessionStorage.setItem(BOT_LOGIN_PENDING_KEY, JSON.stringify({ token: loginToken, t: Date.now() }))
      } catch {
        /* ignore */
      }

      const opened = openTelegramHttpsLink(loginUrl)
      if (!opened) {
        setBotLoginState('waiting')
        setBotLoginMsg(
          'Открываем бота в Telegram. Нажмите Start, затем «Назад» в браузере — вход на этой странице продолжится.'
        )
        setBusy(false)
        window.location.assign(loginUrl)
        return
      }

      setBusy(false)
      startBotLoginPolling(loginToken)
    } catch (e) {
      setBusy(false)
      setBotLoginState('error')
      setBotLoginMsg(e instanceof Error ? e.message : 'Ошибка запуска авторизации')
    }
  }

  async function handleLogin() {
    setErr(null)
    setMsg(null)
    syncLoginFieldsFromDom()
    const rawEmail = (emailRef.current?.value ?? email).trim()
    const rawPass = loginPasswordRef.current?.value ?? password
    if (!rawEmail || !rawPass) { setErr('Введите email и пароль'); return }
    setBusy(true)
    try {
      const out = await loginEmail(rawEmail, rawPass)
      setAuth(out)
      navigate('/explore', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка входа')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestCode() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const em = (emailRef.current?.value ?? email).trim()
      await requestEmailCode(em)
      setMsg('Код отправлен на почту')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось отправить код')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const em = (emailRef.current?.value ?? email).trim()
      const out = await verifyEmailCode(em, code.trim())
      setVerificationToken(out.verificationToken)
      setMsg('Почта подтверждена, задайте пароль')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Неверный код')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const em = (emailRef.current?.value ?? email).trim()
      const out = await registerEmail(em, password, verificationToken, {
        partnerCode,
        acceptedTerms: true,
      })
      setAuth(out)
      navigate('/explore', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка регистрации')
    } finally {
      setBusy(false)
    }
  }

  function resetRecovery() {
    setRecoveryOpen(false)
    setRecoveryStep(0)
    setRecoveryEmail('')
    setRecoveryCode('')
    setRecoveryTokenRw('')
    setRecoveryPw('')
    setRecoveryPw2('')
    setErr(null)
  }

  function openRecovery() {
    setErr(null)
    setMsg(null)
    setRecoveryEmail((emailRef.current?.value ?? email).trim())
    setRecoveryStep(0)
    setRecoveryCode('')
    setRecoveryTokenRw('')
    setRecoveryPw('')
    setRecoveryPw2('')
    setRecoveryOpen(true)
  }

  async function handleRecoveryRequestCode(opts?: { resend?: boolean }) {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const em = recoveryEmail.trim().toLowerCase()
      if (!/\S+@\S+\.\S+/.test(em)) {
        throw new Error('Введите корректный адрес почты')
      }
      await requestPasswordRecoveryCode(em)
      setMsg(
        opts?.resend
          ? 'Новый код отправлен на почту (если аккаунт с паролем существует для этого адреса).'
          : 'Если для этой почты есть аккаунт с паролем — на неё отправлен код.'
      )
      setRecoveryStep(1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось отправить код')
    } finally {
      setBusy(false)
    }
  }

  async function handleRecoveryVerifyCode() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const em = recoveryEmail.trim().toLowerCase()
      const { recoveryToken } = await verifyPasswordRecoveryCode(em, recoveryCode.trim())
      setRecoveryTokenRw(recoveryToken)
      setRecoveryStep(2)
      setMsg('Задайте новый пароль (не совпадающий со старым)')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Неверный код')
    } finally {
      setBusy(false)
    }
  }

  async function handleRecoverySetPassword() {
    if (recoveryPw !== recoveryPw2) {
      setErr('Пароли не совпадают')
      return
    }
    if (!isStrongEmailPassword(recoveryPw)) {
      setErr(`Пароль: ${EMAIL_PASSWORD_REQUIREMENTS_HINT}`)
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const em = recoveryEmail.trim().toLowerCase()
      const out = await completePasswordRecovery(em, recoveryTokenRw, recoveryPw)
      setAuth(out)
      resetRecovery()
      navigate('/explore', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сменить пароль')
    } finally {
      setBusy(false)
    }
  }

  const emailVal = (emailRef.current?.value ?? email).trim()
  const emailReady = /\S+@\S+\.\S+/.test(emailVal)
  const codeReady = /^\d{6}$/.test(code.trim())
  const canRegister =
    Boolean(verificationToken) && isStrongEmailPassword(password) && acceptedTerms
  const isLocalDev = import.meta.env.DEV
  const showLocalShortcut = isLocalDev && !initData?.trim()
  const recoveryEmailReady = /\S+@\S+\.\S+/.test(recoveryEmail.trim())
  const recoveryCodeReady = /^\d{6}$/.test(recoveryCode.trim())
  const recoveryPwReady = recoveryPw === recoveryPw2 && isStrongEmailPassword(recoveryPw)

  return (
    <div
      className="neiro-login-screen min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(/neironauto.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        {/* Logo */}
        <img src="/mainlogo.png" alt="NEIRON" className="h-16 w-auto opacity-90" />

        {/* Card */}
        <div
          className="w-full rounded-2xl p-6 flex flex-col gap-4"
          style={{
            background: 'rgba(10, 10, 10, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          {/* Local dev shortcut */}
          {showLocalShortcut ? (
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
              <p className="text-xs text-white/40">Локальная разработка</p>
              <button
                type="button"
                onClick={() => {
                  setAuth(LOCAL_AUTH)
                  navigate('/explore', { replace: true })
                }}
                className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white py-2 text-sm font-medium transition-colors"
              >
                Войти как локальный пользователь
              </button>
            </div>
          ) : null}

          {/* Telegram button */}
          {initData?.trim() ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleTelegramAuth}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-black py-3 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              <img src="/tg-icon.png" alt="Telegram" className="h-6 w-6" />
              Войти через Telegram
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy || botLoginState === 'waiting'}
                onClick={handleBotLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-black py-3 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                <img src="/tg-icon.png" alt="Telegram" className="h-6 w-6" />
                {botLoginState === 'waiting' ? 'Ожидание подтверждения...' : 'Войти через Telegram'}
              </button>
              {botLoginMsg ? (
                <p className={`text-xs text-center px-1 ${botLoginState === 'error' ? 'text-red-400' : 'text-white/50'}`}>
                  {botLoginMsg}
                </p>
              ) : null}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30 font-medium">или</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {!recoveryOpen ? (
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setAcceptedTerms(false)
                }}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-white text-black shadow'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${
                  mode === 'register'
                    ? 'bg-white text-black shadow'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Регистрация
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/55 leading-relaxed px-0.5">
              Укажите email, к которому привязан ваш аккаунт — на этот адрес пришлём код. После проверки кода
              задайте новый пароль (он не может совпадать с тем, что использовали раньше).
            </p>
          )}

          {!recoveryOpen ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
              }}
              noValidate
            >
          {/* Email input */}
          <input
            ref={emailRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onPaste={onEmailPaste}
            onBeforeInput={onEmailBeforeInput}
            onBlur={mode === 'login' ? syncLoginFieldsFromDom : undefined}
            placeholder={mode === 'login' ? 'Email или логин' : 'Email'}
            name="email"
            autoComplete="username"
            className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />

          {mode === 'login' ? (
            <>
              <input
                ref={loginPasswordRef}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPaste={onPasswordPaste}
                onBeforeInput={onPasswordBeforeInput}
                onBlur={syncLoginFieldsFromDom}
                placeholder="Пароль"
                type="password"
                name="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
              />
              <button
                type="button"
                className="text-xs text-white/45 hover:text-white/80 self-start -mt-1 transition-colors"
                onClick={openRecovery}
              >
                Забыли пароль?
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleLogin}
                className="w-full rounded-xl bg-white text-black py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {busy ? 'Входим...' : 'Войти'}
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Код из письма"
                  inputMode="numeric"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                />
                <button
                  type="button"
                  disabled={busy || !emailReady}
                  onClick={handleRequestCode}
                  className="rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 px-4 text-sm font-medium transition-colors disabled:opacity-40"
                >
                  Код
                </button>
              </div>
              <button
                type="button"
                disabled={busy || !emailReady || !codeReady}
                onClick={handleVerifyCode}
                className="w-full rounded-xl border border-white/20 text-white/70 hover:text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
              >
                Подтвердить код
              </button>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPaste={onPasswordPaste}
                onBeforeInput={onPasswordBeforeInput}
                placeholder="Новый пароль"
                type="password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
              />
              <p className="text-[10px] text-white/40 -mt-2 leading-snug">{EMAIL_PASSWORD_REQUIREMENTS_HINT}</p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-white/5 text-black focus:ring-2 focus:ring-white/20 focus:ring-offset-0"
                />
                <span className="text-xs text-white/60 leading-relaxed group-hover:text-white/75 transition-colors">
                  Я принимаю{' '}
                  <Link
                    to="/terms"
                    className="text-white/90 underline underline-offset-2 decoration-white/30 hover:decoration-white/60"
                  >
                    пользовательское соглашение
                  </Link>
                  {' '}
                  NEIRON
                </span>
              </label>
              <button
                type="button"
                disabled={busy || !emailReady || !canRegister}
                onClick={handleRegister}
                className="w-full rounded-xl bg-white text-black py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {busy ? 'Создаём аккаунт...' : 'Создать аккаунт'}
              </button>
            </>
          )}
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={resetRecovery}
                className="text-left text-xs text-white/45 hover:text-white/85 underline underline-offset-4 decoration-white/20"
              >
                ← Назад к входу
              </button>

              {recoveryStep === 0 ? (
                <>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="Email вашего аккаунта"
                    autoComplete="email"
                    className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <button
                    type="button"
                    disabled={busy || !recoveryEmailReady}
                    onClick={() => void handleRecoveryRequestCode()}
                    className="w-full rounded-xl bg-white text-black py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    Отправить код на почту
                  </button>
                </>
              ) : null}

              {recoveryStep === 1 ? (
                <>
                  <p className="text-xs text-white/50">
                    Укажите код из письма для{' '}
                    <span className="text-white/80">{recoveryEmail.trim()}</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="Код из письма"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !recoveryCodeReady}
                    onClick={() => void handleRecoveryVerifyCode()}
                    className="w-full rounded-xl border border-white/20 text-white/90 hover:bg-white/10 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    Проверить код
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRecoveryRequestCode({ resend: true })}
                    className="w-full rounded-xl border border-white/12 text-white/60 hover:text-white/90 hover:border-white/24 py-2 text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    Отправить код повторно
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRecoveryStep(0)
                      setRecoveryCode('')
                    }}
                    className="text-xs text-white/45 hover:text-white/80 transition-colors text-left"
                  >
                    Другая почта
                  </button>
                </>
              ) : null}

              {recoveryStep === 2 ? (
                <>
                  <p className="text-xs text-white/55">{EMAIL_PASSWORD_REQUIREMENTS_HINT}</p>
                  <input
                    value={recoveryPw}
                    onChange={(e) => setRecoveryPw(e.target.value)}
                    placeholder="Новый пароль"
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <input
                    value={recoveryPw2}
                    onChange={(e) => setRecoveryPw2(e.target.value)}
                    placeholder="Повторите пароль"
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <button
                    type="button"
                    disabled={busy || !recoveryPwReady}
                    onClick={() => void handleRecoverySetPassword()}
                    className="w-full rounded-xl bg-white text-black py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {busy ? 'Сохранение...' : 'Сохранить пароль и войти'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRecoveryStep(0)
                      setRecoveryCode('')
                      setRecoveryTokenRw('')
                      setRecoveryPw('')
                      setRecoveryPw2('')
                    }}
                    className="text-xs text-white/45 hover:text-white/80 transition-colors text-left"
                  >
                    Начать восстановление сначала
                  </button>
                </>
              ) : null}
            </div>
          )}

          {msg ? (
            <p className="text-xs text-center text-emerald-400">{msg}</p>
          ) : null}
          {err ? (
            <p className="text-xs text-center text-red-400">{err}</p>
          ) : null}
        </div>

        <p className="text-xs text-white/20 text-center">
          AI-генерация изображений и видео
        </p>
      </div>
    </div>
  )
}
