export function useExport() {
  function downloadCSV(filename, headers, rows) {
    const bom = '\uFEFF'
    const csvContent =
      bom +
      [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportProductsCSV(products) {
    const headers = ['SKU', 'שם', 'מותג', 'מלאי', 'כמות במארז', 'עלות', 'מוסתר']
    const rows = products.map((p) => [p.sku, p.name, p.brand, p.stockQuantity, p.packageQuantity, p.cost, p.isHidden ? 'כן' : 'לא'])
    downloadCSV(`products-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  function exportOrdersCSV(orders) {
    const headers = ['מזהה', 'חנות', 'תאריך', 'סטטוס', 'הערות']
    const rows = orders.map((o) => [
      o.displayId,
      o.storeName,
      o.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || '',
      o.status,
      o.notes,
    ])
    downloadCSV(`orders-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return { downloadCSV, exportProductsCSV, exportOrdersCSV }
}
