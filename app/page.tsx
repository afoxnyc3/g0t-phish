export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      <div className="max-w-2xl bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          g0t-phish
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          AI-Powered Phishing Detection Agent
        </p>

        <div className="space-y-4 text-gray-700">
          <p>
            <strong>g0t-phish</strong> is an automated email security analysis service powered by Claude AI.
            Send any suspicious email to our agent address and receive an instant security assessment.
          </p>

          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="font-semibold text-lg mb-2">How it works:</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Forward suspicious emails to your configured agent address</li>
              <li>Claude AI analyzes the email for phishing threats</li>
              <li>Receive a detailed security report within seconds</li>
            </ol>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h2 className="font-semibold text-lg mb-2">Features:</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Instant webhook-based detection</li>
              <li>Claude AI intelligent analysis</li>
              <li>5-layer email loop prevention</li>
              <li>Rate limiting and abuse protection</li>
              <li>Beautiful HTML reports</li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500">
              Built with Next.js, Vercel, Resend, and Claude AI
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
