import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { supabase } from './supabaseClient';

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRefactoring, setIsRefactoring] = useState(false);
  const fgRef = React.useRef();

  // fetch the data
  useEffect(() => {
    async function getData() {
      console.log("Attempting to fetch from Supabase...");
      const { data, error } = await supabase.from('file_context').select('*');
      
      if (error) {
        console.error("SUPABASE ERROR:", error.message);
      } else {
        console.log("DATA RECEIVED:", data);
        setFiles(data || []);
      }
    }
    getData();
  }, []);

  // transform sup data to graphz
  const graphData = useMemo(() => {
    if (!files || files.length === 0) return { nodes: [], links: [] };

    const nodes = files.map(f => ({
      id: f.file_name, // This is critical for the graph library
      intent: f.author_intent || "No intent data",
      debt: f.tech_debt_reason || "No debt analysis",
      impact: f.impact_report || "No impact report",
      // Red if debt text is long, else Green
      color: (f.tech_debt_reason && f.tech_debt_reason.length > 40) ? '#f43f5e' : '#10b981',
      val: (f.tech_debt_reason && f.tech_debt_reason.length > 40) ? 7 : 3
    }));

    // linking everything to 1st node to create cluster
    const links = nodes.length > 1 ? nodes.slice(1).map(n => ({
      source: nodes[0].id,
      target: n.id
    })) : [];

    console.log("TRANSFORMED GRAPH DATA:", { nodes, links });
    return { nodes, links };
  }, [files]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 100);
      }, 500);
    }
  }, [graphData]); 

  return (
    <div className="h-screen w-full bg-[#0b0f1a] text-slate-200 flex flex-col font-sans overflow-hidden">
      
      {/* TOP NAVBAR */}
      <header className="p-4 bg-[#161b22] border-b border-slate-800 flex justify-between items-center shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic">dashweb pore dekhchhi<span className="text-emerald-500">.git</span></h1>
        </div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border border-slate-800 px-3 py-1 rounded">
          Branch: <span className="text-emerald-400">legacy-refactor-v2</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT: INTERACTIVE NODE GRAPH CONTAINER */}
        <div className="w-7/12 h-full border-r border-slate-800 bg-[#0d1117] relative overflow-hidden">
          
          {/* Floating Legend */}
          <div className="absolute top-4 left-4 z-10 bg-black/60 p-4 rounded-lg border border-white/5 backdrop-blur-md scale-90">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Architecture Visualizer</h2>
            <p className="text-[10px] text-slate-600 mb-2">Hover to inspect, Click to analyze</p>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-[9px] text-slate-500 uppercase">Stable</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                <span className="text-[9px] text-slate-500 uppercase">High Risk</span>
              </div>
            </div>
          </div>
          
          {/* THE GRAPH */}
          <ForceGraph2D
             ref={fgRef}
            graphData={graphData}
            nodeLabel="id"
            nodeColor={node => node.color}
            nodeRelSize={4} // Shrink from 8 to 4
            linkColor={() => '#334155'}
            backgroundColor="#0d1117"
            width={window.innerWidth * 0.58}
            height={window.innerHeight - 70}
            cooldownTicks={100}
   
           // eta ytube ta theke so may not work DO NOT BLAME ME
            d3AlphaDecay={0.01}
            d3VelocityDecay={0.3}
            onNodeClick={(node) => {
              setSelectedFile(node);
              setIsRefactoring(false);
           }}
         />
        </div>

        {/* RIGHT: AI ANALYSIS & SANDBOX */}
        <div className="w-5/12 flex flex-col bg-[#0b0f1a]">
          
          {/* TOP HALF: CONTEXTUAL BLAME CHATBOT */}
          <div className="h-1/2 border-b border-slate-800 flex flex-col p-6 overflow-y-auto">
            {!selectedFile ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-700">
                <p className="text-sm italic">Select a node to synthesize intent history...</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex gap-3">
                   <div className="w-8 h-8 rounded-full bg-emerald-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">AI</div>
                   <div className="flex-1 bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-sm leading-relaxed">
                      <span className="text-emerald-500 font-bold block mb-1 uppercase text-[10px]">Architectural Intent</span>
                      {selectedFile.intent}
                   </div>
                </div>
                <div className="flex gap-3">
                   <div className="w-8 h-8 rounded-full bg-rose-900 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">!</div>
                   <div className="flex-1 bg-rose-950/20 border border-rose-900/30 p-4 rounded-xl text-sm text-rose-200">
                      <span className="text-rose-500 font-bold block mb-1 uppercase text-[10px]">Technical Debt Analysis</span>
                      {selectedFile.debt}
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM HALF: REFACTOR SANDBOX & IMPACT */}
          <div className="h-1/2 flex flex-col">
            <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Refactor Sandbox</h3>
              {selectedFile && (
                <button 
                  onClick={() => setIsRefactoring(true)}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-4 rounded-full transition-all uppercase shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  Analyze Refactor Impact
                </button>
              )}
            </div>

            <div className="flex-1 flex overflow-hidden">
               {/* Legacy View */}
               <div className="w-1/2 p-4 border-r border-slate-800 font-mono text-[10px] text-slate-600 bg-black/30 overflow-auto">
                  <span className="text-[8px] uppercase text-slate-800 block mb-2 font-bold tracking-widest">Legacy Source</span>
                  {selectedFile ? `function handle_${selectedFile.id.replace(/\.[^/.]+$/, "")}() {\n  // ⚠️ Dependency Risk\n  const res = legacyCall();\n  return res;\n}` : '// Select a node...'}
               </div>
               
               {/* Modernized View */}
               <div className="w-1/2 p-4 bg-emerald-500/[0.01] flex flex-col justify-between overflow-auto">
                  <div>
                    <span className="text-[8px] uppercase text-emerald-800 block mb-2 font-bold tracking-widest">Modernized Preview</span>
                    {isRefactoring ? (
                       <pre className="text-[10px] font-mono text-emerald-400 animate-in fade-in duration-1000">
                         {`export const handle = async () => {\n  const res = await safeCall();\n  return res;\n};`}
                       </pre>
                    ) : (
                       <div className="text-[10px] text-slate-800 italic">No refactor queued...</div>
                    )}
                  </div>
                  
                  {isRefactoring && (
                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in zoom-in-95 duration-500">
                       <h4 className="text-[9px] font-bold text-emerald-500 uppercase mb-1 underline tracking-wider">Impact Report</h4>
                       <p className="text-[10px] text-emerald-200/80 leading-tight italic">
                         {selectedFile.impact}
                       </p>
                    </div>
                  )}
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;