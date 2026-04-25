import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import { getConfig, saveConfig } from '../src/lib/api'

export default function ConfigScreen() {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getConfig().then(cfg => {
      if (cfg) { setBaseUrl(cfg.baseUrl); setApiKey(cfg.apiKey) }
    })
  }, [])

  async function handleSave() {
    if (!baseUrl.trim() || !apiKey.trim()) { Alert.alert('Error', 'Completar todos los campos'); return }
    setSaving(true)
    try {
      await saveConfig({ baseUrl: baseUrl.trim().replace(/\/$/, ''), apiKey: apiKey.trim() })
      Alert.alert('Guardado', 'Configuración guardada correctamente', [{ text: 'OK', onPress: () => router.back() }])
    } catch {
      Alert.alert('Error', 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conexión al servidor</Text>
      <Text style={styles.hint}>Ingresá la IP local del equipo donde corre Sistema POS, por ejemplo: http://192.168.1.10:3001</Text>
      <View style={styles.field}>
        <Text style={styles.label}>URL base del servidor</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="http://192.168.1.10:3001"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-..."
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          secureTextEntry
        />
      </View>
      <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc', marginBottom: 8 },
  hint: { fontSize: 13, color: '#94a3b8', marginBottom: 24, lineHeight: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#cbd5e1', marginBottom: 8 },
  input: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', padding: 14, fontSize: 14 },
  btn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
