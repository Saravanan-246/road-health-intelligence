import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LeafletDefectMap, { type MapMarker, type MapStatus } from '../components/LeafletDefectMap';
import { useDefects } from '../../api/mockBackend';
import { DEFECT_TYPE_LABELS, type Defect, type LocationFix } from '../../api/types';
import { priorityTier } from '../services/devMock/priorityService';
import { getDeviceLocation } from '../services/locationService';
import { haversineMeters } from '../utils/distance';

const COLORS = { high: '#B42318', open: '#1D4ED8', repaired: '#98A2B3', review: '#F5B700' };

const isHigh = (d: Defect) => ['Critical', 'High'].includes(priorityTier(d.priority));
const markerColor = (d: Defect) => (d.status === 'REPAIRED' ? COLORS.repaired : isHigh(d) ? COLORS.high : COLORS.open);

interface Props {
  onOpenDefect: (id: string) => void;
  /** Omitted when shown as a bottom-navigation tab. */
  onBack?: () => void;
}

export default function DefectMapScreen({ onOpenDefect, onBack }: Props) {
  const defects = useDefects();
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [myFix, setMyFix] = useState<LocationFix | null>(null);
  const [locating, setLocating] = useState(false);

  // Open defects first, then by priority, so a grouped marker shows its most urgent defect.
  const markers: MapMarker[] = useMemo(
    () =>
      [...defects]
        .sort((a, b) => Number(a.status === 'REPAIRED') - Number(b.status === 'REPAIRED') || b.priority - a.priority)
        .map((d) => ({
          id: d.id,
          label: d.id.slice(-3),
          lat: d.latitude,
          lon: d.longitude,
          color: markerColor(d),
          review: !!d.pendingReviewOf,
          typeLabel: DEFECT_TYPE_LABELS[d.defectType],
          priority: d.priority,
          status: d.status,
        })),
    [defects],
  );

  const me =
    myFix?.latitude != null && myFix.longitude != null
      ? { lat: myFix.latitude, lon: myFix.longitude, accuracy: myFix.accuracyMeters }
      : null;
  const nearestKm =
    me && defects.length
      ? Math.min(...defects.map((d) => haversineMeters(me.lat, me.lon, d.latitude, d.longitude))) / 1000
      : null;

  const locate = async () => {
    setLocating(true);
    setMyFix(await getDeviceLocation());
    setLocating(false);
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.link}>‹ Home</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>Road Defect Map</Text>
        <Text style={styles.sub}>Staged demo data plotted on OpenStreetMap — not live government data.</Text>
      </View>

      <View style={styles.map}>
        <LeafletDefectMap markers={markers} me={me} onOpen={onOpenDefect} onStatus={setMapStatus} />
      </View>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.panelContent}>
          <View style={styles.legend}>
            <Legend color={COLORS.high} label="High priority" />
            <Legend color={COLORS.open} label="Open" />
            <Legend color="#FFFFFF" ring={COLORS.review} label="Under review" />
            <Legend color={COLORS.repaired} label="Repaired" />
          </View>

          <Pressable onPress={locate} disabled={locating} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}>
            {locating ? <ActivityIndicator /> : <Text style={styles.btnText}>Show my GPS position</Text>}
          </Pressable>
          {myFix && !me ? (
            <Text style={styles.muted}>Location unavailable{myFix.error ? ` — ${myFix.error}` : ''}.</Text>
          ) : null}
          {me && nearestKm !== null ? (
            <Text style={styles.muted}>
              Blue dot = your device GPS{me.accuracy !== null ? ` (±${Math.round(me.accuracy)} m)` : ''}. Nearest mapped
              defect is {nearestKm < 1 ? `${Math.round(nearestKm * 1000)} m` : `${nearestKm.toFixed(1)} km`} away. Use
              “Fit defects” on the map to return to them.
            </Text>
          ) : null}

          {mapStatus === 'offline' ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Saved defects ({defects.length})</Text>
              {defects.map((d) => (
                <Pressable key={d.id} onPress={() => onOpenDefect(d.id)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardId}>{d.id}</Text>
                    <Text style={styles.muted}>
                      {DEFECT_TYPE_LABELS[d.defectType]} · Priority {d.priority} · {d.observations.length} report
                      {d.observations.length === 1 ? '' : 's'}
                    </Text>
                    <Text style={styles.status}>
                      {d.status}
                      {d.pendingReviewOf ? ' · UNDER REVIEW' : ''}
                    </Text>
                  </View>
                  <Text style={styles.link}>View Details ›</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Tap a marker for defect details. Pinch or use +/− to zoom.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function Legend({ color, label, ring }: { color: string; label: string; ring?: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }, ring ? { borderWidth: 2, borderColor: ring } : null]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 4 },
  link: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#0B1F3A' },
  sub: { fontSize: 12, color: '#667085' },
  map: { flex: 1, minHeight: 240, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D0D5DD' },
  panel: { maxHeight: '34%', backgroundColor: '#F5F6F8' },
  panelContent: { padding: 16, paddingBottom: 24, gap: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#475467' },
  btn: { borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', paddingVertical: 12, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600', color: '#344054' },
  muted: { fontSize: 13, color: '#667085' },
  section: { fontSize: 14, fontWeight: '700', color: '#344054' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 12,
  },
  cardId: { fontSize: 15, fontWeight: '800', color: '#0B1F3A' },
  status: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
});
