"use client"

import { useEffect } from "react"

import {
  ATTR_COOKIE,
  ATTR_MAX_AGE,
  encodeUtm,
  readCookie,
  utmFromSearch,
} from "../attribution"

/** Guarda la atribución de primer toque en `fv_attr`. No pinta nada y nunca rompe la página. */
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (readCookie(document.cookie, ATTR_COOKIE) !== null) return
      const utm = utmFromSearch(window.location.search)
      if (!Object.keys(utm).length) return
      document.cookie = `${ATTR_COOKIE}=${encodeUtm(utm)}; Max-Age=${ATTR_MAX_AGE}; Path=/; SameSite=Lax`
    } catch {
      // telemetría: sin cookie no pasa nada
    }
  }, [])
  return null
}
