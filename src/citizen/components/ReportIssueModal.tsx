import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ISSUE_DETAILS_MAX_LENGTH } from '../../api/mockBackend';
import { CITIZEN_ISSUE_LABELS, type CitizenIssueType } from '../../api/types';

const ISSUE_TYPES: CitizenIssueType[] = [
  'WRONG_DEFECT_TYPE',
  'WRONG_LOCATION',
  'INCORRECT_SEVERITY',
  'INCORRECT_IMAGE',
  'DUPLICATE_REPORT',
  'OTHER',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (issueType: CitizenIssueType, details: string) => void;
}

export default function ReportIssueModal({ visible, onClose, onSubmit }: Props) {
  const [selectedType, setSelectedType] = useState<CitizenIssueType | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Details are optional except for "Other", where the category alone says nothing.
  const detailsRequired = selectedType === 'OTHER';

  const reset = () => {
    setSelectedType(null);
    setDetails('');
  };

  const handleSubmit = () => {
    if (!selectedType || (detailsRequired && !details.trim())) return;
    setSubmitting(true);
    try {
      onSubmit(selectedType, details.trim());
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  const canSubmit = selectedType !== null && (!detailsRequired || details.trim().length > 0) && !submitting;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.center}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modal}>
            <Text style={styles.title}>Report an issue</Text>
            <Text style={styles.subtitle}>
              Tell us what is incorrect. Your original report is not changed or deleted — the issue is sent to the
              authority for review.
            </Text>

            <Text style={styles.label}>Issue type</Text>
            <View style={styles.options}>
              {ISSUE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setSelectedType(type)}
                  style={[
                    styles.option,
                    selectedType === type && styles.optionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedType === type && styles.optionTextSelected,
                    ]}
                  >
                    {CITIZEN_ISSUE_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Additional details{detailsRequired ? ' (required)' : ' (optional)'}</Text>
            <TextInput
              style={styles.input}
              placeholder={detailsRequired ? 'Describe the issue' : 'Explain what is incorrect (optional)'}
              placeholderTextColor="#98A2B3"
              multiline
              numberOfLines={4}
              value={details}
              onChangeText={setDetails}
              maxLength={ISSUE_DETAILS_MAX_LENGTH}
            />
            <Text style={styles.counter}>
              {details.length}/{ISSUE_DETAILS_MAX_LENGTH}
            </Text>

            <View style={styles.buttons}>
              <Pressable
                onPress={close}
                style={({ pressed }) => [styles.btnCancel, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.btnSubmit,
                  !canSubmit && styles.btnDisabled,
                  pressed && !canSubmit ? {} : pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.btnSubmitText,
                    !canSubmit && styles.btnDisabledText,
                  ]}
                >
                  {submitting ? 'Submitting…' : 'Submit issue'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
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
  subtitle: {
    fontSize: 14,
    color: '#667085',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475467',
    marginTop: 4,
  },
  options: {
    gap: 8,
  },
  option: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  optionText: {
    fontSize: 14,
    color: '#344054',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    padding: 12,
    fontSize: 14,
    color: '#101828',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 11,
    color: '#98A2B3',
    textAlign: 'right',
    marginTop: -10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
  },
  btnSubmit: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#0B1F3A',
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnDisabledText: {
    color: '#98A2B3',
  },
});
