"use client"

import { useState, useTransition } from "react"
import { UserPlusIcon, UsersIcon } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { profileCopy } from "@/lib/copy/profile"
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/schemas/profile"
import { removeMemberAction, updateMemberRoleAction } from "./actions"

export type MemberRow = {
  id: string
  userId: string
  role: string
  name: string
  email: string
  image: string | null
}

type Confirm = { kind: "demote"; row: MemberRow; role: AssignableRole } | { kind: "remove"; row: MemberRow }

const c = profileCopy.adminUsers
const roleLabel = (role: string) => c.roles[role] ?? role

export function UsersTable({ rows, currentUserId }: { rows: MemberRow[]; currentUserId: string }) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const others = rows.filter((r) => r.userId !== currentUserId)

  const apply = (row: MemberRow, action: () => Promise<{ ok: boolean; formError?: string }>, success: string) => {
    setBusyId(row.id)
    startTransition(async () => {
      const res = await action()
      setBusyId(null)
      if (res.ok) toast.add({ title: success, type: "success" })
      else toast.add({ title: res.formError ?? c.failed, type: "error" })
    })
  }

  const changeRole = (row: MemberRow, role: AssignableRole) => {
    if (role === row.role) return
    // Demoting an admin is destructive: confirm first. Promoting isn't.
    if (row.role === "admin" && role !== "admin") return setConfirm({ kind: "demote", row, role })
    apply(row, () => updateMemberRoleAction({ memberId: row.id, role }), c.roleChanged(row.name, roleLabel(role)))
  }

  const onConfirm = () => {
    if (!confirm) return
    const { row } = confirm
    setConfirm(null)
    if (confirm.kind === "demote") {
      const role = confirm.role
      apply(row, () => updateMemberRoleAction({ memberId: row.id, role }), c.roleChanged(row.name, roleLabel(role)))
    } else {
      apply(row, () => removeMemberAction({ memberId: row.id }), c.removed(row.name))
    }
  }

  const copySignupLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/signup`)
      toast.add({ title: c.linkCopied, type: "success" })
    } catch {
      toast.add({ title: `${location.origin}/signup` })
    }
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableCaption className="sr-only">{c.tableCaption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{c.colUser}</TableHead>
              <TableHead>{c.colRole}</TableHead>
              <TableHead className="text-right">{c.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const self = row.userId === currentUserId
              const busy = isPending && busyId === row.id
              const assignable = (ASSIGNABLE_ROLES as readonly string[]).includes(row.role)
              return (
                <TableRow key={row.id} data-testid="member-row" data-email={row.email} aria-busy={busy || undefined}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={row.name} image={row.image} />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 font-medium">
                          {row.name}
                          {self && <Badge variant="secondary">{c.you}</Badge>}
                        </span>
                        <span className="truncate text-muted-foreground">{row.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {self || !assignable ? (
                      <span data-testid="member-role">{roleLabel(row.role)}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <NativeSelect
                          size="sm"
                          aria-label={c.roleSelectLabel(row.name)}
                          value={row.role}
                          disabled={busy}
                          onChange={(e) => changeRole(row, e.target.value as AssignableRole)}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <NativeSelectOption key={r} value={r}>
                              {roleLabel(r)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        {busy && <Spinner aria-hidden />}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!self && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={c.removeLabel(row.name)}
                        onClick={() => setConfirm({ kind: "remove", row })}
                      >
                        {c.remove}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {others.length === 0 && (
        <Empty className="border" data-testid="users-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>
              <h2 className="text-base font-medium">{c.emptyTitle}</h2>
            </EmptyTitle>
            <EmptyDescription>{c.emptyDescription}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={copySignupLink}>
              <UserPlusIcon aria-hidden />
              {c.emptyCta}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirm.kind === "demote" ? c.demoteTitle(confirm.row.name) : c.removeTitle(confirm.row.name)}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.kind === "demote" ? c.demoteDescription : c.removeDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{profileCopy.common.cancel}</AlertDialogCancel>
                <Button variant="destructive" onClick={onConfirm}>
                  {confirm.kind === "demote" ? c.demoteAction : c.removeAction}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
