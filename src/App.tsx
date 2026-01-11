import { ConfigPanel, SimulationView, ResultsPanel, DebugPanel } from '@/components';
import { useSimulation } from '@/hooks';
import { useState } from 'react';

function App() {
  const {
    status,
    isGenerating,
    isEvolving,
    generation,
    world,
    organisms,
    events,
    stats,
    texture,
    narrative,
    maxTicks,
    error,
    evolveResult,
    generateWorld,
    continueSimulation,
    completeRun,
    reset,
    apiDebugHistory,
    clearDebugHistory
  } = useSimulation();

  const [isImmersive, setIsImmersive] = useState(false);

  return (
    <div className="min-h-screen bg-petri-dark text-white">
      {/* Header */}
      <header className="bg-petri-bg border-b border-petri-highlight">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🧫</span>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-petri-glow to-purple-400 bg-clip-text text-transparent">
                Petridise
              </h1>
              <p className="text-gray-400 text-sm">Simulation Observation System</p>
            </div>
          </div>

          {status !== 'configuring' && (
            <div className="flex items-center gap-4">
              <div className="text-gray-400">
                Generation: <span className="text-petri-glow font-bold">{generation}</span>
              </div>
              {world && (
                <div className="text-gray-400">
                  World: <span className="text-white">{world.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-900 border border-red-500 rounded-xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-red-200">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
            <button
              onClick={reset}
              className="ml-auto px-4 py-2 bg-red-800 rounded-lg hover:bg-red-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {status === 'configuring' && (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">Welcome to Petridise</h2>
              <p className="text-gray-400 text-lg">
                Create a world, seed it with life, and watch evolution unfold.
                <br />
                Powered by AI, driven by nature's algorithms.
              </p>
            </div>
            <ConfigPanel
              onStart={generateWorld}
              isLoading={isGenerating}
            />
          </div>
        )}

        {status === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-pulse text-6xl mb-6">🌍</div>
            <h2 className="text-2xl font-bold mb-2">Generating World...</h2>
            <p className="text-gray-400">
              Gemini AI is crafting your unique ecosystem
            </p>
            <div className="mt-8 flex gap-2">
              {['🦠', '🌿', '🐛', '🦎', '🌸'].map((emoji, i) => (
                <span
                  key={i}
                  className="text-3xl animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {status === 'running' && world && texture && (
          <SimulationView
            world={world}
            organisms={organisms}
            texture={texture}
            maxTicks={maxTicks}
            onComplete={completeRun}
            onImmersiveModeChange={setIsImmersive}
          />
        )}

        {status === 'completed' && world && (
          <ResultsPanel
            generation={generation}
            organisms={organisms}
            events={events}
            stats={stats}
            narrative={narrative}
            evolveResult={evolveResult ?? undefined}
            onContinue={continueSimulation}
            onReset={reset}
            isEvolving={isEvolving}
          />
        )}

        {status === 'evolving' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin text-6xl mb-6">🧬</div>
            <h2 className="text-2xl font-bold mb-2">Evolution in Progress...</h2>
            <p className="text-gray-400">
              Analyzing survival data and generating the next generation
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-petri-bg border-t border-petri-highlight mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-gray-500 text-sm">
          <p>
            Petridise © 2026 • Powered by Google Gemini AI • Built with React + Phaser
          </p>
        </div>
      </footer>

      {/* Debug Panel - hidden in immersive mode */}
      {!isImmersive && <DebugPanel history={apiDebugHistory} onClear={clearDebugHistory} />}
    </div>
  );
}

export default App;
