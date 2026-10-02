import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import AdminDashboardScreen from '../admin/screens/AdminDashboardScreen';
import AdminDefectListScreen from '../admin/screens/AdminDefectListScreen';
import AdminDefectDetailScreen from '../admin/screens/AdminDefectDetailScreen';
import AdminMapScreen, { type AdminMapMode } from '../admin/screens/AdminMapScreen';
import AdminIdentityComparisonScreen from '../admin/screens/AdminIdentityComparisonScreen';
import AdminTestScreen from '../admin/screens/AdminTestScreen';
import RiskHotspotsScreen from '../admin/screens/RiskHotspotsScreen';
import HotspotDetailScreen from '../admin/screens/HotspotDetailScreen';
import AdminMoreScreen from '../admin/screens/AdminMoreScreen';
import SecurityPrivacyScreen from '../admin/screens/SecurityPrivacyScreen';
import AdminSettingsScreen from '../admin/screens/AdminSettingsScreen';
import BottomTabBar, { type TabItem } from '../components/BottomTabBar';
import { useDefects, type MockUser } from '../api/mockBackend';
import { useRiskAreas } from '../services/riskHotspots';

type Tab = 'DASHBOARD' | 'DEFECTS' | 'MAP' | 'RISK' | 'MORE';

/** Screens pushed on top of the current tab. */
type Screen =
  | { name: 'DETAIL'; id: string }
  | { name: 'HOTSPOT'; id: string }
  | { name: 'IDENTITY_DEMO' }
  | { name: 'TEST' }
  | { name: 'SECURITY' }
  | { name: 'SETTINGS' };

interface Props {
  user: MockUser;
  onLogout: () => void;
}

export default function AdminNavigator({ user, onLogout }: Props) {
  const defects = useDefects();
  const { hotspots } = useRiskAreas();
  const [tab, setTab] = useState<Tab>('DASHBOARD');
  const [stack, setStack] = useState<Screen[]>([]);
  const [mapMode, setMapMode] = useState<AdminMapMode>('DEFECTS');
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const top = stack[stack.length - 1];

  const selectTab = (t: Tab) => {
    setStack([]);
    setTab(t);
  };
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => st.slice(0, -1));
  // Opening a defect from another defect replaces it, as before, so Back returns to the list/map.
  const openDefect = (id: string) =>
    setStack((st) =>
      st[st.length - 1]?.name === 'DETAIL' ? [...st.slice(0, -1), { name: 'DETAIL', id }] : [...st, { name: 'DETAIL', id }],
    );
  const openHotspot = (id: string) => push({ name: 'HOTSPOT', id });
  const showHotspotMap = () => {
    setMapFocus(null);
    setMapMode('HOTSPOTS');
    selectTab('MAP');
  };
  const showDefectOnMap = (id: string) => {
    setMapFocus(id);
    setMapMode('DEFECTS');
    selectTab('MAP');
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) {
        pop();
        return true;
      }
      if (tab !== 'DASHBOARD') {
        setTab('DASHBOARD');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack, tab]);

  const reviewCount = defects.filter((d) => d.pendingReviewOf).length;
  const tabs: TabItem<Tab>[] = [
    { key: 'DASHBOARD', label: 'Dashboard', icon: 'dashboard' },
    { key: 'DEFECTS', label: 'Defects', icon: 'list', badge: reviewCount || undefined },
    { key: 'MAP', label: 'Map', icon: 'map' },
    { key: 'RISK', label: 'Risk', icon: 'risk' },
    { key: 'MORE', label: 'More', icon: 'more' },
  ];

  let screen;
  if (top?.name === 'IDENTITY_DEMO') {
    screen = <AdminIdentityComparisonScreen onBack={pop} onTest={() => push({ name: 'TEST' })} />;
  } else if (top?.name === 'TEST') {
    screen = <AdminTestScreen onBack={pop} />;
  } else if (top?.name === 'SECURITY') {
    screen = <SecurityPrivacyScreen onBack={pop} />;
  } else if (top?.name === 'SETTINGS') {
    screen = <AdminSettingsScreen onBack={pop} />;
  } else if (top?.name === 'HOTSPOT') {
    const hotspot = hotspots.find((h) => h.id === top.id);
    screen = hotspot ? (
      <HotspotDetailScreen hotspot={hotspot} onBack={pop} onOpenDefect={openDefect} onShowOnMap={showHotspotMap} />
    ) : (
      <Missing text="This area no longer meets the hotspot criteria (its defects were repaired, merged or deleted)." onBack={pop} />
    );
  } else if (top?.name === 'DETAIL') {
    const defect = defects.find((d) => d.id === top.id);
    screen = defect ? (
      <AdminDefectDetailScreen defect={defect} adminId={user.id} onBack={pop} onOpenDefect={openDefect} onShowOnMap={showDefectOnMap} />
    ) : (
      <Missing text="This defect record no longer exists (it was merged or deleted)." onBack={pop} />
    );
  } else if (tab === 'DEFECTS') {
    screen = <AdminDefectListScreen onOpenDefect={openDefect} />;
  } else if (tab === 'MAP') {
    screen = (
      <AdminMapScreen
        onOpenDefect={openDefect}
        mode={mapMode}
        onModeChange={(m) => {
          setMapFocus(null);
          setMapMode(m);
        }}
        onOpenHotspot={openHotspot}
        focusDefectId={mapFocus}
        onClearFocus={() => setMapFocus(null)}
      />
    );
  } else if (tab === 'RISK') {
    screen = <RiskHotspotsScreen onOpenHotspot={openHotspot} onOpenDefect={openDefect} onShowOnMap={showHotspotMap} />;
  } else if (tab === 'MORE') {
    screen = (
      <AdminMoreScreen
        user={user}
        onIdentityDemo={() => push({ name: 'IDENTITY_DEMO' })}
        onTests={() => push({ name: 'TEST' })}
        onSecurity={() => push({ name: 'SECURITY' })}
        onSettings={() => push({ name: 'SETTINGS' })}
        onLogout={onLogout}
      />
    );
  } else {
    screen = (
      <AdminDashboardScreen
        onAllDefects={() => selectTab('DEFECTS')}
        onMap={() => {
          setMapFocus(null);
          setMapMode('DEFECTS');
          selectTab('MAP');
        }}
        onRisk={() => selectTab('RISK')}
        onIdentityDemo={() => push({ name: 'IDENTITY_DEMO' })}
        onOpenDefect={openDefect}
        onLogout={onLogout}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>{screen}</View>
      <BottomTabBar tabs={tabs} active={tab} onSelect={selectTab} variant="dark" />
    </View>
  );
}

function Missing({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <View style={styles.missing}>
      <Text style={styles.missingText}>{text}</Text>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6F8' },
  body: { flex: 1 },
  missing: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, backgroundColor: '#F5F6F8' },
  missingText: { fontSize: 15, color: '#475467' },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
});
