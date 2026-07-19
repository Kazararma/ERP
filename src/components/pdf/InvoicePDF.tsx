// @ts-nocheck
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Order, OrderAllocation } from '@/types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3730a3',
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 10,
    color: '#6b7280',
  },
  value: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 5,
    marginBottom: 5,
  },
  col1: { width: '40%' },
  col2: { width: '20%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '20%', textAlign: 'right' },
  tableColHeader: { fontSize: 10, fontWeight: 'bold' },
  tableCell: { fontSize: 10 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 20,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3730a3',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  }
});

interface InvoicePDFProps {
  order: Order;
  allocations?: OrderAllocation[];
}

export const InvoicePDF: React.FC<InvoicePDFProps> = ({ order, allocations = [] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.subtitle}>Order ID: {order.orderId}</Text>
          <Text style={styles.subtitle}>Date: {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString()}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Rice Merchant ERP</Text>
          <Text style={styles.subtitle}>123 Business Road</Text>
          <Text style={styles.subtitle}>City, State 12345</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill To:</Text>
        <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>{order.customerName}</Text>
        {order.status === 'delivered' && (
          <Text style={{ fontSize: 10, color: '#166534', backgroundColor: '#dcfce7', padding: 3, width: 60, textAlign: 'center' }}>PAID</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Volume:</Text>
          <Text style={styles.value}>
            {(order as any).totalQuantityQuintal !== undefined ? `${(order as any).totalQuantityQuintal} Quintal` : `${(order.totalWeightKg / 100).toFixed(2)} Quintal`} ({order.totalWeightKg} kg)
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Avg. Rate per Quintal:</Text>
          <Text style={styles.value}>Rs. {((order as any).sellingPricePerQuintal || (order.totalRevenue / (order.totalWeightKg / 100))).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.tableColHeader]}>Description</Text>
            <Text style={[styles.col2, styles.tableColHeader]}>Quantity</Text>
            <Text style={[styles.col3, styles.tableColHeader]}>Avg Rate</Text>
            <Text style={[styles.col4, styles.tableColHeader]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.col1, styles.tableCell]}>Rice - Order {order.orderId.slice(-6)}</Text>
            <Text style={[styles.col2, styles.tableCell]}>
              {(order as any).totalQuantityQuintal !== undefined ? (order as any).totalQuantityQuintal : (order.totalWeightKg / 100).toFixed(2)} Qtl
            </Text>
            <Text style={[styles.col3, styles.tableCell]}>Rs. {((order as any).sellingPricePerQuintal || (order.totalRevenue / (order.totalWeightKg / 100))).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
            <Text style={[styles.col4, styles.tableCell]}>Rs. {(order.totalRevenue || 0).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total:</Text>
          <Text style={styles.totalValue}>Rs. {(order.totalRevenue || 0).toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Thank you for your business!</Text>
        <Text>This is a computer generated document. No signature is required.</Text>
      </View>
    </Page>
  </Document>
);
