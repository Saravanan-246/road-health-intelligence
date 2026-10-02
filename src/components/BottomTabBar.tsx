import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type TabIconName = 'home' | 'report' | 'list' | 'map' | 'profile' | 'dashboard' | 'risk' | 'more';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon: TabIconName;
  badge?: number;
}

interface Props<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  variant?: 'light' | 'dark';
}

const PALETTE = {
  light: { bg: '#FFFFFF', border: '#E4E7EC', idle: '#667085', active: '#1D4ED8' },
  dark: { bg: '#0B1F3A', border: '#1E3A5F', idle: '#94A3B8', active: '#5EEAD4' },
};

/** Fixed bottom navigation. Hidden while the Android keyboard is open so it never covers inputs. */
export default function BottomTabBar<K extends string>({ tabs, active, onSelect, variant = 'light' }: Props<K>) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboard) return null;
  const p = PALETTE[variant];

  return (
    <View
      style={[styles.bar, { backgroundColor: p.bg, borderTopColor: p.border, paddingBottom: Math.max(insets.bottom, 6) }]}
      accessibilityRole="tablist"
    >
      {tabs.map((t) => {
        const on = t.key === active;
        const color = on ? p.active : p.idle;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.badge ? `${t.label}, ${t.badge}` : t.label}
          >
            <View style={[styles.indicator, on && { backgroundColor: p.active }]} />
            <View>
              <TabIcon name={t.icon} color={color} />
              {t.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.badge > 99 ? '99+' : t.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }, on && styles.labelOn]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Simple geometric glyphs drawn with Views (22 × 22). */
export function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  const line = { backgroundColor: color, borderRadius: 1 };
  const ring = { borderColor: color, borderWidth: 2 };
  let glyph;
  switch (name) {
    case 'home':
      glyph = (
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.roof, { borderBottomColor: color }]} />
          <View style={[{ width: 14, height: 9, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }, ring]} />
        </View>
      );
      break;
    case 'report':
      glyph = (
        <View style={[{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, ring]}>
          <View style={[{ width: 10, height: 2, position: 'absolute' }, line]} />
          <View style={[{ width: 2, height: 10, position: 'absolute' }, line]} />
        </View>
      );
      break;
    case 'list':
      glyph = (
        <View style={{ gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={[{ width: 3, height: 3 }, line]} />
              <View style={[{ width: 13, height: 2 }, line]} />
            </View>
          ))}
        </View>
      );
      break;
    case 'map':
      glyph = (
        <View style={[styles.pin, ring]}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
        </View>
      );
      break;
    case 'profile':
      glyph = (
        <View style={{ alignItems: 'center', gap: 1 }}>
          <View style={[{ width: 9, height: 9, borderRadius: 5 }, ring]} />
          <View style={[{ width: 16, height: 7, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomWidth: 0 }, ring]} />
        </View>
      );
      break;
    case 'dashboard':
      glyph = (
        <View style={{ width: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[{ width: 8, height: 8, borderRadius: 2 }, ring]} />
          ))}
        </View>
      );
      break;
    case 'risk':
      glyph = (
        <View style={[{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, ring]}>
          <View style={[{ width: 10, height: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }, ring]}>
            <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          </View>
        </View>
      );
      break;
    default:
      glyph = (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
          ))}
        </View>
      );
  }
  return <View style={styles.icon}>{glyph}</View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 0 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 6, gap: 3, minHeight: 52 },
  indicator: { height: 2, width: 28, borderRadius: 1, marginBottom: 4, backgroundColor: 'transparent' },
  label: { fontSize: 11, fontWeight: '500' },
  labelOn: { fontWeight: '700' },
  icon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  roof: {
    width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  pin: {
    width: 15, height: 15, borderRadius: 8, borderBottomRightRadius: 0, transform: [{ rotate: '45deg' }],
    alignItems: 'center', justifyContent: 'center', marginTop: -3,
  },
  badge: {
    position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
