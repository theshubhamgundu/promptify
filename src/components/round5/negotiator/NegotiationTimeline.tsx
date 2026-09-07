import React, { useRef, useEffect } from 'react';
import { Bot, User, Clock } from 'lucide-react';

interface NegotiationTimelineProps {
  actions: any[];
}

export function NegotiationTimeline({ actions }: NegotiationTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <h3 className="font-bold text-white">Negotiation Timeline</h3>
        <div className="text-xs text-slate-500 flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {actions.length} turns taken
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {actions.length === 0 ? (
          <div className="text-center text-slate-500 text-sm mt-10">
            No actions taken yet. Start the negotiation!
          </div>
        ) : (
          actions.map((action, i) => (
            <div key={action.id} className={`flex flex-col ${action.actor === 'PARTICIPANT' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center mb-1 space-x-2">
                {action.actor === 'PARTICIPANT' ? (
                  <>
                    <span className="text-xs font-bold text-slate-400">{action.action_type}</span>
                    <span className="text-xs text-cyan-500 font-bold">You</span>
                    <User className="w-4 h-4 text-cyan-500" />
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-500 font-bold">Opponent</span>
                    <span className="text-xs font-bold text-slate-400">{action.action_type}</span>
                  </>
                )}
              </div>
              
              <div className={`max-w-[80%] rounded-lg p-4 text-sm shadow-md ${
                action.actor === 'PARTICIPANT' 
                  ? 'bg-cyan-950/30 border border-cyan-900 text-slate-200' 
                  : 'bg-slate-800 border border-slate-700 text-slate-200'
              }`}>
                {action.actor === 'PARTICIPANT' ? (
                  <div className="space-y-2">
                    {action.parameters.price && <div><span className="text-slate-400 text-xs">PRICE:</span> {action.parameters.price}</div>}
                    {action.parameters.terms && <div><span className="text-slate-400 text-xs">TERMS:</span> {action.parameters.terms}</div>}
                    {action.parameters.question && <div className="italic">"{action.parameters.question}"</div>}
                    {!action.parameters.price && !action.parameters.question && (
                      <div className="text-slate-400 italic">Action executed.</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {action.parameters.message && <div>{action.parameters.message}</div>}
                    {action.parameters.counter_terms && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50 text-amber-400/80 italic">
                        {JSON.stringify(action.parameters.counter_terms)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
