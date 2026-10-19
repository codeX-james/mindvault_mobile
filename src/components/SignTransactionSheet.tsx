import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DEFAULT_NETWORK_PASSPHRASE, signTransactionXdr } from "../api/resources";
import type { ThemeColors } from "../theme";
import { useAppTheme } from "../theme/ThemeProvider";
import { validateStellarSecret } from "../utils/validateStellarSecret";

interface SignTransactionSheetProps {
  visible: boolean;
  unsignedXdr: string;
  networkPassphrase?: string;
  onSigned: (signedXdr: string) => void | Promise<void>;
  onCancel: () => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      gap: 12,
      padding: 20,
      paddingBottom: 32,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.surface,
    },
    label: { color: colors.text, fontSize: 13, fontWeight: "600" },
    network: { color: colors.textMuted, fontSize: 12 },
    warning: { color: colors.warning, backgroundColor: colors.warningBg, padding: 10, borderRadius: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
    },
    invalid: { borderColor: colors.danger },
    error: { color: colors.danger, fontSize: 12 },
    actions: { flexDirection: "row", gap: 8 },
    button: { flex: 1 },
    secondary: { backgroundColor: colors.neutralBg },
    secondaryText: { color: colors.text, textAlign: "center", fontWeight: "600" },
    disabled: { opacity: 0.5 },
  });
}

export function SignTransactionSheet({
  visible,
  unsignedXdr,
  networkPassphrase = DEFAULT_NETWORK_PASSPHRASE,
  onSigned,
  onCancel,
}: SignTransactionSheetProps) {
  const { colors, shared, typography } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [secret, setSecret] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const validation = useMemo(() => validateStellarSecret(secret), [secret]);
  const isNonProduction = /test|future network/i.test(networkPassphrase);

  useEffect(() => {
    if (!visible) {
      setSecret("");
      setTouched(false);
      setBusy(false);
      setSignError(null);
    }
  }, [visible]);

  function cancel() {
    setSecret("");
    setTouched(false);
    onCancel();
  }

  async function sign() {
    setTouched(true);
    if (!validation.isValid || !unsignedXdr) return;

    setBusy(true);
    setSignError(null);
    let signedXdr: string;
    try {
      signedXdr = signTransactionXdr(unsignedXdr, secret, networkPassphrase);
    } catch {
      // e.g. a malformed transaction or a passphrase that doesn't match it.
      setSignError("Couldn't sign this transaction. Check the key and network, then try again.");
      setSecret("");
      setBusy(false);
      return;
    }
    try {
      setSecret("");
      await onSigned(signedXdr);
    } finally {
      setSecret("");
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={typography.heading}>Sign transaction</Text>
          <Text style={styles.network}>Network passphrase: {networkPassphrase}</Text>
          {isNonProduction ? (
            <Text style={styles.warning}>Development/test network — do not use a production account.</Text>
          ) : null}
          <Text style={styles.label}>Stellar secret key</Text>
          <TextInput
            value={secret}
            onChangeText={setSecret}
            onBlur={() => setTouched(true)}
            secureTextEntry
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            placeholder="S…"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Stellar secret key"
            style={[styles.input, touched && !validation.isValid ? styles.invalid : null]}
          />
          {touched && !validation.isValid ? (
            <Text accessibilityRole="alert" style={styles.error}>{validation.errorMessage}</Text>
          ) : null}
          {signError ? (
            <Text accessibilityRole="alert" style={styles.error}>{signError}</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={cancel}
              disabled={busy}
              style={[shared.button, styles.button, styles.secondary]}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void sign()}
              disabled={busy || !validation.isValid}
              style={[shared.button, styles.button, (busy || !validation.isValid) && styles.disabled]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={shared.buttonText}>Sign</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
