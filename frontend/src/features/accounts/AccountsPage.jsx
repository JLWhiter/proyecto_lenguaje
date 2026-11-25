import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight, Plus, RotateCw, Wallet } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton, useConfirm, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePeriod } from '../../context/PeriodContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import { accountsApi } from '../../lib/api/accounts'
import { toNumber } from '../../lib/format'
import { DepositDialog, TransferDialog } from '../transactions/TransactionDialogs'
import AccountCard from './AccountCard'
import { AccountBalanceDialog, AccountFormDialog } from './AccountDialogs'
import AccountsSummary from './AccountsSummary'
import { ACCOUNT_MUTATION_TAGS, movementsSearch, useAccounts } from './useAccounts'

const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-200 hover:bg-[#059669]'

export default function AccountsPage() {
  useDocumentTitle('Mis cuentas')
  const { search, defaultPeriod } = usePeriod()
  const { money } = useMoney()
  const { showAmounts } = usePreferences()
  const confirm = useConfirm()
  const toast = useToast()
  const invalidate = useInvalidate()
  const accounts = useAccounts()
  const [dialog, setDialog] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const titleRef = useRef(null)
  const closeDialog = () => setDialog(null)

  const ready = accounts.status === 'ready'
  const accountList = accounts.data?.accounts ?? []
  const isEmpty = ready && accountList.length === 0
  const canTransfer = accountList.length >= 2
  const patrimonio = toNumber(accounts.data?.patrimonio)

  function openTransfer(account, extra = {}) {
    const other = accountList.find((item) => item.id !== account.id)
    setDialog({
      type: 'transfer',
      initialValues: {
        source_account_id: String(account.id),
        ...(other ? { destination_account_id: String(other.id) } : {}),
        ...extra,
      },
    })
  }

  async function requestDelete(account) {
    const balance = toNumber(account.saldo)

    // Regla del backend: solo se elimina con saldo 0. Lo explicamos antes de intentarlo
    // y ofrecemos el camino para dejarlo en 0.
    if (Math.abs(balance) >= 0.005) {
      const moveMoney = canTransfer && balance > 0
      const amountText = showAmounts ? `tiene un saldo de ${money(balance)}` : 'todavía tiene saldo'
      const ok = await confirm({
        title: 'Primero deja el saldo en 0',
        message: `«${account.nombre}» ${amountText}. Solo puedes eliminar una cuenta con saldo 0: ${
          moveMoney ? 'transfiere ese dinero a otra de tus cuentas' : 'actualiza su saldo a 0 si ese dinero ya no existe'
        } y vuelve a intentarlo.`,
        confirmLabel: moveMoney ? 'Transferir saldo' : 'Actualizar saldo',
        cancelLabel: 'Ahora no',
      })
      if (!ok) return
      if (moveMoney) openTransfer(account, { amount: balance.toFixed(2) })
      else setDialog({ type: 'balance', account })
      return
    }

    const ok = await confirm({
      title: `¿Eliminar «${account.nombre}»?`,
      message:
        'Si la cuenta tiene movimientos, se archivará: dejará de aparecer en tus cuentas y en los formularios, pero su historial se conserva. Si no tiene movimientos, se eliminará definitivamente.',
      confirmLabel: 'Eliminar cuenta',
      tone: 'danger',
    })
    if (!ok) return

    setPendingId(account.id)
    try {
      const result = await accountsApi.remove(account.id)
      invalidate(ACCOUNT_MUTATION_TAGS)
      toast.success(
        result?.accion === 'archivada'
          ? `«${account.nombre}» tenía movimientos, así que se archivó. Su historial se conserva.`
          : result?.message || 'Cuenta eliminada.',
      )
      titleRef.current?.focus({ preventScroll: true })
    } catch (error) {
      // Mensaje del backend, p. ej. "Solo puedes eliminar una cuenta con saldo S/ 0.00…".
      toast.error(error?.message || 'No se pudo eliminar la cuenta.')
      invalidate('accounts')
    } finally {
      setPendingId(null)
    }
  }

  function handleAction(type, account) {
    if (type === 'create') setDialog({ type: 'create' })
    else if (type === 'edit') setDialog({ type: 'edit', account })
    else if (type === 'balance') setDialog({ type: 'balance', account })
    else if (type === 'deposit') setDialog({ type: 'deposit', initialValues: { account_id: String(account.id) } })
    else if (type === 'transfer') openTransfer(account)
    else if (type === 'delete') requestDelete(account)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 ref={titleRef} tabIndex={-1} className="text-3xl font-bold text-slate-900 outline-none">
            Mis cuentas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Registra tus cuentas bancarias, billeteras digitales y efectivo. Finova no se conecta a tu banco: el saldo
            cambia con los movimientos que registras.
          </p>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => setDialog({ type: 'create' })}
            className={`${PRIMARY_BUTTON} shrink-0 self-start whitespace-nowrap sm:self-auto`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva cuenta
          </button>
        )}
      </div>

      {accounts.status === 'loading' && <AccountsSkeleton />}

      {accounts.status === 'error' && (
        <ErrorState title="No pudimos cargar tus cuentas" error={accounts.error} onRetry={accounts.reload} />
      )}

      {ready && accounts.error && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>No pudimos actualizar tus cuentas; puede que veas datos de hace un momento.</span>
          <button
            type="button"
            onClick={accounts.reload}
            className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-amber-900 hover:underline"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={Wallet}
          title="Crea tu primera cuenta"
          description="Agrega tu cuenta bancaria, tu billetera digital o el efectivo que tienes a mano con su saldo actual. Después podrás registrar ingresos, gastos y transferencias entre ellas."
          action={
            <button type="button" onClick={() => setDialog({ type: 'create' })} className={PRIMARY_BUTTON}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crear mi primera cuenta
            </button>
          }
          className="py-10"
        />
      )}

      {ready && accountList.length > 0 && (
        <>
          <AccountsSummary data={accounts.data} count={accountList.length} month={defaultPeriod} />

          <section aria-labelledby="accounts-list-title" className="space-y-4">
            <div>
              <h2 id="accounts-list-title" className="text-xl font-bold text-slate-900">
                Tus cuentas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Las cuentas archivadas no aparecen aquí, pero su historial sigue en Movimientos.
              </p>
            </div>
            <ul className="space-y-4">
              {accountList.map((account) => (
                <li key={account.id}>
                  <AccountCard
                    account={account}
                    movementsTo={{ pathname: '/app/movimientos', search: movementsSearch(search, account.id) }}
                    share={patrimonio > 0 ? (Math.max(0, toNumber(account.saldo)) / patrimonio) * 100 : null}
                    canTransfer={canTransfer}
                    busy={pendingId === account.id}
                    onAction={handleAction}
                  />
                </li>
              ))}
            </ul>
          </section>

          <Link
            to={{ pathname: '/app/alertas', search }}
            className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">Ver alertas</span>
              <span className="block text-sm text-slate-500">Revisa los avisos sobre tus presupuestos y movimientos.</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </>
      )}

      {(dialog?.type === 'create' || dialog?.type === 'edit') && <AccountFormDialog account={dialog.account} onClose={closeDialog} />}
      {dialog?.type === 'balance' && <AccountBalanceDialog account={dialog.account} onClose={closeDialog} />}
      {dialog?.type === 'transfer' && <TransferDialog initialValues={dialog.initialValues} onClose={closeDialog} />}
      {dialog?.type === 'deposit' && <DepositDialog initialValues={dialog.initialValues} onClose={closeDialog} />}
    </div>
  )
}

function AccountsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando cuentas">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="mt-4 h-10 w-56 max-w-full" />
            <Skeleton className="mt-3 h-7 w-48 max-w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-3 w-full rounded-full" />
            <Skeleton className="mt-4 h-14 w-full rounded-2xl" />
            <Skeleton className="mt-2 h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
      <Skeleton className="h-6 w-32" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </div>
          <Skeleton className="mt-5 h-8 w-44 max-w-full" />
          <div className="mt-4 grid grid-cols-3 gap-2 sm:flex">
            <Skeleton className="h-14 sm:h-10 sm:w-36" />
            <Skeleton className="h-14 sm:h-10 sm:w-32" />
            <Skeleton className="h-14 sm:h-10 sm:w-32" />
          </div>
        </div>
      ))}
      <span className="sr-only">Cargando cuentas</span>
    </div>
  )
}
