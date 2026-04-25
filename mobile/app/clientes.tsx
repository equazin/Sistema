import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, Switch, StyleSheet, ActivityIndicator } from 'react-native'
import { api, type ClienteAPI } from '../src/lib/api'

export default function ClientesScreen() {
  const [items, setItems] = useState<ClienteAPI[]>([])
  const [search, setSearch] = useState('')
  const [conDeuda, setConDeuda] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (q: string, deuda: boolean) => {
    setLoading(true); setError(null)
    try { const res = await api.clientes({ search: q, conDeuda: deuda }); setItems(res.items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar('', false) }, [])

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={(q) => { setSearch(q); cargar(q, conDeuda) }}
        placeholder="Buscar cliente..."
        placeholderTextColor="#64748b"
      />
      <View style={styles.toggle}>
        <Text style={styles.toggleLabel}>Solo con deuda</Text>
        <Switch value={conDeuda} onValueChange={(v) => { setConDeuda(v); cargar(search, v) }} trackColor={{ true: '#ef4444' }} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ margin: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <View style={[styles.card, item.saldoCuentaCorriente > 0 && styles.cardDeuda]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                {item.cuitDni && <Text style={styles.cuit}>{item.cuitDni}</Text>}
                {item.telefono && <Text style={styles.tel}>{item.telefono}</Text>}
              </View>
              {item.saldoCuentaCorriente > 0 && (
                <Text style={styles.saldo}>Debe ${item.saldoCuentaCorriente.toFixed(2)}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin resultados</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  search: { margin: 16, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', padding: 12, fontSize: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8, padding: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  toggleLabel: { color: '#f8fafc', fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  cardDeuda: { borderColor: '#ef4444' },
  nombre: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  cuit: { fontSize: 12, color: '#64748b', marginTop: 2 },
  tel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  saldo: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  empty: { textAlign: 'center', color: '#64748b', margin: 32 },
  error: { color: '#ef4444', textAlign: 'center', margin: 16 },
})
