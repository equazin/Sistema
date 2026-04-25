import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { api, type ProductoAPI } from '../src/lib/api'

export default function ProductosScreen() {
  const [items, setItems] = useState<ProductoAPI[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const cargar = useCallback(async (q: string, p: number) => {
    setLoading(true); setError(null)
    try {
      const res = await api.productos({ search: q, page: p, limit: 50 })
      setItems(p === 1 ? res.items : (prev) => [...prev, ...res.items])
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar(search, 1) }, [])

  const handleSearch = useCallback((q: string) => {
    setSearch(q); setPage(1)
    if (q.length === 0 || q.length >= 2) cargar(q, 1)
  }, [cargar])

  const handleLoadMore = useCallback(() => {
    if (items.length < total) { const next = page + 1; setPage(next); cargar(search, next) }
  }, [items.length, total, page, search, cargar])

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={handleSearch}
        placeholder="Buscar por nombre o código..."
        placeholderTextColor="#64748b"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={[styles.card, item.stockActual <= item.stockMinimo && styles.cardLow]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              {item.codigoBarras && <Text style={styles.barcode}>{item.codigoBarras}</Text>}
              {item.categoria && <Text style={styles.cat}>{item.categoria}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.precio}>${item.precioVenta.toFixed(2)}</Text>
              <Text style={[styles.stock, item.stockActual <= item.stockMinimo && { color: '#ef4444' }]}>
                Stock: {item.stockActual}
              </Text>
            </View>
          </View>
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator color="#3b82f6" style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin resultados</Text> : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  search: { margin: 16, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', padding: 12, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  cardLow: { borderColor: '#f97316' },
  nombre: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  barcode: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cat: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  precio: { fontSize: 16, fontWeight: '700', color: '#34d399' },
  stock: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  empty: { textAlign: 'center', color: '#64748b', margin: 32 },
  error: { color: '#ef4444', textAlign: 'center', margin: 16 },
})
