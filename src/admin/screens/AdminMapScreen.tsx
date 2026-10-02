import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AdminLeafletMap, { type MapArea, type MapFocus, type MapMarker, type MapPoi, type MapStatus } from '../components/AdminLeafletMap';
import AdminPriorityTag from '../components/AdminPriorityTag';
import { priorityTier, useDefects } from '../../api/mockBackend';
import { DEFECT_TYPE_LABELS, SEVERITY_LABELS, type Defect } from '../../api/types';
import { DEMO_FACILITIES, DEMO_FACILITIES_NOTICE } from '../../data/demoFacilities';
import { attentionLevel, useRiskAreas } from '../../services/riskHotspots';
import { FACILITY_RULES } from '../../services/locationContext';

const FACILITY_POIS: MapPoi[] = DEMO_FACILITIES.map((f) => ({
  id: f.id,
  code: FACILITY_RULES[f.category].code,
  name: f.name,
  category: FACILITY_RULES[f.category].label,
  lat: f.latitude,
  lon: f.longitude,
}));

const COLORS = { high: '#B42318', open: '#1D4ED8', repaired: '#98A2B3', review: '#F5B700' };

const isHigh = (d: Defect) => ['Critical', 'High'].includes(priorityTier(d.priority));
const markerColor = (d: Defect) => (d.status === 'REPAIRED' ? COLORS.repaired : isHigh(d) ? COLORS.high : COLORS.open);

export type AdminMapMode = 'DEFECTS' | 'HOTSPOTS';

interface Props {
  onOpenDefect: (id: string) => void;
  onBack?: () => void;
  mode?: AdminMapMode;
  onModeChange?: (mode: AdminMapMode) => void;
  onOpenHotspot?: (id: string) => void;
  /** Defect selected from its detail screen: shown with its individual report positions. */
  focusDefectId?: string | null;
  onClearFocus?: () => void;
}

const toMarker = (d: Defect): MapMarker => ({
  id: d.id,
  label: d.id.slice(-3),
  lat: d.latitude,
  lon: d.longitude,
  color: markerColor(d),
  review: !!d.pendingReviewOf,
  typeLabel: DEFECT_TYPE_LABELS[d.defectType],
  priority: d.priority,
  status: d.status,
});

export default function AdminMapScreen({
  onOpenDefect,
  onBack,
  mode: controlled,
  onModeChange,
  onOpenHotspot,
  focusDefectId,
  onClearFocus,
}: Props) {
  const defects = useDefects();
  const { hotspots } = useRiskAreas();
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [localMode, setLocalMode] = useState<AdminMapMode>('DEFECTS');
  const [showFacilities, setShowFacilities] = useState(false);
  const mode = controlled ?? localMode;
  const setMode = (m: AdminMapMode) => (onModeChange ? onModeChange(m) : setLocalMode(m));

  const focused = focusDefectId ? defects.find((d) => d.id === focusDefectId) ?? null : null;
  const focus: MapFocus | null = useMemo(
    () =>
      focused
        ? {
            id: focused.id,
            lat: focused.latitude,
            lon: focused.longitude,
            points: focused.observations.map((o) => ({
              lat: o.latitude,
              lon: o.longitude,
              accuracy: o.accuracyMeters,
              label: `${o.id} · ${o.duplicateDecision ?? 'DISTINCT'}`,
            })),
          }
        : null,
    [focused],
  );

  const hotspotDefectIds = useMemo(() => new Set(hotspots.flatMap((h) => h.defectIds)), [hotspots]);

  const markers: MapMarker[] = useMemo(
    () =>
      [...defects]
        .filter((d) => mode === 'DEFECTS' || hotspotDefectIds.has(d.id))
        .sort((a, b) => Number(a.status === 'REPAIRED') - Number(b.status === 'REPAIRED') || b.priority - a.priority)
        .map(toMarker),
    [defects, mode, hotspotDefectIds],
  );

  const areas: MapArea[] = useMemo(
    () =>
      mode === 'HOTSPOTS'
        ? hotspots.map((h) => ({
            id: h.id,
            label: `${h.id.slice(-3)} · ${h.attentionScore}`,
            lat: h.latitude,
            lon: h.longitude,
            radius: h.radiusMeters,
            color: attentionLevel(h.attentionScore).color,
            lines: [
              `Attention score ${h.attentionScore} (${attentionLevel(h.attentionScore).label})`,
              `Observed defects ${h.defectCount} · Reports ${h.observationCount}`,
              `Highest severity ${SEVERITY_LABELS[h.highestSeverity]}`,
              `${h.unresolvedCount} unresolved · ${h.repairedCount} repaired`,
            ],
          }))
        : [],
    [hotspots, mode],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.link}>‹ Dashboard</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{mode === 'DEFECTS' ? 'Road Defect Map' : 'Risk Hotspot Map'}</Text>
        <Text style={styles.sub}>
          {mode === 'DEFECTS'
            ? 'All defects · staged demo data on OpenStreetMap'
            : 'Areas with accumulated observed defect evidence — not a prediction'}
        </Text>
        <View style={styles.segment} accessibilityRole="tablist">
          {(['DEFECTS', 'HOTSPOTS'] as AdminMapMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.segmentItem, mode === m && styles.segmentOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
                {m === 'DEFECTS' ? 'Defect Map' : `Risk Hotspots (${hotspots.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => setShowFacilities((s) => !s)}
          style={[styles.layer, showFacilities && styles.layerOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: showFacilities }}
        >
          <Text style={[styles.layerText, showFacilities && { color: '#FFFFFF' }]}>
            {showFacilities ? 'Hide' : 'Show'} critical facilities (DEMO data)
          </Text>
        </Pressable>
        {focused ? (
          <View style={styles.focusBar}>
            <Text style={styles.focusText}>
              Showing {focused.id}: {focused.observations.length} report position{focused.observations.length === 1 ? '' : 's'} with GPS accuracy circles
            </Text>
            {onClearFocus ? (
              <Pressable onPress={onClearFocus} hitSlop={8}>
                <Text style={styles.link}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.map}>
        <AdminLeafletMap
          markers={markers}
          me={null}
          onOpen={onOpenDefect}
          onStatus={setMapStatus}
          areas={areas}
          onOpenArea={onOpenHotspot}
          fitKey={focus ? `focus:${focus.id}` : mode}
          pois={showFacilities ? FACILITY_POIS : []}
          focus={focus}
        />
      </View>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.panelContent}>
          <View style={styles.legend}>
            {mode === 'HOTSPOTS' ? <Legend color="#FFFFFF" ring={attentionLevel(60).color} label="Hotspot area" /> : null}
            <Legend color={COLORS.high} label="High priority" />
            <Legend color={COLORS.open} label="Open" />
            <Legend color="#FFFFFF" ring={COLORS.review} label="Under review" />
            <Legend color={COLORS.repaired} label="Repaired" />
            {focus ? <Legend color="#FFFFFF" ring="#0B1F3A" label="Report position (±GPS)" /> : null}
            {showFacilities ? <Legend color="#344054" square label="Demo facility" /> : null}
          </View>
          {showFacilities ? <Text style={styles.sub}>{DEMO_FACILITIES_NOTICE}</Text> : null}
          {mode === 'HOTSPOTS' ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.sub}>
                {hotspots.length
                  ? 'Tap a hotspot area or a card for its evidence and explanation.'
                  : 'No area currently meets the hotspot criteria.'}
              </Text>
              {hotspots.map((h) => {
                const level = attentionLevel(h.attentionScore);
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => onOpenHotspot?.(h.id)}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.cardId}>{h.id}</Text>
                      <Text style={styles.meta}>
                        {h.defectCount} defects · {h.observationCount} reports · {SEVERITY_LABELS[h.highestSeverity]} severity
                      </Text>
                    </View>
                    <View style={[styles.score, { backgroundColor: level.bg }]}>
                      <Text style={[styles.scoreValue, { color: level.color }]}>{h.attentionScore}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : mapStatus === 'offline' ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Saved defects ({defects.length})</Text>
              {defects.map((d) => (
                <Pressable key={d.id} onPress={() => onOpenDefect(d.id)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardId}>{d.id}</Text>
                    <Text style={styles.meta}>
                      {DEFECT_TYPE_LABELS[d.defectType]} · Evidence {d.observations.length} · {d.status}
                      {d.pendingReviewOf ? ' · REVIEW' : ''}
                    </Text>
                    <Text style={styles.link}>View Details ›</Text>
                  </View>
                  <AdminPriorityTag score={d.priority} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.sub}>Tap a marker for defect details. Pinch or use +/− to zoom.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function Legend({ color, label, ring, square }: { color: string; label: string; ring?: string; square?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }, ring ? { borderWidth: 2, borderColor: ring } : null, square ? { borderRadius: 2 } : null]} />
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
  segment: { flexDirection: 'row', backgroundColor: '#E4E7EC', borderRadius: 10, padding: 3, marginTop: 6 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  segmentOn: { backgroundColor: '#0B1F3A' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#344054' },
  segmentTextOn: { color: '#FFFFFF' },
  layer: { alignSelf: 'flex-start', borderRadius: 14, borderWidth: 1, borderColor: '#344054', paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  layerOn: { backgroundColor: '#344054' },
  layerText: { fontSize: 12, fontWeight: '600', color: '#344054' },
  focusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 8, padding: 8, marginTop: 6 },
  focusText: { flex: 1, fontSize: 12, color: '#1E293B' },
  map: { flex: 1, minHeight: 240, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#0B1F3A' },
  panel: { maxHeight: '34%', backgroundColor: '#F5F6F8' },
  panelContent: { padding: 16, paddingBottom: 24, gap: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#475467' },
  section: { fontSize: 14, fontWeight: '700', color: '#344054' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E4E7EC', padding: 12,
  },
  cardId: { fontSize: 15, fontWeight: '800', color: '#0B1F3A' },
  meta: { fontSize: 12, color: '#475467' },
  score: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  scoreValue: { fontSize: 18, fontWeight: '800' },
});
