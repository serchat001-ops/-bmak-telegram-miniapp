import './TransactionsPage.css'

const TRANSACTIONS = [
  { id: '1', type: 'receive', symbol: 'ETH', amount: '+0.5', usd: '+$1,762.50', from: '0x1234...5678', time: '2 min ago', status: 'confirmed' },
  { id: '2', type: 'send', symbol: 'USDT', amount: '-150.00', usd: '-$150.00', to: '0xabcd...ef01', time: '1 hour ago', status: 'confirmed' },
  { id: '3', type: 'swap', symbol: 'BNB→ETH', amount: '1.0', usd: '$362.00', time: '3 hours ago', status: 'confirmed' },
  { id: '4', type: 'stake', symbol: 'BMAK', amount: '+52.5', usd: '+$10.50', time: '5 hours ago', status: 'confirmed' },
  { id: '5', type: 'receive', symbol: 'BMAK', amount: '+1,000', usd: '+$200.00', from: '0x9999...aaaa', time: '1 day ago', status: 'confirmed' },
  { id: '6', type: 'send', symbol: 'ETH', amount: '-0.1', usd: '-$352.50', to: '0x5555...6666', time: '2 days ago', status: 'confirmed' },
  { id: '7', type: 'swap', symbol: 'USDT→BMAK', amount: '500', usd: '$500.00', time: '3 days ago', status: 'confirmed' },
  { id: '8', type: 'send', symbol: 'ETH', amount: '-0.05', usd: '-$176.25', to: '0x7777...8888', time: '5 days ago', status: 'pending' },
]

const TX_ICONS: Record<string, string> = {
  receive: '↓',
  send: '↑',
  swap: '⇄',
  stake: '🔒',
}

const TX_COLORS: Record<string, string> = {
  receive: '#22c55e',
  send: '#ef4444',
  swap: '#8b5cf6',
  stake: '#06b6d4',
}

export default function TransactionsPage() {
  return (
    <div className="transactions-page">
      <div className="page-header">
        <h2>Transaction History</h2>
        <button className="filter-btn">Filter ▾</button>
      </div>

      <div className="tx-stats">
        <div className="tx-stat">
          <div className="stat-label">This Month</div>
          <div className="stat-value positive">+$2,372.50</div>
        </div>
        <div className="tx-divider" />
        <div className="tx-stat">
          <div className="stat-label">Transactions</div>
          <div className="stat-value">{TRANSACTIONS.length}</div>
        </div>
        <div className="tx-divider" />
        <div className="tx-stat">
          <div className="stat-label">Gas Spent</div>
          <div className="stat-value">$12.40</div>
        </div>
      </div>

      <div className="tx-list">
        {TRANSACTIONS.map(tx => (
          <div className="tx-card" key={tx.id}>
            <div
              className="tx-icon"
              style={{ background: `${TX_COLORS[tx.type]}20`, color: TX_COLORS[tx.type] }}
            >
              {TX_ICONS[tx.type]}
            </div>
            <div className="tx-info">
              <div className="tx-type">{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} {tx.symbol}</div>
              <div className="tx-meta">
                {tx.from && <span>From: {tx.from}</span>}
                {tx.to && <span>To: {tx.to}</span>}
                {!tx.from && !tx.to && <span>{tx.type === 'swap' ? 'DEX Swap' : 'Staking Reward'}</span>}
                <span className="tx-time">{tx.time}</span>
              </div>
            </div>
            <div className="tx-value">
              <div
                className="tx-amount"
                style={{ color: tx.type === 'receive' || tx.type === 'stake' ? '#22c55e' : tx.type === 'send' ? '#ef4444' : '#fff' }}
              >
                {tx.amount}
              </div>
              <div className="tx-usd">{tx.usd}</div>
              <div className={`tx-status ${tx.status}`}>{tx.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
