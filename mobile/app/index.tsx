import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { api, getConfig } from '../src/lib/api'

export default function HomeScreen() {
  const [estado, setEstado] = useState<'loading' | 'ok' | 'sin_config' | 'error'>('loading')
  const [datos, setDatos] = useState<{ status: string; version: string } | null>(null)

  useEffect(() => {
    async function check() {
      const cfg = await getConfig()
      if (!cfg) { setEstado('sin_config'); return }
      try {
        const health = await api.health()
        setDatos(health)
        setEstado('ok')
      } catch {
        setEstado('error')
      }
    }
    check()
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sistema POS</Text>
      <Text style={styles.subtitle}>Panel mobile</Text>

      {estado === 'loading' && <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 24 }} />}

      {estado === 'sin_config' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sin configurar</Text>
          <Text style={styles.cardText}>Ingresá la IP y la API key del sistema de escritorio.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/config')}>
            <Text style={styles.btnText}>Configurar conexión</Text>
          </TouchableOpacity>
        </View>
      )}

      {estado === 'ok' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conectado</Text>
          <Text style={styles.cardText}>Sistema v{datos?.version} — online</Text>
        </View>
      )}

      {estado === 'error' && (
        <View style={[styles.card, { borderColor: '#ef4444' }]}>
          <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Sin conexión</Text>
          <Text style={styles.cardText}>No se pudo contactar al servidor. Verificá la IP y el puerto.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/config')}>
            <Text style={styles.btnText}>Editar configuración</Text>
          </TouchableOpacity>
        </View>
      )}

      {estado === 'ok' && (
        <View style={styles.menu}>
          {[
            { label: 'Productos', path: '/productos' },
            { label: 'Caja', path: '/caja' },
            { label: 'Stock', path: '/stock' },
            { label: 'Clientes', path: '/clientes' },
            { label: 'Ventas', path: '/ventas' },
          ].map(({ label, path }) => (
            <TouchableOpacity key={path} style={styles.menuItem} onPress={() => router.push(path as never)}>
              <Text style={styles.menuText}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: '#475569' }]} onPress={() => router.push('/config')}>
            <Text style={styles.menuText}>Configuración</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: '#334155', marginBottom: 24 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  btn: { marginTop: 16, backgroundColor: '#3b82f6', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  menu: { width: '100%', gap: 10 },
  menuItem: { backgroundColor: '#1e40af', borderRadius: 12, padding: 16, alignItems: 'center' },
  menuText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
