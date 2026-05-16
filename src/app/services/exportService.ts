import api from './api'
import { jsPDF } from 'jspdf'

async function downloadBlob(response: any, defaultName: string) {
  const blob = response.data
  const contentDisposition = response.headers['content-disposition'] ?? ''
  const match = /filename\*=UTF-8''(.+)$/.exec(contentDisposition) || /filename="?([^";]+)"?/.exec(contentDisposition)
  const filename = match ? decodeURIComponent(match[1]) : defaultName

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function exportModule(path: string, defaultName: string) {
  try {
    const headers: any = {}
    if (defaultName.toLowerCase().endsWith('.pdf')) headers.Accept = 'application/pdf'
    const response = await api.get(path, { responseType: 'blob', headers })
    await downloadBlob(response, defaultName)
  } catch (error: any) {
    // If endpoint doesn't exist (404), throw a more specific error
    if (error.response?.status === 404) {
      throw new Error('Export endpoint not yet implemented on the backend. Please contact your system administrator.', { cause: error })
    }
    // Re-throw other errors
    throw error
  }
}

function arrayToCsv(data: Record<string, any>[], mime: string): Blob {
  if (!data || data.length === 0) {
    return new Blob([""], { type: mime });
  }

  const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [headers.join(',')].concat(
    data.map((row) => headers.map((h) => escape(row[h] ?? '')).join(',')),
  );

  return new Blob([lines.join('\n')], { type: mime });
}

async function arrayToPdf(data: Record<string, any>[], fileName: string): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const lineHeight = 14
  let y = margin

  // Title
  doc.setFontSize(14)
  doc.text(fileName.replace(/^report-?/, '').replace(/\.pdf$/i, '').toUpperCase(), margin, y)
  y += 24

  doc.setFontSize(10)

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const entries = Object.entries(row)
    for (const [k, v] of entries) {
      const text = `${k}: ${String(v ?? '')}`
      const splitted = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - margin * 2)
      doc.text(splitted, margin, y)
      y += lineHeight * splitted.length
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }
    }

    if (i < data.length - 1) {
      y += lineHeight
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }
    }
  }

  return doc.output('blob')
}

/**
 * Try exporter() (backend blob). On 404 or missing endpoint, fall back to client generator.
 * fallback should return { data: Array<object>, fileName?: string, mime?: string }
 */
export async function safeExport(
  exporter: () => Promise<void>,
  fallback?: () => { data: Record<string, any>[]; fileName?: string; mime?: string },
) {
  try {
    await exporter();
  } catch (error: any) {
    const isNotFound = error?.response?.status === 404 || /export endpoint not yet implemented/i.test(String(error?.message ?? ''));
    if (isNotFound && fallback) {
      const { data, fileName = 'export.csv', mime = 'text/csv;charset=utf-8' } = fallback();
      let blob: Blob;
      if (fileName.toLowerCase().endsWith('.pdf')) {
        blob = await arrayToPdf(data, fileName)
      } else {
        blob = arrayToCsv(data, mime);
      }
      const fakeResponse = { data: blob, headers: { 'content-disposition': `attachment; filename="${fileName}"` } };
      await downloadBlob(fakeResponse, fileName);
      return;
    }

    throw error;
  }
}

export async function exportDashboard(): Promise<void> {
  return exportModule('/export/dashboard', 'dashboard-report.csv')
}

export async function exportProperties(): Promise<void> {
  return exportModule('/export/properties', 'properties.csv')
}

export async function exportTaxCalculations(): Promise<void> {
  return exportModule('/export/tax-calculations', 'tax-calculations.xlsx')
}

export async function exportPayments(): Promise<void> {
  return exportModule('/export/payments', 'payments.csv')
}

export async function exportCompliance(): Promise<void> {
  return exportModule('/export/compliance', 'compliance.csv')
}

export async function exportAuditLogs(): Promise<void> {
  return exportModule('/export/audit-logs', 'audit-logs.csv')
}

export async function exportAuditEntry(id: string | number): Promise<void> {
  return exportModule(`/export/audit-logs/${id}`, `audit-log-${id}.csv`)
}

export async function exportUsers(): Promise<void> {
  return exportModule('/export/users', 'users.csv')
}

export async function exportReporting(reportId: string): Promise<void> {
  // Try explicit PDF endpoint first (some backends expose /reports/{id}.pdf)
  try {
    return await exportModule(`/export/reports/${reportId}.pdf`, `report-${reportId}.pdf`)
  } catch {
    // Fallback to the base reports endpoint
    return exportModule(`/export/reports/${reportId}`, `report-${reportId}.pdf`)
  }
}

export default {
  exportDashboard,
  exportProperties,
  exportTaxCalculations,
  exportPayments,
  exportCompliance,
  exportAuditLogs,
  exportAuditEntry,
  exportUsers,
  exportReporting,
  safeExport,
}
