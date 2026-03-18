import { useState, useEffect } from 'react'
import './App.css'
import WalletPage from './pages/WalletPage'
import TransactionsPage from './pages/TransactionsPage'
import StakingPage from './pages/StakingPage'

type Tab = 'wallet' | 'transactions' | 'staking'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('wallet')
  const [tgUser, setTgUser] = useState<{ first_name?: string; username?: string } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      tg.ready()
      tg.expand()
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user)
      }
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⛓</span>
            <span className="logo-text">B_MAK</span>
          </div>
          {tgUser && (
            <div className="user-info">
              <span className="user-name">
                {tgUser.username ? `@${tgUser.username}` : tgUser.first_name}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'wallet' && <WalletPage />}
        {activeTab === 'transactions' && <TransactionsPage />}
        {activeTab === 'staking' && <StakingPage />}
      </main>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallet')}
        >
          <span className="nav-icon">💼</span>
          <span className="nav-label">Wallet</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">History</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'staking' ? 'active' : ''}`}
          onClick={() => setActiveTab('staking')}
        >
          <span className="nav-icon">🔒</span>
          <span className="nav-label">Staking</span>
        </button>
      </nav>
    </div>
  )
}

export default App
