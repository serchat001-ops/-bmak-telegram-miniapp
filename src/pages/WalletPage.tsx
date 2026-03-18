import { useState } from 'react'
import './WalletPage.css'

const DEMO_ADDRESS = '0x742d35Cc6634C0532925a3b8D4C9C5B3eE0F1b8'
const DEMO_BALANCES = [
  { symbol: 'ETH', name: 'Ethereum', balance: '1.2847', usd: '4,521.30', change: '+3.24%', icon: '⟠', positive: true },
  { symbol: 'BMAK', name: 'B_MAK Token', balance: '10,500.00', usd: '2,100.00', change: '+12.58%', icon: '⛓', positive: true },
  { symbol: 'USDT', name: 'Tether USD', balance: '850.00', usd: '850.00', change: '+0.01%', icon: '₮', positive: true },
  { symbol: 'BNB', name: 'BNB Chain', balance: '3.45', usd: '1,242.00', change: '-1.12%', icon: '◆', positive: false },
]

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function WalletPage() {
  const [copied, setCopied] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sendAmount, setSendAmount] = useState('')
  const [sendAddress, setSendAddress] = useState('')

  const totalUSD = 8713.30

  const handleCopy = () => {
    navigator.clipboard.writeText(DEMO_ADDRESS).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    alert(`Demo: Sending ${sendAmount} ETH to ${sendAddress}`)
    setShowSend(false)
    setSendAmount('')
    setSendAddress('')
  }

  return (
    <div className="wallet-page">
      <div className="total-balance-card">
        <div className="balance-label">Total Portfolio Value</div>
        <div className="balance-amount">${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div className="balance-change positive">▲ 4.82% today</div>

        <div className="wallet-address" onClick={handleCopy}>
          <span className="address-text">{shortenAddress(DEMO_ADDRESS)}</span>
          <span className="copy-btn">{copied ? '✓ Copied' : '📋 Copy'}</span>
        </div>

        <div className="action-buttons">
          <button className="action-btn primary" onClick={() => setShowSend(true)}>
            <span>↑</span> Send
          </button>
          <button className="action-btn secondary">
            <span>↓</span> Receive
          </button>
          <button className="action-btn secondary">
            <span>⇄</span> Swap
          </button>
        </div>
      </div>

      {showSend && (
        <div className="modal-overlay" onClick={() => setShowSend(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Crypto</h3>
              <button className="close-btn" onClick={() => setShowSend(false)}>✕</button>
            </div>
            <form onSubmit={handleSend} className="send-form">
              <div className="form-group">
                <label>Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={sendAddress}
                  onChange={e => setSendAddress(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Amount (ETH)</label>
                <input
                  type="number"
                  placeholder="0.0"
                  step="0.0001"
                  min="0"
                  value={sendAmount}
                  onChange={e => setSendAmount(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="action-btn primary full-width">
                Confirm Send
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="section-title">Assets</div>

      <div className="assets-list">
        {DEMO_BALANCES.map(token => (
          <div className="asset-card" key={token.symbol}>
            <div className="asset-icon">{token.icon}</div>
            <div className="asset-info">
              <div className="asset-name">{token.name}</div>
              <div className="asset-balance">{token.balance} {token.symbol}</div>
            </div>
            <div className="asset-value">
              <div className="asset-usd">${token.usd}</div>
              <div className={`asset-change ${token.positive ? 'positive' : 'negative'}`}>
                {token.change}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
