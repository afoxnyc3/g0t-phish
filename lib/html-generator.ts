// lib/html-generator.ts
import { EmailAnalysis } from '@/types/email';

/**
 * Generate HTML email report from Claude analysis
 */
export function generateHTMLReport(analysis: EmailAnalysis, originalEmail: { from: string; subject: string }): string {
  const verdictColor = {
    safe: '#10b981', // green
    suspicious: '#f59e0b', // orange
    phishing: '#ef4444', // red
  }[analysis.verdict];

  const verdictIcon = {
    safe: '✅',
    suspicious: '⚠️',
    phishing: '🚨',
  }[analysis.verdict];

  const threatRows = analysis.threats.length > 0
    ? analysis.threats
        .map(
          threat => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${threat.type.replace('_', ' ').toUpperCase()}</strong>
            <span style="background: ${getSeverityColor(threat.severity)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">
              ${threat.severity.toUpperCase()}
            </span>
            <p style="margin: 8px 0 0 0; color: #4b5563;">${threat.description}</p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;"><em>Evidence: "${threat.evidence}"</em></p>
          </td>
        </tr>
      `
        )
        .join('')
    : '<tr><td style="padding: 12px; text-align: center; color: #6b7280;">No threats detected</td></tr>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>g0t-phish Analysis Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">g0t-phish Analysis Report</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Automated security analysis by Claude AI</p>
    </div>

    <!-- Verdict -->
    <div style="padding: 30px; text-align: center; background-color: ${verdictColor}15; border-bottom: 1px solid #e5e7eb;">
      <div style="font-size: 48px; margin-bottom: 10px;">${verdictIcon}</div>
      <h2 style="color: ${verdictColor}; margin: 0; font-size: 32px; text-transform: uppercase;">
        ${analysis.verdict}
      </h2>
      <p style="color: #4b5563; margin: 8px 0 0 0; font-size: 18px;">
        Confidence: <strong>${analysis.confidence}%</strong>
      </p>
    </div>

    <!-- Summary -->
    <div style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0;">Summary</h3>
      <p style="color: #4b5563; line-height: 1.6; margin: 0;">${analysis.summary}</p>
    </div>

    <!-- Original Email Info -->
    <div style="padding: 30px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0;">Analyzed Email</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 80px;"><strong>From:</strong></td>
          <td style="padding: 8px 0; color: #1f2937;">${originalEmail.from}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;"><strong>Subject:</strong></td>
          <td style="padding: 8px 0; color: #1f2937;">${originalEmail.subject}</td>
        </tr>
      </table>
    </div>

    <!-- Threats -->
    <div style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0;">Detected Threats (${analysis.threats.length})</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 4px;">
        ${threatRows}
      </table>
    </div>

    <!-- Authentication -->
    <div style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0;">Email Authentication</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 100px;"><strong>SPF:</strong></td>
          <td style="padding: 8px 0;">
            <span style="background: ${getAuthColor(analysis.authentication.spf)}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">
              ${analysis.authentication.spf.toUpperCase()}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;"><strong>DKIM:</strong></td>
          <td style="padding: 8px 0;">
            <span style="background: ${getAuthColor(analysis.authentication.dkim)}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">
              ${analysis.authentication.dkim.toUpperCase()}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;"><strong>DMARC:</strong></td>
          <td style="padding: 8px 0;">
            <span style="background: ${getAuthColor(analysis.authentication.dmarc)}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">
              ${analysis.authentication.dmarc.toUpperCase()}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 30px; text-align: center; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Analyzed by <strong>Claude ${analysis.metadata.model}</strong> in ${analysis.metadata.latency}ms
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
        This is an automated analysis. Always verify suspicious emails independently.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
        Powered by <strong>g0t-phish</strong>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function getSeverityColor(severity: string): string {
  const colors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };
  return colors[severity as keyof typeof colors] || '#6b7280';
}

function getAuthColor(status: string): string {
  const colors = {
    pass: '#10b981',
    fail: '#ef4444',
    neutral: '#f59e0b',
    none: '#6b7280',
  };
  return colors[status as keyof typeof colors] || '#6b7280';
}
