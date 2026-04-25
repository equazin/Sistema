import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { api, type VentaAPI } from '../src/lib/api'

export default function VentasScreen() {
  const [items, setItems] = useState<VentaAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.ventas({ limit: 100 })
      .then(res => { setItems(res.items); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Error'); setLoading(false) })
  }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.id}>Venta #{item.id}</Text>
              <Text style={styles.fecha}>{new Date(item.fecha).toLocaleString('es-AR')}</Text>
              <Text style={[styles.estado, item.estado === 'completada' ? styles.estadoOk : styles.estadoMal]}>
                {item.estado}
              </Text>
            </View>
            <Text style={styles.total}>${item.total.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin ventas</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  id: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
  fecha: { fontSize: 12, color: '#64748b', marginTop: 2 },
  estado: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  estadoOk: { color: '#34d399' },
  estadoMal: { color: '#f97316' },
  total: { fontSize: 18, fontWeight: '700', color: '#34d399' },
  empty: { textAlign: 'center', color: '#64748b', margin: 32 },
  error: { color: '#ef4444', textAlign: 'center' },
})
