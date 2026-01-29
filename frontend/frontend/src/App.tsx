import { useState, useRef } from 'react'
import { Sparkles, XCircle, Bot, Eye, EyeOff, Plus, SlidersHorizontal, ChevronDown, Mic } from 'lucide-react'
import './App.css'

interface Message {
  content: string;
  type: 'ai' | 'user' | 'log';
  timestamp: Date;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

function App() {
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const quickActions = [
    'Build a web app',
    'Write some code',
    'Learn a new concept',
    'Design a UI',
    'Write a smart contract',
    'Start a new idea'
  ]
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const isStreaming = status === 'loading'
  const handleQuickAction = (action: string) => {
    setPrompt(action)
    inputRef.current?.focus()
  }

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    
    if (!prompt.trim()) return

    setStatus('loading')
    setError('')
    setMessages([{ content: prompt, type: 'user', timestamp: new Date() }])

    try {
      const response = await fetch('http://localhost:3000/api/generate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate project')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            
            if (data.type === 'message') {
              setMessages(prev => [...prev, {
                content: data.content,
                type: 'ai',
                timestamp: new Date()
              }])
            } else if (data.type === 'log') {
              setMessages(prev => [...prev, {
                content: data.content,
                type: 'log',
                timestamp: new Date()
              }])
            } else if (data.type === 'complete') {
              setMessages(prev => [...prev, {
                content: `✅ I've built your project! Check it out at:\n${data.project_root}`,
                type: 'ai',
                timestamp: new Date()
              }])
              setStatus('success')
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
      setMessages(prev => [...prev, {
        content: `❌ Oops! Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'ai',
        timestamp: new Date()
      }])
    }
  }

  const resetForm = () => {
    setPrompt('')
    setStatus('idle')
    setError('')
    setMessages([])
    setShowLogs(false)
  }

  return (
    <div className="app">
      <div className="brand-badge">
        <Sparkles className="brand-icon" />
        <span className="brand-name">Fumble</span>
        <span className="brand-by">by Aryan</span>
      </div>
      <main className="app-main">
        {status === 'idle' && (
          <div className="start-screen">
            <div className="welcome-section">
              <div className="welcome-heading">
                <Sparkles className="welcome-icon" />
                <span className="welcome-hi">Hi Aryan</span>
              </div>
              <h2 className="welcome-title">Where should we start?</h2>
              <p className="welcome-subtitle">Ask anything and I'll not even help you, I'll build it.</p>
              
              <form onSubmit={handleSubmit} className="input-card-form">
                <div className="gemini-input-card">
                  <div className="gemini-input-main">
                    <textarea
                      ref={inputRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Build a spotify clone for me!"
                      className="gemini-input"
                      rows={1}
                      disabled={isStreaming}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                    />
                    <button 
                      type="submit" 
                      className="gemini-send"
                      disabled={!prompt.trim() || isStreaming}
                    >
                      <Sparkles size={20} />
                    </button>
                  </div>
                  <div className="gemini-input-meta">
                    <div className="meta-left">
                      {/* <button type="button" className="icon-pill" aria-label="Add">
                        <Plus size={16} />
                      </button> */}
                      {/* <button type="button" className="ghost-pill">
                        <SlidersHorizontal size={16} />
                        <span>Tools</span>
                      </button> */}
                    </div>
                    <div className="meta-right">
                      {/* <button type="button" className="ghost-pill">
                        <span>Fast</span>
                        <ChevronDown size={14} />
                      </button>
                      <button type="button" className="icon-pill" aria-label="Mic input">
                        <Mic size={16} />
                      </button> */}
                    </div>
                  </div>
                </div>
              </form>

              <div className="quick-actions">
                {quickActions.map(action => (
                  <button 
                    key={action} 
                    className="quick-action"
                    type="button"
                    onClick={() => handleQuickAction(action)}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(status === 'loading' || status === 'success') && messages.length > 0 && (
          <div className="conversation">
            {messages.map((msg, idx) => {
              if (msg.type === 'log' && !showLogs) return null;
              
              return (
                <div key={idx} className={`message-row ${msg.type}`}>
                  <div className="message-bubble">
                    <div className="message-header">
                      {msg.type === 'ai' || msg.type === 'log' ? (
                        <>
                          <Bot className="message-icon" />
                          <span className="message-sender">Fumble</span>
                        </>
                      ) : (
                        <span className="message-sender user-sender">You</span>
                      )}
                    </div>
                    <div className={`message-body ${msg.type === 'log' ? 'log-message' : ''}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {status === 'loading' && (
              <div className="message-row ai">
                <div className="message-bubble">
                  <div className="message-header">
                    <Bot className="message-icon" />
                    <span className="message-sender">Fumble</span>
                  </div>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="error-screen">
            <XCircle className="error-icon" />
            <h3>Something went wrong</h3>
            <p className="error-text">{error}</p>
            <button onClick={resetForm} className="retry-button">
              Try Again
            </button>
          </div>
        )}
      </main>

      {(status === 'loading' || status === 'success') && messages.length > 0 && (
        <footer className="app-footer">
          <div className="toggle-wrapper">
            <button 
              className={`log-toggle ${showLogs ? 'active' : ''}`}
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>Do you want to see me thinking?</span>
            </button>
          </div>
        
        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to build..."
              className="main-input"
              rows={1}
              disabled={isStreaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={!prompt.trim() || isStreaming}
            >
              <Sparkles size={20} />
            </button>
          </div>
        </form>
        
        {status === 'success' && (
          <button onClick={resetForm} className="reset-button">
            <Sparkles size={16} />
            Start New Project
          </button>
        )}
        
          <p className="footer-text">Built with LangGraph • by Aryan</p>
        </footer>
      )}
    </div>
  )
}

export default App
