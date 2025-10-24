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
            ${threat.source ? `<span style="color: #6b7280; font-size: 12px; margin-left: 8px;">• Detected by ${formatSourceName(threat.source)}</span>` : ''}
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

    ${generateReasoningChainHTML(analysis)}

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

/**
 * Format source name for display
 */
function formatSourceName(source: string): string {
  const sourceMap: Record<string, string> = {
    claude: 'Claude AI',
    virustotal: 'VirusTotal',
    abuseipdb: 'AbuseIPDB',
  };
  return sourceMap[source.toLowerCase()] || source;
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

/**
 * Generate HTML for reasoning chain section (v1.1)
 * Shows step-by-step agent reasoning and tool usage
 */
function generateReasoningChainHTML(analysis: EmailAnalysis): string {
  // Skip if no reasoning or tool calls (backward compatibility)
  if (!analysis.reasoning?.length && !analysis.toolCalls?.length) {
    return '';
  }

  let html = `
    <!-- Agent Reasoning Chain (v1.1) -->
    <div style="padding: 30px; background-color: #fef3c7; border-bottom: 1px solid #e5e7eb;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0;">🧠 Agent Reasoning</h3>
  `;

  // Display reasoning steps
  if (analysis.reasoning?.length) {
    html += `<div style="font-size: 14px; color: #4b5563; line-height: 1.8; margin-bottom: 12px;">`;
    analysis.reasoning.forEach((step, index) => {
      html += `
        <div style="margin-bottom: 8px;">
          <strong style="color: #92400e;">${index + 1}.</strong> ${step}
        </div>
      `;
    });
    html += `</div>`;
  }

  // Display tool calls with results
  if (analysis.toolCalls?.length) {
    html += `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #fbbf24;">
        <h4 style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; font-weight: 600;">Tools Used:</h4>
    `;

    analysis.toolCalls.forEach((toolCall) => {
      const duration = toolCall.duration ? `${toolCall.duration}ms` : 'N/A';
      const success = toolCall.result?.success ? '✓' : '✗';
      const successColor = toolCall.result?.success ? '#10b981' : '#ef4444';

      html += `
        <div style="margin-bottom: 12px; padding: 12px; background-color: #fffbeb; border-radius: 6px; border: 1px solid #fde68a;">
          <div style="font-size: 14px; margin-bottom: 6px;">
            <span style="color: ${successColor}; font-weight: bold; margin-right: 6px;">${success}</span>
            <strong style="color: #78350f;">${formatToolName(toolCall.name)}</strong>
            <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">(${duration})</span>
          </div>
      `;

      // Display tool result summary
      if (toolCall.result?.success && toolCall.result.data) {
        const resultSummary = formatToolResult(toolCall.name, toolCall.result.data);
        if (resultSummary) {
          html += `
            <div style="font-size: 13px; color: #6b7280; margin-left: 20px; line-height: 1.5;">
              ${resultSummary}
            </div>
          `;
        }
      } else if (toolCall.result?.error) {
        html += `
          <div style="font-size: 13px; color: #dc2626; margin-left: 20px;">
            Error: ${toolCall.result.error}
          </div>
        `;
      }

      html += `</div>`;
    });

    html += `</div>`;
  }

  // Display performance metrics
  if (analysis.metadata.toolExecutionTime) {
    const toolCount = analysis.toolCalls?.length || 0;
    html += `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #fbbf24; font-size: 12px; color: #78350f;">
        <strong>Performance:</strong> ${toolCount} tool${toolCount !== 1 ? 's' : ''} executed in ${analysis.metadata.toolExecutionTime}ms
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Format tool name for display
 */
function formatToolName(name: string): string {
  const nameMap: Record<string, string> = {
    extract_urls: 'URL Extraction',
    check_authentication: 'Authentication Check',
    analyze_sender: 'Sender Analysis',
    check_url_reputation: 'URL Reputation (VirusTotal)',
    check_ip_reputation: 'IP Reputation (AbuseIPDB)',
  };
  return nameMap[name] || name;
}

/**
 * Format tool result for display
 */
function formatToolResult(toolName: string, data: any): string {
  switch (toolName) {
    case 'check_url_reputation':
      if (data.malicious) {
        return `🚨 Malicious URL detected (${data.malicious_count}/${data.total_scans} vendors). Detected by: ${data.detected_by?.slice(0, 3).join(', ') || 'N/A'}`;
      } else {
        return `✓ Clean URL (${data.malicious_count}/${data.total_scans} detections)`;
      }

    case 'check_ip_reputation':
      if (data.malicious) {
        return `⚠️ Malicious IP (${data.abuse_confidence_score}% confidence, ${data.total_reports} reports) - Risk: ${data.risk_level}`;
      } else {
        return `✓ Clean IP (${data.abuse_confidence_score}% confidence, ${data.total_reports} reports)`;
      }

    case 'extract_urls':
      const urlCount = data.urls?.length || 0;
      return `Found ${urlCount} URL${urlCount !== 1 ? 's' : ''} in email`;

    case 'check_authentication':
      const spf = data.spf || 'none';
      const dkim = data.dkim || 'none';
      const dmarc = data.dmarc || 'none';
      return `SPF: ${spf}, DKIM: ${dkim}, DMARC: ${dmarc}`;

    case 'analyze_sender':
      return data.suspicious ? '⚠️ Suspicious sender patterns detected' : '✓ Sender appears legitimate';

    default:
      return '';
  }
}
