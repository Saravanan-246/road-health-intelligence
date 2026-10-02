import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function IssueSubmittedModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Issue submitted</Text>
          <Text style={styles.body}>Your report has been flagged for admin review.</Text>

          <View style={styles.status}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue}>Under review</Text>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  body: {
    fontSize: 14,
    color: '#667085',
  },
  status: {
    backgroundColor: '#E6F4F1',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F766E',
  },
  button: {
    backgroundColor: '#0B1F3A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
