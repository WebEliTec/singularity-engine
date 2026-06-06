/*
import { useState } from 'react'

export default function App() {
  const [response, setResponse] = useState(null)

  const handlePing = async () => {
    const result = await window.athene.ping()
    setResponse(result)
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Athene</h1>
      <button onClick={handlePing}>Hallo!!</button>
      {response !== null && <p>Response: {response}</p>}
    </main>
  )
}*/


import { MorpheusGraph } from "../morpheus/index.js"

function App() {
  return (
    <MorpheusGraph />
  )
}

export default App