import React, { useState } from 'react';
import { ApiDebugData } from '@/hooks';

interface DebugPanelProps {
  history: ApiDebugData[];
  onClear: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ history, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ApiDebugData | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('response');

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-petri-accent border border-petri-highlight rounded-lg px-4 py-2 text-gray-300 hover:bg-petri-highlight transition-colors z-50 flex items-center gap-2"
      >
        <span>🔧</span>
        <span>API Debug</span>
        {history.length > 0 && (
          <span className="bg-petri-glow text-white text-xs px-2 py-0.5 rounded-full">
            {history.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-petri-bg border border-petri-highlight rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-petri-highlight">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🔧</span> API Debug Panel
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="px-3 py-1.5 bg-red-900 text-red-200 rounded-lg hover:bg-red-800 transition-colors text-sm"
            >
              Clear History
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 bg-petri-highlight text-white rounded-lg hover:bg-petri-glow transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* History List */}
          <div className="w-64 border-r border-petri-highlight overflow-y-auto">
            <div className="p-2">
              <h3 className="text-gray-400 text-sm font-medium mb-2 px-2">Request History</h3>
              {history.length === 0 ? (
                <p className="text-gray-500 text-sm px-2">No API calls yet</p>
              ) : (
                <div className="space-y-1">
                  {history.map((entry, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedEntry(entry)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedEntry === entry
                          ? 'bg-petri-glow text-white'
                          : 'hover:bg-petri-accent text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {entry.type === 'generate-world' ? '🌍' : 
                           entry.type === 'evolve' ? '🧬' : '🎨'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {entry.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            {entry.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* JSON Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedEntry ? (
              <>
                {/* Tabs */}
                <div className="flex border-b border-petri-highlight">
                  <button
                    onClick={() => setActiveTab('request')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === 'request'
                        ? 'text-petri-glow border-b-2 border-petri-glow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    📤 Request
                  </button>
                  <button
                    onClick={() => setActiveTab('response')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === 'response'
                        ? 'text-petri-glow border-b-2 border-petri-glow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    📥 Response
                  </button>
                </div>

                {/* JSON Content */}
                <div className="flex-1 overflow-auto p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">
                      {activeTab === 'request' ? 'Request Body' : 'Response Body'}
                    </span>
                    <button
                      onClick={() => {
                        const data = activeTab === 'request' 
                          ? selectedEntry.request 
                          : selectedEntry.response;
                        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                      }}
                      className="text-xs px-2 py-1 bg-petri-accent rounded hover:bg-petri-highlight transition-colors text-gray-300"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <pre className="bg-petri-dark rounded-lg p-4 overflow-auto text-sm text-gray-300 font-mono whitespace-pre-wrap">
                    {JSON.stringify(
                      activeTab === 'request' ? selectedEntry.request : selectedEntry.response,
                      null,
                      2
                    )}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">📋</div>
                  <p>Select an API call from the history to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
