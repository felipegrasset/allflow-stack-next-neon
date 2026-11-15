"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { SUBSCRIBE_PATH, SW_PATH, SW_SCOPE } from "../server/sw-script"

type State = "checking" | "unsupported" | "denied" | "off" | "on" | "working"
type Problem = "error" | "endpointNotAllowed" | null

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false
  const v = new Uint8Array(a)
  return v.every((x, i) => x === b[i])
}

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window

async function send(method: "POST" | "DELETE", body: unknown): Promise<Response> {
  return fetch(SUBSCRIBE_PATH, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * Turns web push on or off for THIS browser: registers the module's service
 * worker (/api/push/sw, scope /api/push/), asks the browser for permission,
 * subscribes with the app's VAPID public key and stores the subscription
 * through /api/push/subscribe. Turning off unsubscribes and deletes the row.
 */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [state, setState] = useState<State>("checking")
  const [problem, setProblem] = useState<Problem>(null)
  const [wasOn, setWasOn] = useState(false)

  const current = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
    return (await reg?.pushManager.getSubscription()) ?? null
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      if (!supported()) return alive && setState("unsupported")
      if (Notification.permission === "denied") return alive && setState("denied")
      try {
        const sub = await current()
        // A subscription made with an older key cannot receive our pushes.
        const on = !!sub && sameKey(sub.options.applicationServerKey, keyBytes(publicKey))
        if (alive) {
          setState(on ? "on" : "off")
          setWasOn(on)
        }
      } catch {
        if (alive) setState("off")
      }
    })()
    return () => {
      alive = false
    }
  }, [current, publicKey])

  const enable = async () => {
    setProblem(null)
    setState("working")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off")
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
      await navigator.serviceWorker.ready.catch(() => undefined)
      const key = keyBytes(publicKey)
      let sub = await reg.pushManager.getSubscription()
      if (sub && !sameKey(sub.options.applicationServerKey, key)) {
        await sub.unsubscribe()
        sub = null
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      const res = await send("POST", sub.toJSON())
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        await sub.unsubscribe().catch(() => undefined)
        setProblem(err.error === "endpoint_not_allowed" ? "endpointNotAllowed" : "error")
        return setState("off")
      }
      setState("on")
      setWasOn(true)
      router.refresh()
    } catch {
      setProblem("error")
      setState("off")
    }
  }

  const disable = async () => {
    setProblem(null)
    setState("working")
    try {
      const sub = await current()
      if (sub) {
        await send("DELETE", { endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setState("off")
      setWasOn(false)
      router.refresh()
    } catch {
      setProblem("error")
      setState("on")
    }
  }

  if (state === "checking") return <p className="text-sm text-muted-foreground">{copy.toggle.checking}</p>
  if (state === "unsupported") return <FormAlert>{copy.toggle.unsupported}</FormAlert>
  if (state === "denied") return <FormAlert>{copy.toggle.denied}</FormAlert>

  const on = state === "on" || (state === "working" && wasOn)
  return (
    <div className="flex flex-col items-start gap-3">
      {problem ? <FormAlert>{problem === "endpointNotAllowed" ? copy.toggle.endpointNotAllowed : copy.toggle.error}</FormAlert> : null}
      <p role="status" className="text-sm text-muted-foreground">
        {on ? copy.toggle.enabled : copy.toggle.disabled}
      </p>
      <SubmitButton
        type="button"
        variant={on ? "outline" : "default"}
        pending={state === "working"}
        label={on ? copy.toggle.disable : copy.toggle.enable}
        pendingLabel={on ? copy.toggle.disabling : copy.toggle.enabling}
        onClick={() => void (on ? disable() : enable())}
      />
    </div>
  )
}
