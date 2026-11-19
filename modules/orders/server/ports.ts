/**
 * What orders needs from `catalog`, `payments` and `notifications`, behind a
 * small interface so server/lifecycle.ts can be driven by fakes in the
 * database tests. The defaults call those modules' `contracts/` (the only
 * thing a module may import from another).
 */
import type { Kysely } from "kysely"

import {
  getSellableItems,
  releaseStock,
  reserveStock,
  type SellableItem,
  type StockLine,
} from "@/modules/catalog/contracts"
import {
  OrderAlreadyPaidError,
  OrderHasActivePaymentError,
  cancelPayment,
  getPaymentByOrder,
  startCheckout,
  syncPayment,
  type CheckoutInput,
  type PaymentRecord,
} from "@/modules/payments/contracts"
import type { Database } from "@/server/db/schema"

import type { Order, PaymentView } from "../contracts/types"
import { notifyPaid } from "./notify"

type TxOpts = { db?: Kysely<Database> }

export type StartCheckoutResult =
  | { kind: "ok"; paymentId: string; url: string }
  | { kind: "already_paid" }
  | { kind: "conflict" }

export type OrdersPorts = {
  getSellableItems(ids: readonly string[], opts?: TxOpts): Promise<SellableItem[]>
  /** Throws catalog's StockError (lifecycle maps it to OrderError). */
  reserveStock(input: { ref: string; lines: readonly StockLine[]; createdBy?: string | null }, opts?: TxOpts): Promise<unknown>
  releaseStock(input: { ref: string; createdBy?: string | null; note?: string | null }, opts?: TxOpts): Promise<unknown>
  getPaymentByOrder(orderId: string): Promise<PaymentView | null>
  cancelPayment(paymentId: string): Promise<boolean>
  /** Asks the provider (network). Throws when it cannot. */
  syncPayment(paymentId: string, providerRef?: string): Promise<PaymentView>
  startCheckout(input: CheckoutInput): Promise<StartCheckoutResult>
  /** Best effort, after commit. Never throws. */
  onPaid(order: Order): Promise<void>
}

const toView = (p: PaymentRecord): PaymentView => ({
  id: p.id,
  orderId: p.orderId,
  status: p.status,
  amountMinor: p.amountMinor,
  currency: p.currency,
})

export const defaultPorts: OrdersPorts = {
  getSellableItems: (ids, opts) => getSellableItems(ids, opts),
  reserveStock: (input, opts) => reserveStock(input, opts),
  releaseStock: (input, opts) => releaseStock(input, opts),
  getPaymentByOrder: async (orderId) => {
    const p = await getPaymentByOrder(orderId)
    return p ? toView(p) : null
  },
  cancelPayment: (paymentId) => cancelPayment(paymentId),
  syncPayment: async (paymentId, providerRef) => toView(await syncPayment(paymentId, providerRef)),
  startCheckout: async (input) => {
    try {
      const r = await startCheckout(input)
      return { kind: "ok", paymentId: r.paymentId, url: r.url }
    } catch (e) {
      if (e instanceof OrderAlreadyPaidError) return { kind: "already_paid" }
      if (e instanceof OrderHasActivePaymentError) return { kind: "conflict" }
      throw e
    }
  },
  onPaid: (order) => notifyPaid(order),
}
