import { useState } from 'react'
import './StakingPage.css'

const STAKING_POOLS = [
  { id: '1', name: 'BMAK Flexible', symbol: 'BMAK', apy: '12.5%', minStake: '100', lockup: 'None', tvl: '$1.2M', userStaked: '5,000', rewards: '52.5' },
  { id: '2', name: 'ETH 30-Day Lock', symbol: 'ETH', apy: '8.2%', minStake: '0.1', lockup: '30 days', tvl: '$5.8M', userStaked: '0.5', rewards: '0.0034' },
  { id: '3', name: 'BNB 90-Day Lock', symbol: 'BNB', apy: '18.0%', minStake: '1', lockup: '90 days', tvl: '$890K', userStaked: '0', rewards: '0' },
  { id: '4', name: 'BMAK-ETH LP', symbol: 'BMAK-ETH', apy: '35.4%', minStake: '50', lockup: '7 days', tvl: '$320K', userStaked: '0', rewards: '0' },
]

export default function StakingPage() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [stakeAmount, setStakeAmount] = useState('')
  const [action, setAction] = useState<'stake' | 'unstake'>('stake')

  const totalStakedUSD = 1052.50
  const totalRewardsUSD = 10.80

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault()
    const pool = STAKING_POOLS.find(p => p.id === selectedPool)
    alert(`Demo: ${action === 'stake' ? 'Staking' : 'Unstaking'} ${stakeAmount} ${pool?.symbol}`)
    setSelectedPool(null)
    setStakeAmount('')
  }

  const handleClaim = () => {
    alert('Demo: Claiming all staking rewards!')
  }

  return (
    <div className="staking-page">
      <div className="staking-summary">
        <div className="summary-item">
          <div className="summary-label">My Staked Value</div>
          <div className="summary-value">${totalStakedUSD.toLocaleString()}</div>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <div className="summary-label">Pending Rewards</div>
          <div className="summary-value positive">${totalRewardsUSD.toFixed(2)}</div>
        </div>
        <button className="claim-btn" onClick={handleClaim}>
          Claim All
        </button>
      </div>

      <div className="section-title">Staking Pools</div>

      <div className="pools-list">
        {STAKING_POOLS.map(pool => (
          <div className="pool-card" key={pool.id}>
            <div className="pool-header">
              <div className="pool-name-group">
                <div className="pool-icon">🏊</div>
                <div>
                  <div className="pool-name">{pool.name}</div>
                  <div className="pool-lockup">{pool.lockup === 'None' ? 'Flexible' : `Lock: ${pool.lockup}`}</div>
                </div>
              </div>
              <div className="pool-apy">
                <div className="apy-label">APY</div>
                <div className="apy-value">{pool.apy}</div>
              </div>
            </div>

            <div className="pool-stats">
              <div className="pool-stat">
                <span className="stat-label">TVL</span>
                <span className="stat-val">{pool.tvl}</span>
              </div>
              <div className="pool-stat">
                <span className="stat-label">Min Stake</span>
                <span className="stat-val">{pool.minStake} {pool.symbol.split('-')[0]}</span>
              </div>
              <div className="pool-stat">
                <span className="stat-label">My Stake</span>
                <span className="stat-val">{pool.userStaked} {pool.symbol.split('-')[0]}</span>
              </div>
              {parseFloat(pool.rewards) > 0 && (
                <div className="pool-stat">
                  <span className="stat-label">Rewards</span>
                  <span className="stat-val positive">+{pool.rewards}</span>
                </div>
              )}
            </div>

            <div className="pool-actions">
              <button
                className="pool-btn primary"
                onClick={() => { setSelectedPool(pool.id); setAction('stake') }}
              >
                Stake
              </button>
              {parseFloat(pool.userStaked) > 0 && (
                <button
                  className="pool-btn secondary"
                  onClick={() => { setSelectedPool(pool.id); setAction('unstake') }}
                >
                  Unstake
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedPool && (
        <div className="modal-overlay" onClick={() => setSelectedPool(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{action === 'stake' ? 'Stake Tokens' : 'Unstake Tokens'}</h3>
              <button className="close-btn" onClick={() => setSelectedPool(null)}>✕</button>
            </div>
            {(() => {
              const pool = STAKING_POOLS.find(p => p.id === selectedPool)!
              return (
                <form onSubmit={handleAction} className="stake-form">
                  <div className="selected-pool-info">
                    <span>{pool.name}</span>
                    <span className="apy-badge">{pool.apy} APY</span>
                  </div>
                  <div className="form-group">
                    <label>Amount ({pool.symbol.split('-')[0]})</label>
                    <input
                      type="number"
                      placeholder={`Min: ${pool.minStake}`}
                      step="0.001"
                      min={pool.minStake}
                      value={stakeAmount}
                      onChange={e => setStakeAmount(e.target.value)}
                      required
                    />
                  </div>
                  {action === 'stake' && pool.lockup !== 'None' && (
                    <div className="lockup-notice">
                      ⚠️ Tokens will be locked for {pool.lockup}
                    </div>
                  )}
                  <button type="submit" className="pool-btn primary full-width">
                    Confirm {action === 'stake' ? 'Stake' : 'Unstake'}
                  </button>
                </form>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
