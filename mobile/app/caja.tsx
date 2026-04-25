import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { api, type CajaAPI } from '../src/lib/api'

export default function CajaScreen() {
  const [caja, setCaja] = useState<CajaAPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true); setError(null)
    try { setCaja(await api.caja()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
  if (!caja) return null

  return (
    <View style={styles.container}>
      <View style={[styles.badge, caja.turnoActivo ? styles.badgeActive : styles.badgeInactive]}>
        <Text style={styles.badgeText}>{caja.turnoActivo ? 'Turno abierto' : 'Sin turno activo'}</Text>
      </View>

      {caja.turnoActivo && (
        <View style={styles.card}>
          <Row label="Monto apertura" value={`$${caja.montoApertura.toFixed(2)}`} />
          <Row label="Ventas hoy" value={String(caja.ventasHoy)} />
          <Row label="Total hoy" value={`$${caja.totalHoy.toFixed(2)}`} />
        </View>
      )}

      <TouchableOpacity style={styles.btn} onPress={cargar}>
        <Text style={styles.btnText}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
      <Text style={{ color: '#94a3b8', fontSize: 14 }}>{label}</Text>
      <Text style={{ color: '#f8fafc', fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  center: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#ef4444', textAlign: 'center' },
  badge: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
  badgeActive: { backgroundColor: '#064e3b' },
  badgeInactive: { backgroundColor: '#1e293b' },
  badgeText: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  btn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
})
