import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import HomeScreen from '../citizen/screens/HomeScreen';
import ReportScreen from '../citizen/screens/ReportScreen';
import ReportResultScreen from '../citizen/screens/ReportResultScreen';
import MyReportsScreen from '../citizen/screens/MyReportsScreen';
import DefectScreen from '../citizen/screens/DefectScreen';
import DefectMapScreen from '../citizen/screens/DefectMapScreen';
import ProfileScreen from '../citizen/screens/ProfileScreen';
import PrivacyScreen from '../citizen/screens/PrivacyScreen';
import NotificationsScreen from '../citizen/screens/NotificationsScreen';
import SensorCalibrationScreen from '../citizen/screens/SensorCalibrationScreen';
import BottomTabBar, { type TabItem } from '../components/BottomTabBar';
import { useDefects, type MockUser, type SubmitResult } from '../api/mockBackend';
import { useNotifications } from '../citizen/hooks/useNotifications';

type Tab = 'HOME' | 'REPORT' | 'MY_REPORTS' | 'MAP' | 'PROFILE';

/** Screens pushed on top of the current tab. */
type Screen =
  | { name: 'RESULT'; result: SubmitResult }
  | { name: 'DEFECT'; id: string }
  | { name: 'PRIVACY' }
  | { name: 'NOTIFICATIONS' }
  | { name: 'SENSORS' };

interface Props {
  user: MockUser;
  onLogout: () => void;
}

export default function CitizenNavigator({ user, onLogout }: Props) {
  const defects = useDefects();
  const { unread } = useNotifications(user.id);
  const [tab, setTab] = useState<Tab>('HOME');
  const [stack, setStack] = useState<Screen[]>([]);
  // Unread count at which the banner was dismissed; it reappears when more updates arrive.
  const [bannerDismissedAt, setBannerDismissedAt] = useState(0);
  const top = stack[stack.length - 1];

  const tabs: TabItem<Tab>[] = [
    { key: 'HOME', label: 'Home', icon: 'home' },
    { key: 'REPORT', label: 'Report', icon: 'report' },
    { key: 'MY_REPORTS', label: 'My Reports', icon: 'list' },
    { key: 'MAP', label: 'Map', icon: 'map' },
    { key: 'PROFILE', label: 'Profile', icon: 'profile', badge: unread || undefined },
  ];

  const selectTab = (t: Tab) => {
    setStack([]);
    setTab(t);
  };
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => st.slice(0, -1));
  const openDefect = (id: string) => push({ name: 'DEFECT', id });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Back from a submitted report goes home rather than to an empty report form.
      if (top?.name === 'RESULT') {
        selectTab('HOME');
        return true;
      }
      if (stack.length) {
        pop();
        return true;
      }
      if (tab !== 'HOME') {
        setTab('HOME');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack, tab, top]);

  const myReportCount = defects.filter((d) => d.observations.some((o) => o.reporterId === user.id)).length;

  let screen;
  if (top?.name === 'RESULT') {
    screen = (
      <ReportResultScreen
        result={top.result}
        onOpenDefect={openDefect}
        onMyReports={() => selectTab('MY_REPORTS')}
        onHome={() => selectTab('HOME')}
      />
    );
  } else if (top?.name === 'PRIVACY') {
    screen = <PrivacyScreen onBack={pop} />;
  } else if (top?.name === 'NOTIFICATIONS') {
    screen = <NotificationsScreen userId={user.id} onBack={pop} onOpenDefect={openDefect} />;
  } else if (top?.name === 'SENSORS') {
    screen = <SensorCalibrationScreen onBack={pop} />;
  } else if (top?.name === 'DEFECT') {
    const defect = defects.find((d) => d.id === top.id);
    // A REVIEW defect merged by an authority no longer exists on its own.
    screen = defect ? (
      <DefectScreen defect={defect} onBack={pop} userId={user.id} />
    ) : (
      <View style={styles.missing}>
        <Text style={styles.missingText}>
          {top.id} is no longer a separate record — an authority merged it into another defect or removed it.
        </Text>
        <Pressable onPress={() => selectTab('MY_REPORTS')} hitSlop={8}>
          <Text style={styles.link}>Go to My Reports ›</Text>
        </Pressable>
      </View>
    );
  } else if (tab === 'REPORT') {
    screen = (
      <ReportScreen
        reporterId={user.id}
        onCancel={() => selectTab('HOME')}
        onSubmitted={(result) => push({ name: 'RESULT', result })}
      />
    );
  } else if (tab === 'MY_REPORTS') {
    screen = <MyReportsScreen userId={user.id} onOpenDefect={openDefect} />;
  } else if (tab === 'MAP') {
    screen = <DefectMapScreen onOpenDefect={openDefect} />;
  } else if (tab === 'PROFILE') {
    screen = (
      <ProfileScreen
        user={user}
        onPrivacy={() => push({ name: 'PRIVACY' })}
        onNotifications={() => push({ name: 'NOTIFICATIONS' })}
        onSensors={() => push({ name: 'SENSORS' })}
        onLogout={onLogout}
      />
    );
  } else {
    screen = (
      <HomeScreen
        defects={defects}
        userId={user.id}
        onReport={() => selectTab('REPORT')}
        onOpenDefect={openDefect}
        onMyReports={() => selectTab('MY_REPORTS')}
        onPrivacy={() => push({ name: 'PRIVACY' })}
        myReportCount={myReportCount}
      />
    );
  }

  const showBanner = unread > 0 && unread !== bannerDismissedAt && top?.name !== 'NOTIFICATIONS' && top?.name !== 'RESULT';

  return (
    <View style={styles.root}>
      {showBanner ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Pressable style={{ flex: 1 }} onPress={() => push({ name: 'NOTIFICATIONS' })} hitSlop={6}>
            <Text style={styles.bannerText}>
              {unread} new status update{unread === 1 ? '' : 's'} on your reports · <Text style={styles.bannerLink}>View</Text>
            </Text>
            <Text style={styles.bannerSub}>In-app notification (prototype)</Text>
          </Pressable>
          <Pressable onPress={() => setBannerDismissedAt(unread)} hitSlop={10} accessibilityLabel="Dismiss">
            <Text style={styles.bannerClose}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.body}>{screen}</View>
      <BottomTabBar tabs={tabs} active={tab} onSelect={selectTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6F8' },
  body: { flex: 1 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0B1F3A', paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  bannerLink: { color: '#5EEAD4', fontWeight: '800' },
  bannerSub: { color: '#94A3B8', fontSize: 11 },
  bannerClose: { color: '#CBD5E1', fontSize: 22, fontWeight: '600' },
  missing: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, backgroundColor: '#F5F6F8' },
  missingText: { fontSize: 15, color: '#475467' },
  link: { color: '#1D4ED8', fontSize: 15, fontWeight: '600' },
});
