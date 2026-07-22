import { useEffect, useCallback, useState, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useTheme, type ThemeColors } from '../lib/theme'
import {
  BILLING_STATUS_LABELS, BILLING_EVENT_LABELS, MONTHLY_CENTS, TOTAL_CYCLES,
  formatCents, outstandingCents, nextPaymentDate, finalPaymentDate, remainingCents,
} from '../lib/billing'

type Account = {
  status: string
  deposit_paid: boolean
  cycles_paid: number
  total_collected_cents: number
  credits_applied_cents: number
  monthly_starts_at: string | null
}

type BillingEvent = {
  id: string
  type: string
  amount_cents: number | null
  notes: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const fmtShortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function BillingScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [yearName, setYearName] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [events, setEvents] = useState<BillingEvent[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: year } = await supabase
      .from('school_years').select('id, name').eq('is_active', true).single()
    setYearName(year?.name ?? null)

    if (!year) { setLoading(false); setRefreshing(false); return }

    const { data: acct } = await supabase
      .from('billing_accounts')
      .select('id, status, deposit_paid, cycles_paid, total_collected_cents, credits_applied_cents, monthly_starts_at')
      .eq('student_id', user.id)
      .eq('school_year_id', year.id)
      .maybeSingle()
    setAccount(acct)

    if (acct) {
      const { data: evs } = await supabase
        .from('billing_events')
        .select('id, type, amount_cents, notes, payment_method, paid_at, created_at')
        .eq('billing_account_id', acct.id)
        .order('created_at', { ascending: false })
      setEvents(evs || [])
    } else {
      setEvents([])
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    )
  }

  const status = account?.status ?? 'pending'
  const owed = account ? outstandingCents(account) : 0
  const nextPayment = account ? nextPaymentDate(account) : null
  const finalPayment = account ? finalPaymentDate(account.monthly_starts_at) : null
  const remaining = account ? remainingCents(account) : 0
  const pill = statusPill(colors, status)

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.text} />}
      >
        <Text style={styles.heading}>Tuition</Text>
        <Text style={styles.subheading}>{yearName ?? 'No active school year'}</Text>

        <View style={styles.section}>
          <View style={styles.statusRow}>
            <Text style={styles.label}>Payment status</Text>
            <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
              <Text style={[styles.pillText, { color: pill.text }]}>{BILLING_STATUS_LABELS[status]}</Text>
            </View>
          </View>

          {status === 'pending' ? (
            <Text style={styles.hint}>Payment setup hasn&apos;t started yet. Contact the school office if you have questions.</Text>
          ) : (
            <View style={styles.dl}>
              <Row label="Deposit" value={account?.deposit_paid ? 'Paid' : 'Not paid'} colors={colors} />
              <Row label="Monthly payments" value={`${account?.cycles_paid ?? 0} of ${TOTAL_CYCLES} paid (${formatCents(MONTHLY_CENTS)} each)`} colors={colors} />
              <Row label="Total paid" value={formatCents(account?.total_collected_cents ?? 0)} colors={colors} />
              {remaining > 0 && <Row label="Remaining this year" value={formatCents(remaining)} colors={colors} />}
              {nextPayment && <Row label="Next payment" value={`${formatCents(MONTHLY_CENTS)} on ${fmtDate(nextPayment)}`} colors={colors} />}
              {finalPayment && status !== 'completed' && <Row label="Final payment" value={fmtDate(finalPayment)} colors={colors} />}
              {owed > 0 && <Row label="Balance due" value={formatCents(owed)} colors={colors} danger />}
            </View>
          )}

          {status === 'paused' && (
            <Text style={styles.warningText}>Your payments are paused. Contact the school office about resuming.</Text>
          )}
          {status === 'overdue' && (
            <Text style={styles.dangerText}>Your last payment didn&apos;t go through. Contact the school office — Stripe will retry automatically.</Text>
          )}
        </View>

        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Payment history</Text>
            <View style={styles.historyList}>
              {events.map(e => (
                <View key={e.id} style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={[styles.historyType, e.type === 'payment_failed' && styles.dangerInline]}>
                      {BILLING_EVENT_LABELS[e.type] ?? e.type}
                      {e.type === 'offline_payment' && (e.payment_method === 'cash' ? ' · Cash' : ' · Check')}
                    </Text>
                    {e.notes && <Text style={styles.historyNotes}>{e.notes}</Text>}
                  </View>
                  <View style={styles.historyRight}>
                    {e.amount_cents != null && <Text style={styles.historyAmount}>{formatCents(e.amount_cents)}</Text>}
                    <Text style={styles.historyDate}>
                      {fmtShortDate((e.type === 'offline_payment' && e.paid_at) ? e.paid_at : e.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footerHint}>
          Questions about your tuition, pauses, or refunds? Contact the school director — billing changes are handled by the school office.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value, colors, danger }: { label: string; value: string; colors: ThemeColors; danger?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, color: colors.textFaint }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: danger ? '700' : '500', color: danger ? colors.danger : colors.text }}>{value}</Text>
    </View>
  )
}

function statusPill(colors: ThemeColors, status: string) {
  switch (status) {
    case 'active':
    case 'completed':
      return { bg: colors.successBg, border: colors.successBorder, text: colors.success }
    case 'paused':
      return { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningStrong }
    case 'overdue':
      return { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger }
    default:
      return { bg: colors.border, border: colors.borderStrong, text: colors.textMuted }
  }
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text },
  subheading: { fontSize: 13, color: colors.textFaint, marginTop: 2, marginBottom: 20 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  dl: { marginTop: 2 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  warningText: { fontSize: 13, color: colors.warningStrong, marginTop: 10, lineHeight: 19 },
  dangerText: { fontSize: 13, color: colors.danger, marginTop: 10, lineHeight: 19 },
  historyList: { marginTop: 8, gap: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  historyLeft: { flex: 1, minWidth: 0 },
  historyType: { fontSize: 13, color: colors.textSecondary },
  dangerInline: { color: colors.danger },
  historyNotes: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  historyRight: { alignItems: 'flex-end', flexShrink: 0 },
  historyAmount: { fontSize: 13, fontWeight: '600', color: colors.text },
  historyDate: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  footerHint: { fontSize: 12, color: colors.textFaint, lineHeight: 17, marginTop: 4 },
})
