import { useEffect, useState } from 'react'
import { View, Text, FlatList, Switch, StyleSheet, ActivityIndicator } from 'react-native'
import { api, type StockAPI } from '../src/lib/api'

export default function StockScreen() {
  const [items, setItems] = useState<StockAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [soloBajos, setSoloBajos] = useState(false)

  async function cargar(bajo: boolean) {
    setLoading(true); setError(null)
    try { const res = await api.stock({ soloStockBajo: bajo }); setItems(res.items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar(false) }, [])

  const handleToggle = (v: boolean) => { setSoloBajos(v); cargar(v) }

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <Text style={styles.toggleLabel}>Solo stock bajo mínimo</Text>
        <Switch value={soloBajos} onValueChange={handleToggle} trackColor={{ true: '#3b82f6' }} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ margin: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <View style={[styles.card, item.bajoMinimo && styles.cardBajo]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                {item.codigoBarras && <Text style={styles.barcode}>{item.codigoBarras}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.stock, item.bajoMinimo && { color: '#ef4444' }]}>
                  {item.stockActual}
                </Text>
                <Text style={styles.minimo}>mín: {item.stockMinimo}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin productos</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, padding: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  toggleLabel: { color: '#f8fafc', fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  cardBajo: { borderColor: '#ef4444' },
  nombre: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  barcode: { fontSize: 12, color: '#64748b', marginTop: 2 },
  stock: { fontSize: 18, fontWeight: '700', color: '#34d399' },
  minimo: { fontSize: 11, color: '#64748b' },
  empty: { textAlign: 'center', color: '#64748b', margin: 32 },
  error: { color: '#ef4444', textAlign: 'center', margin: 16 },
})
