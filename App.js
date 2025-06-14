import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, ScrollView, Switch, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
const CRC = require('crc-full').CRC;
import { Buffer } from 'buffer';

// Initialize CRC instance
var crcInstance = CRC.default("CRC16_CCITT_FALSE");

// Helper function to create TLV (Tag-Length-Value) strings
function tlv(id, value) {
    const valueStr = String(value);
    const idStr = String(id).padStart(2, '0');
    const lengthStr = String(valueStr.length).padStart(2, '0');
    return idStr + lengthStr + valueStr;
}

// --- Universal PayNow String Generation Logic (from above) ---
function generateUniversalPayNowString(
    proxyIdentifierType,
    proxyValue,
    isAmountEditable,
    merchantName,
    amount,
    expiryDateTimeStr,
    billNumber
) {
    let parts = [];
    parts.push(tlv("00", "01"));
    parts.push(tlv("01", "12"));

    let merchantAccountInfoValue = "";
    merchantAccountInfoValue += tlv("00", "SG.PAYNOW");

    let actualProxyValue = proxyValue;
    if (proxyIdentifierType.toUpperCase() === "UEN") {
        merchantAccountInfoValue += tlv("01", "2");
    } else {
        merchantAccountInfoValue += tlv("01", "0");
        if (!actualProxyValue.startsWith('+65')) {
            actualProxyValue = '+65' + actualProxyValue;
        }
    }
    merchantAccountInfoValue += tlv("02", actualProxyValue);
    merchantAccountInfoValue += tlv("03", isAmountEditable ? "1" : "0");
    parts.push(tlv("26", merchantAccountInfoValue));

    const formattedExpiry = expiryDateTimeStr.replace(/[\/\s:]/g, '') + '00';
    parts.push(tlv("04", formattedExpiry));

    parts.push(tlv("52", "0000"));
    parts.push(tlv("53", "702"));

    const formattedAmount = parseFloat(amount).toFixed(2);
    parts.push(tlv("54", formattedAmount));

    parts.push(tlv("58", "SG"));
    parts.push(tlv("59", merchantName));
    parts.push(tlv("60", "Singapore"));

    if (billNumber && billNumber.trim() !== "") {
        let additionalDataValue = "";
        additionalDataValue += tlv("01", billNumber);
        parts.push(tlv("62", additionalDataValue));
    }

    const stringToCrc = parts.join('');
    const finalStringToCrc = stringToCrc + "6304";

    let crcInterim = crcInstance.compute(Buffer.from(finalStringToCrc, "ascii"));
    let crcHex = crcInterim.toString(16).toUpperCase();
    if (crcHex.length < 4) {
        crcHex = '0'.repeat(4 - crcHex.length) + crcHex;
    }
    return finalStringToCrc + crcHex;
}
// --- End of PayNow Logic ---


export default function App() {
  const [proxyIdentifierType, setProxyIdentifierType] = useState('UEN'); // 'UEN' or 'MOBILE'
  const [proxyValue, setProxyValue] = useState('201107187N'); // UEN or Mobile Number
  const [isAmountEditable, setIsAmountEditable] = useState(true); // Default to true as in original UEN logic

  const [merchantName, setMerchantName] = useState('hi');
  const [amount, setAmount] = useState('5');
  const [expiryDateTime, setExpiryDateTime] = useState('2025/06/19 14:46');
  const [billNumber, setBillNumber] = useState('234');

  const [qrValue, setQrValue] = useState('');

  const handleProxyTypeChange = (type) => {
    setProxyIdentifierType(type);
    // Optionally clear or set default proxyValue when type changes
    if (type === 'UEN') {
        setProxyValue('201107187N'); // Default UEN
    } else {
        setProxyValue(''); // Clear for mobile or set a placeholder
    }
  };

  const handleGenerateQR = () => {
    if (!proxyValue.trim() || !merchantName.trim() || !expiryDateTime.trim()) {
      Alert.alert("Input Error", "Please fill in Proxy Value, Merchant Name, and Expiry.");
      return;
    }
    // Amount must be present if QR is NOT editable
    if (!isAmountEditable && !amount.trim()) {
        Alert.alert("Input Error", "Amount is required if 'Amount Editable' is OFF.");
        return;
    }
    // Amount must be valid if provided
    if (amount.trim() && isNaN(parseFloat(amount))) {
        Alert.alert("Input Error", "Amount must be a valid number.");
        return;
    }
    if (!/^\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}$/.test(expiryDateTime.trim())) {
        Alert.alert("Input Error", "Expiry Date/Time format should be YYYY/MM/DD HH:MM");
        return;
    }

    // Use "0" or "0.00" for amount if it's empty AND editable, otherwise use the entered amount
    const finalAmount = (amount.trim() === "" && isAmountEditable) ? "0.00" : amount.trim();
    if (finalAmount === "" && !isAmountEditable) { // Double check for non-editable
        Alert.alert("Input Error", "Amount cannot be empty if 'Amount Editable' is OFF.");
        return;
    }


    try {
      const finalString = generateUniversalPayNowString(
        proxyIdentifierType,
        proxyValue.trim(),
        isAmountEditable,
        merchantName.trim(),
        finalAmount, // Pass the processed amount
        expiryDateTime.trim(),
        billNumber.trim()
      );
      setQrValue(finalString);
    } catch (error) {
      console.error("Error generating QR string:", error);
      Alert.alert("Error", `Could not generate QR code string. ${error.message}`);
      setQrValue('');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Universal PayNow QR Generator</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Identifier Type:</Text>
        <View style={styles.radioGroup}>
            <Button title="UEN" onPress={() => handleProxyTypeChange('UEN')} color={proxyIdentifierType === 'UEN' ? '#007AFF' : '#AAA'} />
            <View style={{width: 10}}/>
            <Button title="Mobile" onPress={() => handleProxyTypeChange('MOBILE')} color={proxyIdentifierType === 'MOBILE' ? '#007AFF' : '#AAA'} />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{proxyIdentifierType === 'UEN' ? 'UEN:' : 'Mobile Number (e.g., 91234567):'}</Text>
        <TextInput
          style={styles.input}
          value={proxyValue}
          onChangeText={setProxyValue}
          placeholder={proxyIdentifierType === 'UEN' ? 'e.g., 201107187N' : 'e.g., 91234567'}
          keyboardType={proxyIdentifierType === 'MOBILE' ? 'phone-pad' : 'default'}
        />
      </View>

      <View style={styles.inputGroupRow}>
        <Text style={styles.label}>Amount Editable by Payer?</Text>
        <Switch
          value={isAmountEditable}
          onValueChange={setIsAmountEditable}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Merchant Name:</Text>
        <TextInput
          style={styles.input}
          value={merchantName}
          onChangeText={setMerchantName}
          placeholder="e.g., Your Company"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Amount (SGD):</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder={isAmountEditable ? "e.g., 5.00 (Optional if editable)" : "e.g., 5.00 (Required)"}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Expiry Date/Time (YYYY/MM/DD HH:MM):</Text>
        <TextInput
          style={styles.input}
          value={expiryDateTime}
          onChangeText={setExpiryDateTime}
          placeholder="e.g., 2025/06/19 14:46"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bill/Reference Number (Optional):</Text>
        <TextInput
          style={styles.input}
          value={billNumber}
          onChangeText={setBillNumber}
          placeholder="e.g., INV123"
        />
      </View>

      <Button title="Generate PayNow QR" onPress={handleGenerateQR} />

      {qrValue ? (
        <View style={styles.qrDisplaySection}>
          <Text style={styles.qrLabel}>Generated PayNow QR Code:</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={qrValue}
              size={280}
              color="black"
              backgroundColor="white"
            />
          </View>
          <Text style={styles.qrStringLabel}>Raw QR String:</Text>
          <TextInput
            style={[styles.input, styles.qrStringOutput]}
            value={qrValue}
            multiline
            editable={false}
          />
        </View>
      ) : (
        <Text style={styles.placeholderText}>
          Fill in the details and tap "Generate PayNow QR".
        </Text>
      )}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 15,
  },
  inputGroupRow: { // For Switch
    width: '100%',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  radioGroup: { // For UEN/Mobile buttons
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
  },
  qrDisplaySection: {
    marginTop: 25,
    alignItems: 'center',
    width: '100%',
  },
  qrLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  qrContainer: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
  },
  placeholderText: {
    marginTop: 30,
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
  qrStringLabel: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: 'bold',
  },
  qrStringOutput: {
    marginTop: 5,
    backgroundColor: '#eee',
    color: '#555',
    minHeight: 70,
    textAlignVertical: 'top'
  }
});