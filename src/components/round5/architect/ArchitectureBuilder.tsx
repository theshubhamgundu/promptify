import React, { useState } from 'react';
import { Plus, ArrowDown, Send, Settings, Trash2 } from 'lucide-react';
import { ComponentPalette } from './ComponentPalette';
import { NodeConfig } from './NodeConfig';

interface ArchitectureBuilderProps {
  availableComponents: string[];
  onSubmit: (graph: any, configs: any) => void;
  isSubmitting: boolean;
}

interface Node {
  id: string;
  type: string;
  config: any;
}

export function ArchitectureBuilder({ availableComponents, onSubmit, isSubmitting }: ArchitectureBuilderProps) {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'start', type: 'INPUT', config: {} }
  ]);
  
  const [showPalette, setShowPalette] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const addNode = (type: string) => {
    const newNode = { id: `node_${Date.now()}`, type, config: {} };
    setNodes([...nodes, newNode]);
    setShowPalette(false);
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    if (editingNodeId === id) setEditingNodeId(null);
  };

  const updateNodeConfig = (id: string, config: any) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, config } : n));
    setEditingNodeId(null);
  };

  const submitGraph = () => {
    // Generate simple linear graph for phase 1
    const edges = nodes.slice(0, -1).map((n, i) => ({
      source: n.id,
      target: nodes[i + 1].id,
      type: 'sequential'
    }));
    
    const configs = nodes.reduce((acc, n) => ({ ...acc, [n.id]: n.config }), {});
    
    onSubmit({ nodes, edges }, configs);
  };

  return (
    <div className="flex h-full bg-slate-950">
      {/* Canvas */}
      <div className="flex-1 overflow-y-auto p-8 relative flex flex-col items-center pb-32">
        
        {nodes.map((node, i) => (
          <React.Fragment key={node.id}>
            {/* Node Card */}
            <div className="w-80 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg flex flex-col relative group">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-cyan-500 uppercase tracking-wider">{node.type}</span>
                <div className="flex space-x-2">
                  <button onClick={() => setEditingNodeId(node.id)} className="text-slate-400 hover:text-white p-1">
                    <Settings className="w-4 h-4" />
                  </button>
                  {i > 0 && node.type !== 'OUTPUT' && (
                    <button onClick={() => removeNode(node.id)} className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-300">
                {Object.keys(node.config).length > 0 ? (
                  <span className="italic text-slate-400">Configured</span>
                ) : (
                  <span className="text-amber-500/70 text-xs">Needs configuration</span>
                )}
              </div>
            </div>

            {/* Edge */}
            {i < nodes.length - 1 && (
              <div className="flex flex-col items-center justify-center h-8 w-px bg-slate-700 my-2">
                <ArrowDown className="w-4 h-4 text-slate-600 mt-auto -mb-2" />
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Add Node Button */}
        {!nodes.find(n => n.type === 'OUTPUT') && (
          <>
            <div className="flex flex-col items-center justify-center h-8 w-px bg-slate-800 my-2" />
            <button 
              onClick={() => setShowPalette(true)}
              className="w-12 h-12 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500 transition-colors"
            >
              <Plus className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Output Auto-Append */}
        {!nodes.find(n => n.type === 'OUTPUT') && nodes.length > 1 && (
           <div className="mt-8">
             <button 
                onClick={() => addNode('OUTPUT')}
                className="text-xs text-slate-500 hover:text-white bg-slate-900 px-3 py-1 rounded"
              >
                + Complete flow with OUTPUT
             </button>
           </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-6 left-6 right-[450px] flex justify-center pointer-events-none">
        <button 
          onClick={submitGraph}
          disabled={isSubmitting || !nodes.find(n => n.type === 'OUTPUT')}
          className="pointer-events-auto flex items-center space-x-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full font-bold shadow-xl transition-all"
        >
          <span>Submit Architecture</span>
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Side Panels */}
      {showPalette && (
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 absolute right-[450px] top-0 bottom-0 z-10 shadow-2xl">
          <ComponentPalette 
            available={availableComponents} 
            onSelect={addNode} 
            onClose={() => setShowPalette(false)} 
          />
        </div>
      )}

      {editingNodeId && (
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 absolute right-[450px] top-0 bottom-0 z-10 shadow-2xl">
          <NodeConfig 
            node={nodes.find(n => n.id === editingNodeId)!}
            onSave={(config) => updateNodeConfig(editingNodeId, config)}
            onClose={() => setEditingNodeId(null)}
          />
        </div>
      )}
    </div>
  );
}
